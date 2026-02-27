import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPayPalWebhookSignature, mapPayPalStatus } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID');
    if (!PAYPAL_WEBHOOK_ID) throw new Error('PAYPAL_WEBHOOK_ID not configured');

    const rawBody = await req.text();

    // Extract PayPal signature headers
    const sigHeaders: Record<string, string> = {};
    for (const key of ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']) {
      sigHeaders[key] = req.headers.get(key) || '';
    }

    // Verify webhook signature
    const isValid = await verifyPayPalWebhookSignature(sigHeaders, rawBody, PAYPAL_WEBHOOK_ID);
    if (!isValid) {
      console.error('PayPal webhook signature verification failed');
      return new Response(JSON.stringify({ error: 'invalid_signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const eventId = event.id;

    // Deduplication via webhook_inbox
    const { data: existing } = await supabase
      .from('webhook_inbox')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store in webhook_inbox
    await supabase.from('webhook_inbox').insert({
      event_id: eventId,
      provider: 'paypal',
      event_type: eventType,
      payload: event,
    });

    // Handle payout events
    const payoutResource = event.resource;
    const paypalBatchId = payoutResource?.payout_batch_id || payoutResource?.payout_item?.payout_batch_id;
    const transactionStatus = payoutResource?.transaction_status;

    if (paypalBatchId && transactionStatus) {
      const kobStatus = mapPayPalStatus(transactionStatus);

      // Update payout status
      const { data: payoutRecord } = await supabase
        .from('gateway_payouts')
        .select('*')
        .eq('provider_ref', paypalBatchId)
        .single();

      if (payoutRecord) {
        await supabase
          .from('gateway_payouts')
          .update({
            status: kobStatus,
            completed_at: kobStatus === 'successful' ? new Date().toISOString() : null,
            error_message: kobStatus === 'failed' ? `PayPal: ${transactionStatus}` : null,
          })
          .eq('id', payoutRecord.id);

        // Handle withdrawal reversal on failure
        if (kobStatus === 'failed' && payoutRecord.metadata?.withdrawal_account_id) {
          const accountId = payoutRecord.metadata.withdrawal_account_id;
          const { data: balance } = await supabase
            .from('account_balances')
            .select('*')
            .eq('account_id', accountId)
            .eq('balance_type', 'InterimAvailable')
            .single();

          if (balance) {
            await supabase
              .from('account_balances')
              .update({ amount: balance.amount + payoutRecord.amount })
              .eq('id', balance.id);
          }
        }

        // Deliver to merchant outbound webhooks
        const webhookEvent = kobStatus === 'successful' ? 'payout.completed' : 'payout.failed';
        try {
          await supabase.functions.invoke('gateway-deliver-webhook', {
            body: {
              merchant_id: payoutRecord.merchant_id,
              event_type: webhookEvent,
              data: {
                payout_id: payoutRecord.id,
                status: kobStatus,
                amount: payoutRecord.amount,
                currency: payoutRecord.currency,
                provider: 'paypal',
                provider_ref: paypalBatchId,
                tx_ref: payoutRecord.tx_ref,
              },
            },
          });
        } catch (e) {
          console.error('Merchant webhook delivery failed:', e);
        }

        // Audit log
        await supabase.from('audit_logs').insert({
          action_type: `paypal_webhook_${eventType.toLowerCase().replace(/\./g, '_')}`,
          entity_type: 'gateway_payout',
          entity_id: payoutRecord.id,
          details: { event_id: eventId, event_type: eventType, status: kobStatus, paypal_batch_id: paypalBatchId },
        });
      }
    }

    // ─── Funding Intents: handle PayPal checkout/capture events ───
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = payoutResource?.supplementary_data?.related_ids?.order_id || payoutResource?.id;
      if (orderId) {
        const { data: fundingIntent } = await supabase.from('funding_intents').select('*').eq('provider_reference', orderId).in('status', ['pending_provider', 'pending_customer_action', 'pending_verification', 'created']).maybeSingle();

        if (fundingIntent) {
          if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
            await supabase.from('funding_intents').update({
              status: 'succeeded', provider_payload: event,
            }).eq('id', fundingIntent.id);

            await supabase.from('funding_events').insert({
              funding_intent_id: fundingIntent.id, event_type: 'webhook_succeeded',
              payload: { provider: 'paypal', order_id: orderId },
            });

            // Credit account
            await supabase.from('account_balances').insert({
              account_id: fundingIntent.account_id, balance_type: 'InterimAvailable',
              amount: fundingIntent.net_amount || fundingIntent.amount, currency: fundingIntent.currency,
              credit_debit_indicator: 'Credit', balance_datetime: new Date().toISOString(),
            });
            await supabase.from('transactions').insert({
              account_id: fundingIntent.account_id, amount: fundingIntent.net_amount || fundingIntent.amount,
              currency: fundingIntent.currency, credit_debit_indicator: 'Credit', status: 'Booked',
              booking_date_time: new Date().toISOString(), value_date_time: new Date().toISOString(),
              transaction_information: `Account funding via PayPal - ${fundingIntent.reference}`,
              transaction_reference: fundingIntent.reference, user_id: fundingIntent.user_id,
            });
            await supabase.from('audit_logs').insert({
              action_type: 'funding_intent_succeeded', entity_type: 'funding_intent', entity_id: fundingIntent.id,
              performed_by: fundingIntent.user_id, details: { amount: fundingIntent.amount, method: 'paypal' },
            });
          } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
            // Auto-capture the order
            try {
              const { getPayPalAccessToken: getPPToken } = await import("../_shared/gateway-adapters.ts");
              const ppToken = await getPPToken();
              await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ppToken}`, 'Content-Type': 'application/json' },
              });
              await supabase.from('funding_events').insert({
                funding_intent_id: fundingIntent.id, event_type: 'paypal_auto_capture_initiated',
                payload: { order_id: orderId },
              });
            } catch (e) {
              console.error('PayPal auto-capture failed:', e);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: 'processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPayPalWebhookSignature, mapPayPalStatus } from "../_shared/gateway-adapters.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";

import { corsHeaders } from "../_shared/cors.ts";

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
    const dedupeKey = `paypal_${eventId}`;
    const { data: existing } = await supabase
      .from('webhook_inbox')
      .select('id')
      .eq('event_id', dedupeKey)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store in webhook_inbox
    await supabase.from('webhook_inbox').insert({
      event_id: dedupeKey,
      provider: 'paypal',
      event_type: eventType,
      payload: event,
      status: 'processing',
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

        // Handle withdrawal reversal on failure (H2 fix: check both balance types)
        if (kobStatus === 'failed' && payoutRecord.metadata?.withdrawal_account_id) {
          const accountId = payoutRecord.metadata.withdrawal_account_id;
          // Try ClosingAvailable first (primary), then InterimAvailable
          let balance = null;
          const { data: closingBal } = await supabase
            .from('account_balances')
            .select('*')
            .eq('account_id', accountId)
            .eq('balance_type', 'ClosingAvailable')
            .eq('credit_debit_indicator', 'Credit')
            .maybeSingle();
          balance = closingBal;

          if (!balance) {
            const { data: interimBal } = await supabase
              .from('account_balances')
              .select('*')
              .eq('account_id', accountId)
              .eq('balance_type', 'InterimAvailable')
              .eq('credit_debit_indicator', 'Credit')
              .maybeSingle();
            balance = interimBal;
          }

          if (balance) {
            await supabase
              .from('account_balances')
              .update({ amount: balance.amount + payoutRecord.amount })
              .eq('id', balance.id);
          } else {
            // Create new balance record if neither exists
            await supabase.from('account_balances').insert({
              account_id: accountId, balance_type: 'ClosingAvailable',
              credit_debit_indicator: 'Credit', amount: payoutRecord.amount,
              currency: payoutRecord.currency || 'USD',
              balance_datetime: new Date().toISOString(),
            });
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

            // Credit via scope-aware creditor
            await creditFundingIntent(supabase, fundingIntent);
          } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
            // Auto-capture the order
            try {
              const { getPayPalAccessToken: getPPToken } = await import("../_shared/gateway-adapters.ts");
              const ppToken = await getPPToken();
              await fetch(`${typeof Deno !== "undefined" && Deno.env.get('PAYPAL_ENVIRONMENT') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'}/v2/checkout/orders/${orderId}/capture`, {
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
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] PayPal webhook error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

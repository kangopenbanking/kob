import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapFlutterwaveStatus,
  mapPayPalStatus,
} from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Unified Payout Webhook Handler
 * Receives async status updates from Stripe, Flutterwave, and PayPal
 * and automatically finalizes payout/withdrawal records.
 * 
 * POST /gateway-payout-webhook?provider=stripe|flutterwave|paypal
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') || 'unknown';
    const rawBody = await req.text();

    console.log(`[Payout Webhook] Provider: ${provider}, body length: ${rawBody.length}`);

    let event: any;
    try { event = JSON.parse(rawBody); } catch { 
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    let providerRef = '';
    let newStatus = '';
    let txRef = '';

    // ─── Stripe: refund.updated or charge.refunded ───
    if (provider === 'stripe') {
      const stripeEvent = event;
      const obj = stripeEvent.data?.object;
      if (!obj) return new Response('OK', { headers: corsHeaders });

      providerRef = obj.id || '';
      txRef = obj.metadata?.tx_ref || '';

      if (obj.status === 'succeeded') newStatus = 'completed';
      else if (obj.status === 'failed') newStatus = 'failed';
      else newStatus = 'processing';

      console.log(`[Stripe Webhook] Refund ${providerRef} → ${newStatus}`);
    }

    // ─── Flutterwave: transfer.completed / transfer.failed ───
    else if (provider === 'flutterwave') {
      const flwData = event.data || event;
      providerRef = flwData.id?.toString() || '';
      txRef = flwData.reference || '';
      const flwStatus = mapFlutterwaveStatus(flwData.status || 'pending');

      if (flwStatus === 'successful') newStatus = 'completed';
      else if (flwStatus === 'failed') newStatus = 'failed';
      else newStatus = 'processing';

      console.log(`[Flutterwave Webhook] Transfer ${providerRef} → ${newStatus}`);
    }

    // ─── PayPal: PAYMENT.PAYOUTS-ITEM.SUCCEEDED / FAILED ───
    else if (provider === 'paypal') {
      const ppResource = event.resource || {};
      providerRef = ppResource.payout_batch_id || ppResource.payout_item_id || '';
      txRef = ppResource.payout_item?.sender_item_id || '';
      const ppStatus = mapPayPalStatus(ppResource.transaction_status || event.event_type?.includes('SUCCEEDED') ? 'SUCCESS' : 'PENDING');

      if (ppStatus === 'successful') newStatus = 'completed';
      else if (ppStatus === 'failed') newStatus = 'failed';
      else newStatus = 'processing';

      console.log(`[PayPal Webhook] Payout ${providerRef} → ${newStatus}`);
    }

    if (!newStatus || newStatus === 'processing') {
      return new Response(JSON.stringify({ received: true, status: 'no_action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Update gateway_payouts record ───
    const matchFilter = providerRef 
      ? { column: 'provider_ref', value: providerRef }
      : { column: 'tx_ref', value: txRef };

    const { data: payout, error: fetchErr } = await supabase
      .from('gateway_payouts')
      .select('*')
      .eq(matchFilter.column, matchFilter.value)
      .in('status', ['processing', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payout) {
      console.log(`[Payout Webhook] No pending payout found for ${matchFilter.column}=${matchFilter.value}`);
      return new Response(JSON.stringify({ received: true, status: 'not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payout status
    await supabase.from('gateway_payouts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', payout.id);

    // Update corresponding transaction
    if (payout.tx_ref) {
      await supabase.from('transactions')
        .update({ 
          status: newStatus === 'completed' ? 'completed' : 'failed',
          transaction_information: `Withdrawal ${newStatus} via ${provider}`,
        })
        .eq('metadata->>tx_ref', payout.tx_ref)
        .eq('transaction_type', 'withdrawal');
    }

    // If failed, reverse the balance debit
    if (newStatus === 'failed' && payout.metadata?.account_id && payout.metadata?.user_id) {
      const { data: balanceRecord } = await supabase
        .from('account_balances')
        .select('*')
        .eq('account_id', payout.metadata.account_id)
        .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
        .order('balance_datetime', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceRecord) {
        const restoredAmount = balanceRecord.amount + payout.amount + (payout.fee_amount || 0);
        await supabase.from('account_balances')
          .update({ amount: restoredAmount, balance_datetime: new Date().toISOString() })
          .eq('id', balanceRecord.id);

        console.log(`[Payout Webhook] Reversed ${payout.amount} + fee ${payout.fee_amount} back to account ${payout.metadata.account_id}`);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: `payout_webhook_${newStatus}`,
      entity_type: 'gateway_payout',
      entity_id: payout.id,
      performed_by: payout.metadata?.user_id || null,
      details: { provider, provider_ref: providerRef, tx_ref: txRef, new_status: newStatus },
    });

    return new Response(JSON.stringify({ 
      received: true, 
      payout_id: payout.id, 
      status: newStatus,
      automated: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[Payout Webhook] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

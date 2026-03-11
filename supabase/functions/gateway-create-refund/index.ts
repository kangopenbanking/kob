import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createStripeRefund, createFlutterwavePayout } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { charge_id, amount, reason } = body;

    if (!charge_id) return new Response(JSON.stringify({ error: 'charge_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get original charge
    const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', charge_id).single();
    if (!charge || charge.gateway_merchants.user_id !== user.id) return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (charge.status !== 'successful') return new Response(JSON.stringify({ error: 'charge_not_refundable', message: 'Only successful charges can be refunded' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const refundAmount = amount || charge.amount;

    // ─── G3/G10 FIX: Over-refund guard ───
    const { data: existingRefunds } = await supabase.from('gateway_refunds')
      .select('amount').eq('charge_id', charge_id).in('status', ['pending', 'processing', 'successful']);
    const totalRefunded = (existingRefunds || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    if (totalRefunded + refundAmount > charge.amount) {
      return new Response(JSON.stringify({
        error: 'over_refund',
        message: `Cannot refund ${refundAmount}. Already refunded: ${totalRefunded}. Max remaining: ${charge.amount - totalRefunded}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;

    if (idempotencyKey) {
      const { data: existing } = await supabase.from('gateway_refunds').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', charge.merchant_id).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    const { data: refund, error: insertErr } = await supabase.from('gateway_refunds').insert({
      charge_id, merchant_id: charge.merchant_id, amount: refundAmount,
      currency: charge.currency, status: 'pending', reason,
      provider: charge.provider, idempotency_key: idempotencyKey,
    }).select().single();

    if (insertErr) throw insertErr;

    try {
      let result;
      if (charge.provider === 'stripe') {
        result = await createStripeRefund({ provider_ref: charge.provider_ref, amount: refundAmount, currency: charge.currency, reason: reason || undefined });
      } else {
        // MoMo: compensation payout
        result = await createFlutterwavePayout({
          amount: refundAmount, currency: charge.currency, channel: 'mobile_money',
          beneficiary_phone: charge.customer_phone, beneficiary_name: charge.customer_name || 'Customer',
          narration: `Refund for ${charge.tx_ref}`, tx_ref: `refund_${refund.id}`,
        });
      }

      await supabase.from('gateway_refunds').update({ status: result.status, provider_ref: result.provider_ref, provider_raw: result.provider_raw }).eq('id', refund.id);
      refund.status = result.status;
      refund.provider_ref = result.provider_ref;

      // ─── G8 FIX: Debit merchant wallet on successful refund ───
      if (result.status === 'successful' && charge.merchant_id) {
        await supabase.rpc('update_merchant_wallet', {
          _merchant_id: charge.merchant_id,
          _currency: charge.currency,
          _available_delta: -refundAmount,
          _ledger_delta: -refundAmount,
        });
      }

      // Emit refund webhook event
      const eventType = result.status === 'successful' ? 'refund.completed' : 'refund.failed';
      await supabase.from('gateway_webhook_events').insert({
        merchant_id: charge.merchant_id,
        event_type: eventType,
        payload: { refund_id: refund.id, charge_id: charge.id, status: result.status, amount: refundAmount, currency: charge.currency },
        status: 'pending', next_retry_at: new Date().toISOString(),
      });
    } catch (providerErr) {
      await supabase.from('gateway_refunds').update({ status: 'failed' }).eq('id', refund.id);
      refund.status = 'failed';

      // Emit refund.failed webhook event
      await supabase.from('gateway_webhook_events').insert({
        merchant_id: charge.merchant_id,
        event_type: 'refund.failed',
        payload: { refund_id: refund.id, charge_id: charge.id, status: 'failed', amount: refundAmount },
        status: 'pending', next_retry_at: new Date().toISOString(),
      });
    }
    // M8 FIX: Audit trail for refunds
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_refund_created', entity_type: 'gateway_refund', entity_id: refund.id,
      performed_by: user.id, details: { charge_id, merchant_id: charge.merchant_id, amount: refundAmount, currency: charge.currency, status: refund.status, reason },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify(refund), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-refund error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

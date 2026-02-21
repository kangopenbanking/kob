import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createStripeRefund, createFlutterwavePayout } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

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
        result = await createStripeRefund({ provider_ref: charge.provider_ref, amount: refundAmount, reason });
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
    } catch (providerErr) {
      await supabase.from('gateway_refunds').update({ status: 'failed' }).eq('id', refund.id);
      refund.status = 'failed';
    }

    return new Response(JSON.stringify(refund), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

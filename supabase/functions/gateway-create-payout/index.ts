import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFeeSync } from "../_shared/gateway-adapters.ts";

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
    const { merchant_id, amount, currency = 'XAF', channel, beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone, narration, tx_ref, metadata } = body;

    if (!merchant_id || !amount || !channel || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Daily payout limit check
    if (merchant.daily_payout_limit) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: dailyPayouts } = await supabase.from('gateway_payouts').select('amount').eq('merchant_id', merchant_id).gte('created_at', todayStart.toISOString()).in('status', ['pending', 'processing', 'successful']);
      const dailyTotal = (dailyPayouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      if (dailyTotal + amount > merchant.daily_payout_limit) {
        return new Response(JSON.stringify({ error: 'daily_payout_limit_exceeded', message: `Daily payout limit of ${merchant.daily_payout_limit} would be exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('gateway_payouts').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', merchant_id).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    const { fee } = calculateGatewayFee(amount, channel);

    const { data: payout, error: insertErr } = await supabase.from('gateway_payouts').insert({
      merchant_id, amount, currency, channel, status: 'pending', provider: 'flutterwave',
      beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone,
      narration, tx_ref, fee_amount: fee, metadata: metadata || {},
      idempotency_key: idempotencyKey,
    }).select().single();

    if (insertErr) throw insertErr;

    try {
      const result = await createFlutterwavePayout({ amount, currency, channel, beneficiary_account, beneficiary_bank, beneficiary_phone, beneficiary_name, narration, tx_ref });
      await supabase.from('gateway_payouts').update({ status: result.status, provider_ref: result.provider_ref, provider_raw: result.provider_raw }).eq('id', payout.id);
      payout.status = result.status;
      payout.provider_ref = result.provider_ref;
    } catch (providerErr) {
      await supabase.from('gateway_payouts').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', payout.id);
      payout.status = 'failed';
      payout.failure_reason = providerErr.message;
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_payout_created', entity_type: 'gateway_payout', entity_id: payout.id,
      performed_by: user.id, details: { merchant_id, amount, channel, status: payout.status, tx_ref },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify(payout), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

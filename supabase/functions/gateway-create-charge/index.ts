import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, amount, currency = 'XAF', channel, customer_email, customer_phone, customer_name, tx_ref, metadata } = body;

    if (!merchant_id || !amount || !channel || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, amount, channel, tx_ref are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify merchant ownership
    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ─── Limit & Velocity Checks ───
    // Single charge limit
    if (merchant.single_charge_limit && amount > merchant.single_charge_limit) {
      return new Response(JSON.stringify({ error: 'limit_exceeded', message: `Amount exceeds single charge limit of ${merchant.single_charge_limit}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Daily charge limit
    if (merchant.daily_charge_limit) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: dailyCharges } = await supabase.from('gateway_charges').select('amount').eq('merchant_id', merchant_id).gte('created_at', todayStart.toISOString()).in('status', ['pending', 'processing', 'successful']);
      const dailyTotal = (dailyCharges || []).reduce((sum, c) => sum + (c.amount || 0), 0);
      if (dailyTotal + amount > merchant.daily_charge_limit) {
        return new Response(JSON.stringify({ error: 'daily_limit_exceeded', message: `Daily charge limit of ${merchant.daily_charge_limit} would be exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Velocity check (max charges in time window)
    if (merchant.velocity_max_charges && merchant.velocity_window_minutes) {
      const windowStart = new Date(Date.now() - merchant.velocity_window_minutes * 60 * 1000).toISOString();
      const { count } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant_id).gte('created_at', windowStart);
      if ((count || 0) >= merchant.velocity_max_charges) {
        return new Response(JSON.stringify({ error: 'velocity_exceeded', message: `Max ${merchant.velocity_max_charges} charges per ${merchant.velocity_window_minutes} minutes exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Idempotency
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('gateway_charges').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', merchant_id).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    // Fee calculation
    const { fee, net } = calculateGatewayFee(amount, channel);

    // Determine provider
    const provider = channel === 'card' ? 'stripe' : 'flutterwave';

    // Create charge record
    const { data: charge, error: insertErr } = await supabase.from('gateway_charges').insert({
      merchant_id, amount, currency, channel, status: 'pending', provider,
      customer_email, customer_phone, customer_name, tx_ref,
      fee_amount: fee, net_amount: net, metadata: metadata || {},
      idempotency_key: idempotencyKey,
    }).select().single();

    if (insertErr) throw insertErr;

    // Call provider
    let providerResult;
    try {
      if (provider === 'flutterwave') {
        providerResult = await createFlutterwaveCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
      } else {
        providerResult = await createStripeCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
      }

      await supabase.from('gateway_charges').update({
        status: providerResult.status,
        provider_ref: providerResult.provider_ref,
        provider_raw: providerResult.provider_raw,
      }).eq('id', charge.id);

      charge.status = providerResult.status;
      charge.provider_ref = providerResult.provider_ref;
    } catch (providerErr) {
      await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', charge.id);
      charge.status = 'failed';
      charge.failure_reason = providerErr.message;
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_charge_created', entity_type: 'gateway_charge', entity_id: charge.id,
      performed_by: user.id, details: { merchant_id, amount, channel, status: charge.status, tx_ref },
    }).then(() => {}).catch(() => {}); // fire-and-forget

    return new Response(JSON.stringify(charge), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFeeSync } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, token_id, amount, currency = 'XAF', tx_ref, metadata } = body;

    if (!merchant_id || !token_id || !amount || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, token_id, amount, tx_ref are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get token with customer info
    const { data: token } = await supabase
      .from('gateway_customer_tokens')
      .select('*, gateway_customers!inner(merchant_id, email, phone, name)')
      .eq('id', token_id)
      .eq('is_active', true)
      .single();

    if (!token || token.gateway_customers.merchant_id !== merchant_id) {
      return new Response(JSON.stringify({ error: 'token_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { fee, net } = calculateGatewayFee(amount, token.channel);
    const provider = token.provider;

    // Create charge record
    const { data: charge, error: insertErr } = await supabase.from('gateway_charges').insert({
      merchant_id, amount, currency, channel: token.channel, status: 'pending', provider,
      customer_email: token.gateway_customers.email, customer_phone: token.gateway_customers.phone,
      customer_name: token.gateway_customers.name, tx_ref,
      fee_amount: fee, net_amount: net, metadata: { ...metadata, token_id },
    }).select().single();

    if (insertErr) throw insertErr;

    // Charge via provider using token
    let providerResult;
    try {
      const chargeReq = {
        amount, currency, channel: token.channel,
        customer_email: token.gateway_customers.email,
        customer_phone: token.gateway_customers.phone,
        customer_name: token.gateway_customers.name,
        tx_ref, metadata: { ...metadata, token_ref: token.token_ref },
      };

      if (provider === 'flutterwave') {
        providerResult = await createFlutterwaveCharge(chargeReq);
      } else {
        providerResult = await createStripeCharge(chargeReq);
      }

      await supabase.from('gateway_charges').update({
        status: providerResult.status, provider_ref: providerResult.provider_ref, provider_raw: providerResult.provider_raw,
      }).eq('id', charge.id);

      charge.status = providerResult.status;
      charge.provider_ref = providerResult.provider_ref;
    } catch (providerErr) {
      await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', charge.id);
      charge.status = 'failed';
      charge.failure_reason = providerErr.message;
    }

    // Charge event
    await supabase.from('gateway_charge_events').insert({
      charge_id: charge.id, event_type: 'charge.created_via_token',
      details: { token_id, provider, status: charge.status },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify(charge), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

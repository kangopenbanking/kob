import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateGatewayFee } from "../_shared/gateway-adapters.ts";

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { merchant_id, amount, currency = 'USD', customer_email, customer_name, tx_ref, metadata } = await req.json();
    if (!merchant_id || !amount || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, amount, tx_ref are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { fee, net } = calculateGatewayFee(amount, 'card');

    // Create Stripe PaymentIntent with manual capture
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        amount: Math.round(amount * 100).toString(),
        currency: currency.toLowerCase(),
        capture_method: 'manual',
        ...(customer_email ? { receipt_email: customer_email } : {}),
        'metadata[tx_ref]': tx_ref,
        'metadata[merchant_id]': merchant_id,
      }),
    });
    const piData = await stripeRes.json();

    if (piData.error) throw new Error(piData.error.message);

    const { data: charge } = await supabase.from('gateway_charges').insert({
      merchant_id, amount, currency, channel: 'card', status: 'authorized',
      provider: 'stripe', provider_ref: piData.id,
      customer_email, customer_name, tx_ref,
      fee_amount: fee, net_amount: net, metadata: metadata || {},
      capture_mode: 'manual', captured_amount: 0,
    }).select().single();

    await supabase.from('gateway_charge_events').insert({
      charge_id: charge.id, event_type: 'charge.authorized',
      details: { client_secret: piData.client_secret, provider_ref: piData.id },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ ...charge, client_secret: piData.client_secret }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

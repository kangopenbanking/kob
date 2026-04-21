import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateGatewayFee, toStripeAmount } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const { merchant_id, amount, currency = 'USD', customer_email, customer_name, tx_ref, metadata } = await req.json();
    if (!merchant_id || !amount || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, amount, tx_ref are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { fee, net } = await calculateGatewayFee(amount, 'card', supabase, { merchantId: merchant_id });

    // Create Stripe PaymentIntent with manual capture
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        amount: toStripeAmount(amount, currency).toString(),
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
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] preauth-charge error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

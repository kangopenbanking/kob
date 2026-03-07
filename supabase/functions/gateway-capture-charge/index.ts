import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { charge_id, amount } = await req.json();
    if (!charge_id) return new Response(JSON.stringify({ error: 'missing_fields', message: 'charge_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', charge_id).single();
    if (!charge || charge.gateway_merchants.user_id !== user.id) return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (charge.capture_mode !== 'manual' || charge.status !== 'authorized') {
      return new Response(JSON.stringify({ error: 'invalid_state', message: 'Charge must be authorized with manual capture_mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const captureAmount = amount || charge.amount;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ amount_to_capture: Math.round(captureAmount * 100).toString() }),
    });
    const piData = await stripeRes.json();

    if (piData.error) throw new Error(piData.error.message);

    await supabase.from('gateway_charges').update({
      status: 'successful', captured_amount: captureAmount,
    }).eq('id', charge.id);

    // Update wallet
    await supabase.rpc('update_merchant_wallet', {
      _merchant_id: charge.merchant_id, _currency: charge.currency,
      _pending_delta: charge.net_amount || captureAmount,
      _ledger_delta: charge.net_amount || captureAmount,
    });

    await supabase.from('gateway_charge_events').insert({
      charge_id: charge.id, event_type: 'charge.captured',
      details: { captured_amount: captureAmount },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ id: charge.id, status: 'successful', captured_amount: captureAmount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { charge_id } = await req.json();
    if (!charge_id) return new Response(JSON.stringify({ error: 'charge_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', charge_id).single();
    if (!charge || charge.gateway_merchants.user_id !== user.id) return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (charge.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'only_pending_charges_can_be_cancelled' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cancel with Stripe if card
    if (charge.provider === 'stripe' && charge.provider_ref) {
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      if (STRIPE_SECRET) {
        await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
        });
      }
    }

    await supabase.from('gateway_charges').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', charge_id);

    const { gateway_merchants, ...chargeData } = charge;
    return new Response(JSON.stringify({ ...chargeData, status: 'cancelled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

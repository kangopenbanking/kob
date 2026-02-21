import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapFlutterwaveStatus, mapStripeStatus } from "../_shared/gateway-adapters.ts";

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

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const chargeId = url.searchParams.get('id');
    if (!chargeId) return new Response(JSON.stringify({ error: 'id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', chargeId).single();
    if (!charge || charge.gateway_merchants.user_id !== user.id) return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let providerStatus = charge.status;
    let providerData = null;

    // Poll Flutterwave
    if (charge.provider === 'flutterwave' && charge.provider_ref) {
      const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (FLW_SECRET) {
        try {
          const res = await fetch(`https://api.flutterwave.com/v3/transactions/${charge.provider_ref}/verify`, {
            headers: { Authorization: `Bearer ${FLW_SECRET}` },
          });
          const data = await res.json();
          providerData = data;
          if (data.data?.status) {
            providerStatus = mapFlutterwaveStatus(data.data.status);
          }
        } catch (e) {
          console.error('FLW verify error:', e);
        }
      }
    }

    // Poll Stripe
    if (charge.provider === 'stripe' && charge.provider_ref) {
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      if (STRIPE_SECRET) {
        try {
          const res = await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
          });
          const data = await res.json();
          providerData = data;
          if (data.status) {
            providerStatus = mapStripeStatus(data.status);
          }
        } catch (e) {
          console.error('Stripe verify error:', e);
        }
      }
    }

    // Update if status changed
    if (providerStatus !== charge.status) {
      await supabase.from('gateway_charges').update({
        status: providerStatus,
        provider_raw: providerData || charge.provider_raw,
        updated_at: new Date().toISOString(),
      }).eq('id', chargeId);
    }

    const { gateway_merchants, ...chargeData } = charge;
    return new Response(JSON.stringify({
      ...chargeData,
      status: providerStatus,
      verified: true,
      verified_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

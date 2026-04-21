import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapFlutterwaveStatus, mapStripeStatus, mapPayPalStatus, getPayPalAccessToken } from "../_shared/gateway-adapters.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

import { corsHeaders } from "../_shared/cors.ts";

const TERMINAL = new Set(["successful", "failed", "cancelled", "refunded"]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth — supports sk_test_/sk_live_ API keys + JWT
    const authResult = await resolveAuth(req, supabase);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;

    const url = new URL(req.url);
    let chargeId = url.searchParams.get('id');
    if (!chargeId) {
      // Path: /v1/gateway/charges/{id}/verify
      const m = url.pathname.match(/charges\/([^/]+)\/verify/);
      if (m) chargeId = m[1];
    }
    if (!chargeId && req.method === 'POST') {
      try { const b = await req.json(); chargeId = b?.id || b?.charge_id; } catch { /* no body */ }
    }
    if (!chargeId) return new Response(JSON.stringify({ error: 'id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: charge } = await supabase
      .from('gateway_charges')
      .select('*, gateway_merchants!inner(user_id)')
      .eq('id', chargeId)
      .single();

    if (!charge) {
      return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authorization: API-key callers must own the merchant; merchant_id from key must match
    if (auth.merchant_id && charge.merchant_id !== auth.merchant_id) {
      return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!auth.merchant_id && charge.gateway_merchants.user_id !== auth.user_id) {
      return new Response(JSON.stringify({ error: 'charge_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Terminal → return as-is, no upstream call
    if (TERMINAL.has(charge.status)) {
      const { gateway_merchants, ...chargeData } = charge;
      return new Response(JSON.stringify({ ...chargeData, verified: true, verified_at: new Date().toISOString(), upstream_polled: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let providerStatus = charge.status;
    let providerData: any = null;
    let upstreamPolled = false;

    // ─── Flutterwave (mobile_money / bank_transfer / ussd / fallback card) ───
    if (charge.provider === 'flutterwave' && charge.provider_ref) {
      const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (FLW_SECRET) {
        try {
          const res = await fetch(`https://api.flutterwave.com/v3/transactions/${charge.provider_ref}/verify`, {
            headers: { Authorization: `Bearer ${FLW_SECRET}` },
          });
          providerData = await res.json();
          upstreamPolled = true;
          if (providerData?.data?.status) {
            providerStatus = mapFlutterwaveStatus(providerData.data.status);
          }
          console.log(`[verify-charge] FLW poll for ${charge.id}: ${providerData?.data?.status} → ${providerStatus}`);
        } catch (e) {
          console.error('FLW verify error:', e);
        }
      }
    }

    // ─── Stripe (card / apple_pay / google_pay) ───
    if (charge.provider === 'stripe' && charge.provider_ref) {
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      if (STRIPE_SECRET) {
        try {
          const res = await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
          });
          providerData = await res.json();
          upstreamPolled = true;
          if (providerData?.status) {
            providerStatus = mapStripeStatus(providerData.status);
          }
          console.log(`[verify-charge] Stripe poll for ${charge.id}: ${providerData?.status} → ${providerStatus}`);
        } catch (e) {
          console.error('Stripe verify error:', e);
        }
      }
    }

    // ─── PayPal ───
    if (charge.provider === 'paypal' && charge.provider_ref) {
      try {
        const token = await getPayPalAccessToken();
        const ppEnv = Deno.env.get('PAYPAL_ENVIRONMENT') || 'production';
        const base = ppEnv === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
        const res = await fetch(`${base}/v2/checkout/orders/${charge.provider_ref}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        providerData = await res.json();
        upstreamPolled = true;
        if (providerData?.status) {
          providerStatus = mapPayPalStatus(providerData.status);
        }
      } catch (e) {
        console.error('PayPal verify error:', e);
      }
    }

    // Persist + emit webhook event on transition
    if (providerStatus !== charge.status) {
      await supabase.from('gateway_charges').update({
        status: providerStatus,
        provider_raw: providerData || charge.provider_raw,
        updated_at: new Date().toISOString(),
      }).eq('id', chargeId);

      await supabase.from('gateway_charge_events').insert({
        charge_id: chargeId,
        event_type: `charge.${providerStatus}`,
        details: { source: 'verify_poll', previous_status: charge.status, provider: charge.provider },
      }).then(() => {}).catch(() => {});
    }

    const { gateway_merchants, ...chargeData } = charge;
    return new Response(JSON.stringify({
      ...chargeData,
      status: providerStatus,
      verified: true,
      verified_at: new Date().toISOString(),
      upstream_polled: upstreamPolled,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] verify-charge error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

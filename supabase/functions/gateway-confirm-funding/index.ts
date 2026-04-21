import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapStripeStatus, mapFlutterwaveStatus } from "../_shared/gateway-adapters.ts";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

/**
 * gateway-confirm-funding
 * Called by the frontend after a client-side payment confirmation (e.g. Stripe confirmCardPayment).
 * Polls the provider to verify the payment succeeded and finalizes the funding intent.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const claims = { user: { id: __authResult.auth!.user_id, email: __authResult.auth!.email } } as any;

    const { funding_intent_id } = await req.json();
    if (!funding_intent_id) {
      return new Response(JSON.stringify({ error: 'missing_funding_intent_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch the funding intent
    const { data: intent } = await supabase
      .from('funding_intents')
      .select('*')
      .eq('id', funding_intent_id)
      .in('status', ['pending_provider', 'pending_customer_action', 'pending_verification', 'created'])
      .maybeSingle();

    if (!intent) {
      // Could be already succeeded — return current status
      const { data: current } = await supabase.from('funding_intents').select('id, status').eq('id', funding_intent_id).maybeSingle();
      return new Response(JSON.stringify({ status: current?.status || 'not_found', already_processed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Poll the provider for current status
    let providerStatus = 'pending';
    let providerData: any = null;

    if (intent.provider === 'stripe' && intent.provider_reference) {
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intent.provider_reference}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
      });
      providerData = await res.json();
      providerStatus = mapStripeStatus(providerData.status || 'pending');
      console.log('[ConfirmFunding] Stripe PI status:', providerData.status, '→', providerStatus);

    } else if (intent.provider === 'flutterwave' && intent.reference) {
      const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (!FLW_SECRET) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

      const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${intent.reference}`, {
        headers: { Authorization: `Bearer ${FLW_SECRET}` },
      });
      providerData = await res.json();
      const rawStatus = providerData.data?.status || providerData.status || 'pending';
      providerStatus = mapFlutterwaveStatus(rawStatus);

      // For mobile money, Flutterwave verify returns "failed" when user hasn't approved yet.
      // Treat as pending if the intent is less than 2 minutes old.
      const intentAgeMs = Date.now() - new Date(intent.created_at).getTime();
      const TWO_MINUTES = 2 * 60 * 1000;
      if (providerStatus === 'failed' && intent.method === 'mobile_money' && intentAgeMs < TWO_MINUTES) {
        console.log('[ConfirmFunding] Flutterwave MoMo returned "failed" but intent is only', Math.round(intentAgeMs / 1000), 's old — treating as pending');
        providerStatus = 'processing';
      }

      console.log('[ConfirmFunding] Flutterwave status:', rawStatus, '→', providerStatus);
    }

    // Finalize if terminal
    if (providerStatus === 'successful' || providerStatus === 'failed' || providerStatus === 'cancelled') {
      const fiStatus = providerStatus === 'successful' ? 'succeeded' : providerStatus === 'cancelled' ? 'cancelled' : 'failed';

      await supabase.from('funding_intents').update({
        status: fiStatus,
        provider_payload: providerData,
        failure_message: fiStatus === 'failed' ? `Provider: ${intent.provider} reported failure` : null,
      }).eq('id', intent.id);

      await supabase.from('funding_events').insert({
        funding_intent_id: intent.id,
        event_type: `confirmed_${fiStatus}`,
        payload: { provider: intent.provider, confirmed_by: 'client_poll' },
      });

      if (fiStatus === 'succeeded') {
        await creditFundingIntent(supabase, intent);
      }

      return new Response(JSON.stringify({ status: fiStatus, funded: fiStatus === 'succeeded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Still pending
    return new Response(JSON.stringify({ status: 'pending', provider_status: providerStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] Confirm funding error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

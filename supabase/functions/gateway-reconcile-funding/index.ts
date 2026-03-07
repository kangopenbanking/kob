import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayPalAccessToken, mapFlutterwaveStatus, mapStripeStatus } from "../_shared/gateway-adapters.ts";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get stuck intents
    const { data: stuckIntents } = await supabase
      .from('funding_intents')
      .select('*')
      .in('status', ['pending_provider', 'pending_customer_action', 'pending_verification', 'created'])
      .lt('created_at', thirtyMinAgo)
      .limit(50);

    if (!stuckIntents?.length) {
      return new Response(JSON.stringify({ reconciled: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let reconciled = 0;

    for (const intent of stuckIntents) {
      try {
        // Expire very old intents
        if (intent.created_at < twentyFourHoursAgo) {
          await supabase.from('funding_intents').update({ status: 'expired' }).eq('id', intent.id);
          await supabase.from('funding_events').insert({
            funding_intent_id: intent.id, event_type: 'expired',
            payload: { reason: 'auto_expired_after_24h' },
          });
          reconciled++;
          continue;
        }

        // Poll provider status
        if (intent.provider === 'flutterwave' && intent.provider_reference) {
          const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
          if (FLW_SECRET) {
            const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${intent.reference}`, {
              headers: { Authorization: `Bearer ${FLW_SECRET}` },
            });
            const data = await res.json();
            const providerStatus = mapFlutterwaveStatus(data.data?.status || 'pending');
            if (providerStatus === 'successful' || providerStatus === 'failed') {
              await finalizeIntent(supabase, intent, providerStatus, data);
              reconciled++;
            }
          }
        } else if (intent.provider === 'stripe' && intent.provider_reference) {
          const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
          if (STRIPE_SECRET) {
            const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intent.provider_reference}`, {
              headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
            });
            const data = await res.json();
            const providerStatus = mapStripeStatus(data.status || 'pending');
            if (providerStatus === 'successful' || providerStatus === 'failed' || providerStatus === 'cancelled') {
              await finalizeIntent(supabase, intent, providerStatus, data);
              reconciled++;
            }
          }
        } else if (intent.provider === 'paypal' && intent.provider_reference) {
          try {
            const ppToken = await getPayPalAccessToken();
            const res = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${intent.provider_reference}`, {
              headers: { Authorization: `Bearer ${ppToken}` },
            });
            const data = await res.json();
            if (data.status === 'COMPLETED') {
              await finalizeIntent(supabase, intent, 'successful', data);
              reconciled++;
            } else if (data.status === 'VOIDED') {
              await finalizeIntent(supabase, intent, 'failed', data);
              reconciled++;
            }
          } catch (e) {
            console.error(`PayPal reconcile failed for ${intent.id}:`, e);
          }
        }
      } catch (e) {
        console.error(`Reconcile error for intent ${intent.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ reconciled, total_checked: stuckIntents.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Reconcile funding error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function finalizeIntent(supabase: any, intent: any, finalStatus: string, providerData: any) {
  // Normalize status: provider returns 'successful' but our domain uses 'succeeded'
  const normalizedStatus = finalStatus === 'successful' ? 'succeeded' : finalStatus;

  await supabase.from('funding_intents').update({
    status: normalizedStatus,
    provider_payload: providerData,
    failure_message: normalizedStatus === 'failed' ? 'Reconciled as failed by provider' : null,
  }).eq('id', intent.id);

  await supabase.from('funding_events').insert({
    funding_intent_id: intent.id,
    event_type: `reconciled_${normalizedStatus}`,
    payload: { provider: intent.provider, provider_data: providerData },
  });

  // Credit using scope-aware creditor on success
  if (normalizedStatus === 'succeeded') {
    await creditFundingIntent(supabase, intent);
  }
}

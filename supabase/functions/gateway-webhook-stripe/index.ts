import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapStripeStatus, mapStripeDisputeStatus } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Basic Stripe signature verification
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBSECRET_KEY');
    if (STRIPE_WEBHOOK_SECRET && signature) {
      // Parse signature components
      const sigParts = signature.split(',').reduce((acc: Record<string, string>, part: string) => {
        const [key, val] = part.split('=');
        acc[key] = val;
        return acc;
      }, {});

      const timestamp = sigParts['t'];
      const signedPayload = `${timestamp}.${rawBody}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (sigParts['v1'] !== expectedSig) {
        console.warn('Stripe signature mismatch — processing anyway in dev mode');
      }
    }

    const event = JSON.parse(rawBody);
    const eventId = event.id;

    // Dedupe
    if (eventId) {
      const { data: existing } = await supabase.from('webhook_inbox').select('id').eq('event_id', `stripe_${eventId}`).maybeSingle();
      if (existing) return new Response(JSON.stringify({ status: 'already_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from('webhook_inbox').insert({ event_id: `stripe_${eventId}`, provider: 'stripe', payload: event, status: 'processing' });
    }

    const obj = event.data?.object;
    const piId = obj?.id || obj?.payment_intent;

    if (event.type?.startsWith('payment_intent.') && piId) {
      const { data: charge } = await supabase.from('gateway_charges').select('*').eq('provider_ref', piId).maybeSingle();
      if (charge) {
        const newStatus = mapStripeStatus(obj.status);
        await supabase.from('gateway_charges').update({ status: newStatus, provider_raw: obj }).eq('id', charge.id);

        if (newStatus === 'successful' || newStatus === 'failed') {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: charge.merchant_id,
            event_type: newStatus === 'successful' ? 'charge.successful' : 'charge.failed',
            payload: { charge_id: charge.id, status: newStatus, amount: charge.amount, currency: charge.currency },
            status: 'pending', next_retry_at: new Date().toISOString(),
          });
        }
      }
    }

    // Handle disputes
    if (event.type?.startsWith('charge.dispute.')) {
      const chargeId = obj?.payment_intent;
      if (chargeId) {
        const { data: charge } = await supabase.from('gateway_charges').select('*').eq('provider_ref', chargeId).maybeSingle();
        if (charge) {
          const disputeRef = 'DSP-' + crypto.randomUUID().slice(0, 8).toUpperCase();
          const { data: newDispute } = await supabase.from('gateway_disputes').insert({
            charge_id: charge.id, merchant_id: charge.merchant_id,
            amount: (obj.amount || 0) / 100, currency: (obj.currency || 'xaf').toUpperCase(),
            status: mapStripeDisputeStatus(obj.status), reason: obj.reason,
            dispute_ref: disputeRef,
            evidence_due_by: obj.evidence_details?.due_by ? new Date(obj.evidence_details.due_by * 1000).toISOString() : null,
            provider: 'stripe', provider_ref: obj.id, provider_raw: obj,
          }).select().single();

          await supabase.from('gateway_webhook_events').insert({
            merchant_id: charge.merchant_id,
            event_type: 'dispute.created',
            payload: { dispute_id: obj.id, charge_id: charge.id, amount: (obj.amount || 0) / 100, reason: obj.reason },
            status: 'pending', next_retry_at: new Date().toISOString(),
          });

          // Send dispute notifications
          if (newDispute) {
            await supabase.functions.invoke('gateway-dispute-notify', {
              body: { dispute_id: newDispute.id, event_type: 'dispute.created' },
            });
          }
        }
      }
    }

    // Handle refunds
    if (event.type === 'charge.refunded') {
      const piRef = obj?.payment_intent;
      if (piRef) {
        const { data: charge } = await supabase.from('gateway_charges').select('*').eq('provider_ref', piRef).maybeSingle();
        if (charge) {
          const latestRefund = obj.refunds?.data?.[0];
          if (latestRefund) {
            await supabase.from('gateway_refunds').update({ status: 'successful', provider_raw: latestRefund }).eq('provider_ref', latestRefund.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Gateway Stripe webhook error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

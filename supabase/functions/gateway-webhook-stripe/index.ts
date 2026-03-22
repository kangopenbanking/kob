import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapStripeStatus, mapStripeDisputeStatus } from "../_shared/gateway-adapters.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { creditFundingIntent } from "../_shared/funding-scope-creditor.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ─── Webhook Rate Limiting: 100 req/min for Stripe ───
    const { data: allowed } = await supabase.rpc('check_webhook_rate_limit', { _provider: 'stripe', _max_requests: 100, _window_minutes: 1 });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Stripe signature verification — MANDATORY (C6 fix)
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBSECRET_KEY');
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBSECRET_KEY not configured — rejecting webhook');
      return new Response(JSON.stringify({ error: 'webhook_not_configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!signature) {
      console.error('Missing stripe-signature header — rejecting');
      return new Response(JSON.stringify({ error: 'missing_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
      console.error('Stripe webhook signature verification FAILED — rejecting');
      return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.id;

    // Dedupe
    const dedupeKey = eventId ? `stripe_${eventId}` : null;
    if (dedupeKey) {
      const { data: existing } = await supabase.from('webhook_inbox').select('id').eq('event_id', dedupeKey).maybeSingle();
      if (existing) return new Response(JSON.stringify({ status: 'already_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from('webhook_inbox').insert({ event_id: dedupeKey, provider: 'stripe', event_type: event.type, payload: event, status: 'processing' });
    }

    const obj = event.data?.object;
    const piId = obj?.id || obj?.payment_intent;

    if (event.type?.startsWith('payment_intent.') && piId) {
      // Resolve status at the top level so it's available for both charge and funding intent blocks
      const newStatus = mapStripeStatus(obj.status);

      const { data: charge } = await supabase.from('gateway_charges').select('*').eq('provider_ref', piId).maybeSingle();
      if (charge) {
        // ─── ATOMIC: Charge status update + wallet credit in single transaction ───
        await supabase.rpc('atomic_charge_wallet_credit', {
          _charge_id: charge.id,
          _new_status: newStatus,
          _provider_raw: obj,
          _merchant_id: charge.merchant_id,
          _currency: charge.currency,
          _credit_amount: newStatus === 'successful' ? (charge.net_amount || charge.amount) : 0,
        });

        if (newStatus === 'successful' || newStatus === 'failed') {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: charge.merchant_id,
            event_type: newStatus === 'successful' ? 'charge.successful' : 'charge.failed',
            payload: { charge_id: charge.id, status: newStatus, amount: charge.amount, currency: charge.currency },
            status: 'pending', next_retry_at: new Date().toISOString(),
          });
        }
      }

      // ─── Funding Intents: finalize on Stripe webhook ───
      const { data: fundingIntent } = await supabase.from('funding_intents').select('*').eq('provider_reference', piId).in('status', ['pending_provider', 'pending_customer_action', 'pending_verification', 'created']).maybeSingle();
      if (fundingIntent) {
        const fiStatus = newStatus === 'successful' ? 'succeeded' : newStatus === 'cancelled' ? 'cancelled' : newStatus === 'failed' ? 'failed' : null;
        if (fiStatus) {
          await supabase.from('funding_intents').update({
            status: fiStatus, provider_payload: obj,
            failure_message: fiStatus === 'failed' ? `Stripe: ${obj.status}` : null,
          }).eq('id', fundingIntent.id);

          await supabase.from('funding_events').insert({
            funding_intent_id: fundingIntent.id, event_type: `webhook_${fiStatus}`,
            payload: { provider: 'stripe', pi_id: piId },
          });

          if (fiStatus === 'succeeded') {
            await creditFundingIntent(supabase, fundingIntent);
          }
        }
      }
    }

    // Handle disputes
    if (event.type?.startsWith('charge.dispute.')) {
      const chargeId = obj?.payment_intent;
      if (chargeId) {
        const { data: charge } = await supabase.from('gateway_charges').select('*').eq('provider_ref', chargeId).maybeSingle();
        if (charge) {
          // ─── Dispute closed (won/lost) ───
          if (event.type === 'charge.dispute.closed') {
            const closedStatus = mapStripeDisputeStatus(obj.status);
            await supabase.from('gateway_disputes').update({ status: closedStatus }).eq('provider_ref', obj.id);

            // ATOMIC: Re-credit wallet if dispute won
            if (closedStatus === 'won') {
              const disputeAmount = (obj.amount || 0) / 100;
              await supabase.rpc('atomic_dispute_wallet_adjust', {
                _merchant_id: charge.merchant_id,
                _currency: charge.currency,
                _amount: disputeAmount,
                _direction: 'credit',
              });
            }

            await supabase.from('gateway_webhook_events').insert({
              merchant_id: charge.merchant_id,
              event_type: closedStatus === 'won' ? 'dispute.won' : 'dispute.lost',
              payload: { dispute_ref: obj.id, charge_id: charge.id, status: closedStatus, amount: (obj.amount || 0) / 100 },
              status: 'pending', next_retry_at: new Date().toISOString(),
            });
          } else {
            // New dispute created
            const disputeRef = 'DSP-' + crypto.randomUUID().slice(0, 8).toUpperCase();
            const disputeAmount = (obj.amount || 0) / 100;

            const { data: newDispute } = await supabase.from('gateway_disputes').insert({
              charge_id: charge.id, merchant_id: charge.merchant_id,
              amount: disputeAmount, currency: (obj.currency || 'xaf').toUpperCase(),
              status: mapStripeDisputeStatus(obj.status), reason: obj.reason,
              dispute_ref: disputeRef,
              evidence_due_by: obj.evidence_details?.due_by ? new Date(obj.evidence_details.due_by * 1000).toISOString() : null,
              provider: 'stripe', provider_ref: obj.id, provider_raw: obj,
            }).select().single();

            // ─── ATOMIC: Debit merchant wallet on dispute creation ───
            await supabase.rpc('atomic_dispute_wallet_adjust', {
              _merchant_id: charge.merchant_id,
              _currency: charge.currency,
              _amount: disputeAmount,
              _direction: 'debit',
            });

            await supabase.from('gateway_webhook_events').insert({
              merchant_id: charge.merchant_id,
              event_type: 'dispute.created',
              payload: { dispute_id: obj.id, charge_id: charge.id, amount: disputeAmount, reason: obj.reason },
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapFlutterwaveStatus } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Verify Flutterwave hash
    const verifHash = req.headers.get('verif-hash');
    const FLW_HASH = Deno.env.get('FLUTTERWAVE_ENCRYPTION_KEY');
    if (FLW_HASH && verifHash !== FLW_HASH) {
      return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const eventId = payload.data?.id?.toString() || payload.id?.toString();
    const txRef = payload.data?.tx_ref || payload.tx_ref;

    // Dedupe
    if (eventId) {
      const { data: existing } = await supabase.from('webhook_inbox').select('id').eq('event_id', `flw_${eventId}`).maybeSingle();
      if (existing) return new Response(JSON.stringify({ status: 'already_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from('webhook_inbox').insert({ event_id: `flw_${eventId}`, provider: 'flutterwave', payload, status: 'processing' });
    }

    // Find matching charge
    if (txRef) {
      const { data: charge } = await supabase.from('gateway_charges').select('*').eq('tx_ref', txRef).maybeSingle();
      if (charge) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        await supabase.from('gateway_charges').update({
          status: newStatus,
          provider_ref: payload.data?.flw_ref || charge.provider_ref,
          provider_raw: payload,
        }).eq('id', charge.id);

        // Trigger outbound merchant webhook
        if (newStatus === 'successful' || newStatus === 'failed') {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: charge.merchant_id,
            event_type: newStatus === 'successful' ? 'charge.successful' : 'charge.failed',
            payload: { charge_id: charge.id, status: newStatus, amount: charge.amount, currency: charge.currency, tx_ref: charge.tx_ref },
            status: 'pending',
            next_retry_at: new Date().toISOString(),
          });
        }
      }
    }

    // Check for payout events
    const reference = payload.data?.reference;
    if (reference) {
      const { data: payout } = await supabase.from('gateway_payouts').select('*').eq('tx_ref', reference).maybeSingle();
      if (payout) {
        const newStatus = mapFlutterwaveStatus(payload.data?.status || payload.status);
        await supabase.from('gateway_payouts').update({ status: newStatus, provider_raw: payload }).eq('id', payout.id);

        if (newStatus === 'successful' || newStatus === 'failed') {
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: payout.merchant_id,
            event_type: newStatus === 'successful' ? 'payout.completed' : 'payout.failed',
            payload: { payout_id: payout.id, status: newStatus, amount: payout.amount },
            status: 'pending',
            next_retry_at: new Date().toISOString(),
          });
        }
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Gateway FLW webhook error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getRemittanceProvider } from "../_shared/remittance-adapters.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['pending', 'failed'],
  pending: ['received', 'failed'],
  received: ['credited', 'failed'],
  credited: ['settled', 'reversed'],
  settled: ['reversed'],
  failed: [],
  reversed: [],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // 1. Resolve partner
    const url = new URL(req.url);
    const partnerName = url.searchParams.get('partner') || (await req.clone().json().catch(() => ({}))).partner;
    if (!partnerName) {
      return new Response(JSON.stringify({ error: 'missing_partner_param' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Rate limit
    const { data: allowed } = await supabase.rpc('check_webhook_rate_limit', {
      _provider: `remittance_${partnerName}`, _max_requests: 200, _window_minutes: 1,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Load partner config
    const { data: partner } = await supabase
      .from('remittance_partners')
      .select('id, name, status')
      .eq('name', partnerName.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ error: 'unknown_or_inactive_partner' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Signature verification
    const rawBody = await req.text();
    const adapter = getRemittanceProvider(partnerName);

    const secretEnvKey = `REMITTANCE_WEBHOOK_SECRET_${partnerName.toUpperCase()}`;
    const webhookSecret = Deno.env.get(secretEnvKey);
    if (!webhookSecret) {
      console.error(`[remittance-webhook] ${secretEnvKey} not configured`);
      return new Response(JSON.stringify({ error: 'webhook_not_configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sigValid = await adapter.verifyWebhook(req.headers, rawBody, webhookSecret);
    if (!sigValid) {
      console.error(`[remittance-webhook] Signature FAILED for ${partnerName}`);
      return new Response(JSON.stringify({ error: 'invalid_signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Parse canonical event
    const event = adapter.parseEvent(rawBody);
    if (!event.partner_reference) {
      return new Response(JSON.stringify({ error: 'missing_partner_reference' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Dedupe via webhook_inbox
    const dedupeKey = `remittance_${partnerName}_${event.partner_reference}_${event.event_type}`;
    const { data: dup } = await supabase.from('webhook_inbox').select('id').eq('event_id', dedupeKey).maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('webhook_inbox').insert({
      event_id: dedupeKey, provider: `remittance_${partnerName}`,
      payload: event.raw_payload, status: 'processing',
    });

    // 7. Upsert remittance
    const { data: existing } = await supabase
      .from('remittances')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('partner_reference', event.partner_reference)
      .maybeSingle();

    let remittanceId: string;

    if (existing) {
      remittanceId = existing.id;
      const newStatus = event.event_type;
      if (VALID_TRANSITIONS[existing.status]?.includes(newStatus)) {
        const upd: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === 'received') upd.received_at = new Date().toISOString();
        if (newStatus === 'credited') upd.credited_at = new Date().toISOString();
        if (newStatus === 'settled') upd.settled_at = new Date().toISOString();
        if (newStatus === 'failed') { upd.failed_at = new Date().toISOString(); upd.failure_reason = event.narration || 'Partner reported failure'; }
        await supabase.from('remittances').update(upd).eq('id', remittanceId);
      } else {
        console.warn(`[remittance-webhook] Invalid transition ${existing.status} → ${newStatus}`);
      }
    } else {
      const { data: newRem, error: insErr } = await supabase
        .from('remittances')
        .insert({
          direction: 'inbound',
          partner_id: partner.id,
          partner_reference: event.partner_reference,
          sender_name: event.sender_name, sender_country: event.sender_country, sender_phone: event.sender_phone,
          receiver_name: event.receiver_name, receiver_phone: event.receiver_phone,
          amount_in: event.amount_in, currency_in: event.currency_in,
          amount_out: event.amount_out, currency_out: event.currency_out,
          fee_total: event.fee_total, fx_rate: event.fx_rate,
          purpose_code: event.purpose_code, narration: event.narration,
          destination_type: event.destination_type || 'kob_wallet',
          destination_ref: event.destination_ref,
          status: event.event_type === 'received' ? 'received' : 'pending',
          received_at: event.event_type === 'received' ? new Date().toISOString() : null,
          correlation_id: crypto.randomUUID(),
        })
        .select().single();
      if (insErr) throw insErr;
      remittanceId = newRem.id;
    }

    // 8. Record event
    await supabase.from('remittance_events').insert({
      remittance_id: remittanceId, event_type: event.event_type,
      provider_event_id: dedupeKey, payload_raw: event.raw_payload,
      signature_valid: true, actor_type: 'partner',
    });

    // 9. Trigger routing engine on 'received'
    if (event.event_type === 'received') {
      await supabase.functions.invoke('remittance-routing-engine', {
        body: { remittance_id: remittanceId },
      });
    }

    // 10. Mark processed
    await supabase.from('webhook_inbox').update({ status: 'processed' }).eq('event_id', dedupeKey);

    return new Response(JSON.stringify({ received: true, remittance_id: remittanceId, status: event.event_type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-webhook-ingest');
  }
});

// PERMANENT PUBLIC API — DO NOT REMOVE OR REDIRECT
// Phase 2 — Webhook reliability: single-delivery replay
// Justification: Stripe-style webhook reliability (industry baseline) +
// FAPI-1.0-Adv §6.2 (delivery accountability for resource events).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

function problem(status: number, title: string, detail: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return problem(405, 'Method Not Allowed', `${req.method} is not supported`);

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authResult = await resolveAuth(req, supabase);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;

    const body = await req.json().catch(() => ({}));
    const endpointId: string | undefined = body.endpoint_id;
    const deliveryId: string | undefined = body.delivery_id;

    if (!endpointId || !deliveryId) {
      return problem(400, 'Bad Request', 'endpoint_id and delivery_id are required');
    }

    // Load delivery + endpoint atomically
    const { data: delivery, error: dErr } = await supabase
      .from('gateway_webhook_deliveries_v2')
      .select('id, endpoint_id, merchant_id, event_type, payload, attempt, max_attempts, status')
      .eq('id', deliveryId)
      .eq('endpoint_id', endpointId)
      .maybeSingle();

    if (dErr) throw dErr;
    if (!delivery) return problem(404, 'Not Found', 'Delivery not found for this endpoint');

    // Ownership: admin OR merchant owner
    const { data: adminRole } = await supabase
      .from('user_roles').select('role').eq('user_id', auth.user_id).eq('role', 'admin').maybeSingle();

    if (!adminRole) {
      const { data: merch } = await supabase
        .from('gateway_merchants').select('id').eq('id', delivery.merchant_id).eq('user_id', auth.user_id).maybeSingle();
      if (!merch) return problem(403, 'Forbidden', 'Not authorized for this merchant');
    }

    // Load endpoint
    const { data: ep, error: eErr } = await supabase
      .from('gateway_webhook_endpoints')
      .select('id, url, is_active')
      .eq('id', endpointId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!ep) return problem(404, 'Not Found', 'Endpoint not found');
    if (!ep.is_active) return problem(409, 'Conflict', 'Endpoint is inactive; reactivate before replay');

    // Sign via DB RPC (secret never leaves DB)
    const payloadStr = JSON.stringify(delivery.payload);
    const { data: signature, error: sigErr } = await supabase.rpc('compute_endpoint_hmac', {
      p_endpoint_id: ep.id,
      p_payload: payloadStr,
    });
    if (sigErr || !signature) return problem(500, 'Internal Server Error', 'Failed to sign payload');

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let newStatus: 'delivered' | 'failed' = 'failed';

    try {
      const resp = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event_type,
          'X-Webhook-ID': crypto.randomUUID(),
          'X-Webhook-Replay': 'true',
          'X-Webhook-Original-Delivery-Id': delivery.id,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = resp.status;
      responseBody = (await resp.text().catch(() => null))?.substring(0, 2000) ?? null;
      newStatus = resp.ok ? 'delivered' : 'failed';
    } catch (err: any) {
      responseBody = String(err?.message ?? err).substring(0, 2000);
      newStatus = 'failed';
    }

    // Insert a NEW delivery row (additive — original record is preserved for audit)
    const { data: replayRow, error: insErr } = await supabase
      .from('gateway_webhook_deliveries_v2')
      .insert({
        endpoint_id: ep.id,
        merchant_id: delivery.merchant_id,
        event_type: delivery.event_type,
        payload: delivery.payload,
        response_status: responseStatus,
        response_body: responseBody,
        status: newStatus,
        delivered_at: newStatus === 'delivered' ? new Date().toISOString() : null,
        attempt: 1,
        max_attempts: 1, // manual replays are one-shot; auto-retry stays on the original chain
      })
      .select('id, status, response_status, created_at')
      .single();

    if (insErr) throw insErr;

    return json({
      replay_delivery_id: replayRow.id,
      original_delivery_id: delivery.id,
      endpoint_id: ep.id,
      status: replayRow.status,
      response_status: replayRow.response_status,
      created_at: replayRow.created_at,
    }, 201);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-webhook-replay-delivery error:`, err);
    return problem(500, 'Internal Server Error', err?.message ?? 'unknown', { error_id: errorId });
  }
});

// supabase/functions/admin-send-test-webhook
// Admin-only "Send test webhook" — signs a synthetic event with the endpoint's
// signing secret, delivers via HTTP POST, records the result in
// gateway_webhook_deliveries with is_test=true.
//
// POST /functions/v1/admin-send-test-webhook
// Body: { endpoint_id: string, event_type: string, payload?: Record<string, unknown> }
// Returns: { delivery_id, status, http_status, latency_ms, signature_header }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

function uuid() {
  // RFC 4122 v4
  return crypto.randomUUID();
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ALLOWED_EVENT_TYPES = new Set([
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "qr.paid",
  "qr.expired",
  "remittance.cemac.quoted",
  "remittance.cemac.paid",
  "remittance.cemac.cancelled",
  "agent.cashin.completed",
  "agent.cashout.completed",
  "agent.float.low",
  "ussd.session.started",
  "ussd.session.ended",
  "transfer.completed",
  "transfer.failed",
  "ledger.posted",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden — admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { endpoint_id?: string; event_type?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  const endpointId = body.endpoint_id?.trim();
  const eventType = body.event_type?.trim();
  const customPayload = body.payload ?? {};

  if (!endpointId || !/^[0-9a-f-]{36}$/i.test(endpointId)) {
    return new Response(JSON.stringify({ error: "endpoint_id (uuid) is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return new Response(
      JSON.stringify({
        error: "event_type required; must be one of the supported test events",
        supported: Array.from(ALLOWED_EVENT_TYPES),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: endpoint, error: epErr } = await supabase
    .from("gateway_webhook_endpoints")
    .select("id, merchant_id, url, signing_secret, status")
    .eq("id", endpointId)
    .maybeSingle();
  if (epErr || !endpoint) {
    return new Response(JSON.stringify({ error: "Webhook endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId = `evt_test_${uuid()}`;
  const event = {
    id: eventId,
    type: eventType,
    created_at: new Date().toISOString(),
    is_test: true,
    data: { object: { ...customPayload, test: true, event_type: eventType } },
  };
  const payloadStr = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payloadStr}`;
  const sigHex = await hmacSha256Hex(endpoint.signing_secret ?? "test_secret", signedPayload);
  const signatureHeader = `t=${timestamp},v1=${sigHex}`;

  const start = performance.now();
  let httpStatus = 0;
  let responseText = "";
  let deliveryStatus: "delivered" | "failed" = "failed";
  try {
    const resp = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kob-Signature": signatureHeader,
        "X-Kob-Event-Id": eventId,
        "X-Kob-Event-Type": eventType,
        "X-Kob-Test": "true",
        "User-Agent": "KangOpenBanking-WebhookTest/4.49",
      },
      body: payloadStr,
      signal: AbortSignal.timeout(15000),
    });
    httpStatus = resp.status;
    responseText = (await resp.text()).slice(0, 2000);
    deliveryStatus = resp.ok ? "delivered" : "failed";
  } catch (err) {
    responseText = `Network error: ${(err as Error).message}`;
  }
  const latencyMs = Math.round(performance.now() - start);

  const { data: delivery } = await supabase
    .from("gateway_webhook_deliveries")
    .insert({
      webhook_id: endpoint.id,
      merchant_id: endpoint.merchant_id,
      event_id: eventId,
      event_type: eventType,
      payload: event,
      status: deliveryStatus,
      http_status: httpStatus || null,
      response_body: responseText,
      latency_ms: latencyMs,
      is_test: true,
      signature: signatureHeader,
    })
    .select("id")
    .maybeSingle();

  return new Response(
    JSON.stringify({
      delivery_id: delivery?.id ?? null,
      event_id: eventId,
      status: deliveryStatus,
      http_status: httpStatus,
      latency_ms: latencyMs,
      signature_header: signatureHeader,
      endpoint_url: endpoint.url,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

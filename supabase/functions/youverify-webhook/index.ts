// Youverify webhook receiver — HMAC verified, timestamp-bound, idempotent.
//
// Security:
//   1. HMAC-SHA256 of `${timestamp}.${rawBody}` (with fallback to bare body for legacy senders).
//   2. Reject if no timestamp header or skew > MAX_SKEW_SECONDS (replay protection).
//   3. Idempotency on payload event id. Outcome recorded in audit row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_SKEW_SECONDS = 300; // 5 minutes

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  rawBody: string, signature: string, timestamp: string, secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const sig = signature.replace(/^sha256=/, "").toLowerCase();
  // Preferred: signed-payload format `${ts}.${body}`
  const signed = timestamp ? await hmacHex(secret, `${timestamp}.${rawBody}`) : "";
  if (signed && timingSafeEqual(signed, sig)) return true;
  // Legacy: bare body signing
  const bare = await hmacHex(secret, rawBody);
  return timingSafeEqual(bare, sig);
}

async function recordAudit(
  client: ReturnType<typeof createClient>,
  row: {
    event_id: string; event_type: string; payload: unknown; signature: string;
    event_timestamp: string | null; skew_seconds: number | null;
    outcome: string; outcome_detail?: string | null;
  },
) {
  // Insert; on conflict (duplicate event_id) update only the outcome — keeps original payload.
  await client.from("youverify_webhook_events").upsert({
    event_id: row.event_id,
    event_type: row.event_type,
    payload: row.payload,
    signature: row.signature,
    event_timestamp: row.event_timestamp,
    skew_seconds: row.skew_seconds,
    outcome: row.outcome,
    outcome_detail: row.outcome_detail ?? null,
  }, { onConflict: "event_id", ignoreDuplicates: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("YOUVERIFY_WEBHOOK_SECRET") ?? "";
  const signature = req.headers.get("x-youverify-signature") ?? req.headers.get("x-signature") ?? "";
  const timestampHeader =
    req.headers.get("x-youverify-timestamp") ?? req.headers.get("x-timestamp") ?? "";
  const raw = await req.text();

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---- Timestamp / skew validation ----
  let eventTs: Date | null = null;
  let skew: number | null = null;
  if (timestampHeader) {
    const tsNum = /^\d+$/.test(timestampHeader)
      ? Number(timestampHeader.length > 10 ? timestampHeader : timestampHeader + "000")
      : Date.parse(timestampHeader);
    if (Number.isFinite(tsNum) && tsNum > 0) {
      eventTs = new Date(tsNum);
      skew = Math.round((Date.now() - tsNum) / 1000);
    }
  }

  if (!eventTs) {
    console.log(JSON.stringify({ scope: "yv-webhook", event: "missing_timestamp" }));
    return json({ error: "missing_timestamp" }, 400);
  }
  if (Math.abs(skew ?? 0) > MAX_SKEW_SECONDS) {
    // Best-effort audit of rejected stale event
    try {
      await recordAudit(client, {
        event_id: `stale:${crypto.randomUUID()}`,
        event_type: "rejected", payload: { reason: "stale" }, signature,
        event_timestamp: eventTs.toISOString(), skew_seconds: skew,
        outcome: "stale", outcome_detail: `skew=${skew}s exceeds ${MAX_SKEW_SECONDS}s`,
      });
    } catch { /* noop */ }
    console.log(JSON.stringify({ scope: "yv-webhook", event: "stale", skew }));
    return json({ error: "stale_event", skew_seconds: skew }, 401);
  }

  // ---- Signature ----
  if (!await verifySignature(raw, signature, timestampHeader, secret)) {
    try {
      await recordAudit(client, {
        event_id: `bad:${crypto.randomUUID()}`,
        event_type: "rejected", payload: { reason: "bad_signature" }, signature,
        event_timestamp: eventTs.toISOString(), skew_seconds: skew,
        outcome: "bad_signature",
      });
    } catch { /* noop */ }
    console.log(JSON.stringify({ scope: "yv-webhook", event: "bad_signature" }));
    return json({ error: "invalid_signature" }, 401);
  }

  // ---- Parse ----
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; }
  catch { return json({ error: "invalid_json" }, 400); }
  const eventId = String(payload.id ?? payload.eventId ?? crypto.randomUUID());
  const eventType = String(payload.event ?? payload.type ?? "unknown");

  // ---- Idempotency: did we already process this event_id? ----
  const { data: existingEvent } = await client
    .from("youverify_webhook_events")
    .select("event_id, outcome")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent) {
    await recordAudit(client, {
      event_id: eventId, event_type: eventType, payload, signature,
      event_timestamp: eventTs.toISOString(), skew_seconds: skew,
      outcome: "duplicate", outcome_detail: `previous_outcome=${existingEvent.outcome ?? "unknown"}`,
    });
    return json({ ok: true, duplicate: true });
  }

  // ---- Locate verification session ----
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const sessionId = String(data.id ?? data.requestId ?? "");
  if (!sessionId) {
    await recordAudit(client, {
      event_id: eventId, event_type: eventType, payload, signature,
      event_timestamp: eventTs.toISOString(), skew_seconds: skew,
      outcome: "no_session",
    });
    return json({ ok: true, ignored: "no_session_id" });
  }

  const yvStatus = String(data.status ?? "").toLowerCase();
  const APPROVED = ["found", "approved", "successful", "verified", "success"];
  const REJECTED = ["not_found", "rejected", "failed"];
  const PENDING = ["pending", "in_progress"];
  let newStatus: "approved" | "rejected" | "pending" | "manual_review";
  let unmapped = false;
  if (APPROVED.includes(yvStatus)) newStatus = "approved";
  else if (REJECTED.includes(yvStatus)) newStatus = "rejected";
  else if (PENDING.includes(yvStatus)) newStatus = "pending";
  else {
    newStatus = "manual_review";
    unmapped = true;
    console.log(JSON.stringify({
      scope: "yv-webhook", event: "unmapped_status",
      raw_status: yvStatus || "(empty)", event_id: eventId, session_id: sessionId,
    }));
  }

  let outcome = "session_not_found";
  let detail: string | null = unmapped ? `unmapped_status=${yvStatus || "(empty)"}` : null;

  // NOTE: kyc_verifications uses column `status` (not `verification_status`).
  // business_kyc uses `verification_status`.
  const { data: existing } = await client
    .from("kyc_verifications").select("id, status").eq("youverify_session_id", sessionId).maybeSingle();

  if (existing) {
    const decided = existing.status === "approved" || existing.status === "rejected";
    if (decided && existing.status !== newStatus) {
      outcome = "discrepancy";
      detail = `existing=${existing.status} incoming=${newStatus}`;
    } else if (!decided) {
      await client.from("kyc_verifications")
        .update({
          status: newStatus,
          verified_at: newStatus === "approved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      outcome = "applied";
      detail = [`status=${newStatus}`, unmapped ? `raw=${yvStatus}` : null].filter(Boolean).join(" ");
    } else {
      outcome = "already_decided";
    }
  } else {
    const { data: biz } = await client
      .from("business_kyc").select("id, verification_status").eq("youverify_session_id", sessionId).maybeSingle();
    if (biz) {
      const decided = biz.verification_status === "approved" || biz.verification_status === "rejected";
      if (decided && biz.verification_status !== newStatus) {
        outcome = "discrepancy";
        detail = `existing=${biz.verification_status} incoming=${newStatus}`;
      } else if (!decided) {
        await client.from("business_kyc")
          .update({
            verification_status: newStatus,
            verified_at: newStatus === "approved" ? new Date().toISOString() : null,
          })
          .eq("id", biz.id);
        outcome = "applied";
        detail = [`business status=${newStatus}`, unmapped ? `raw=${yvStatus}` : null].filter(Boolean).join(" ");
      } else {
        outcome = "already_decided";
      }
    }
  }

  console.log(JSON.stringify({
    scope: "yv-webhook", event: "correlation",
    event_id: eventId, session_id: sessionId,
    outcome, mapped_status: newStatus, raw_status: yvStatus, unmapped,
  }));

  await recordAudit(client, {
    event_id: eventId, event_type: eventType, payload, signature,
    event_timestamp: eventTs.toISOString(), skew_seconds: skew,
    outcome, outcome_detail: detail,
  });

  return json({ ok: true, outcome });
});

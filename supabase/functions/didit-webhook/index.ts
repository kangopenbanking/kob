// Didit webhook receiver.
// Verifies X-Signature-V2 (HMAC-SHA256 over canonical JSON), enforces 300s
// timestamp freshness, dedupes by event_id, and updates the matching
// kyc_verifications row on Approved / Declined / In Review / Kyc Expired.
//
// Docs: https://docs.didit.me/integration/webhooks

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature-v2, x-signature, x-signature-simple, x-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEBHOOK_SECRET = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
const FRESHNESS_WINDOW_S = 300;

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "didit-webhook", ...entry }));
}

// Whole-number floats (1.0) -> integers (1). Matches Didit's canonicalisation.
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]),
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function mapDiditStatusToKyc(status: string): "approved" | "rejected" | "pending" | "manual_review" | null {
  switch (status) {
    case "Approved":
      return "approved";
    case "Declined":
      return "rejected";
    case "In Review":
      return "manual_review";
    case "Resubmitted":
    case "In Progress":
    case "Awaiting User":
    case "Not Started":
      return "pending";
    case "Kyc Expired":
    case "Expired":
    case "Abandoned":
      return null; // don't clobber row; handled explicitly below
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  if (!WEBHOOK_SECRET) {
    log({ event: "missing_secret" });
    return new Response("server_misconfigured", { status: 500, headers: corsHeaders });
  }

  const raw = await req.text();
  const sig = (req.headers.get("x-signature-v2") ?? "").toLowerCase();
  const tsHeader = req.headers.get("x-timestamp");
  const ts = tsHeader ? Number(tsHeader) : NaN;

  // 1) Freshness check
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > FRESHNESS_WINDOW_S) {
    log({ event: "stale_timestamp", ts: tsHeader });
    return new Response("stale", { status: 401, headers: corsHeaders });
  }

  // 2) Parse + canonicalise + HMAC verify
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("bad_json", { status: 400, headers: corsHeaders });
  }
  const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
  const expected = await hmacSha256Hex(WEBHOOK_SECRET, canonical);
  if (!sig || !timingSafeEqualHex(sig, expected)) {
    log({ event: "bad_signature" });
    return new Response("bad_signature", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const eventId = String(parsed.event_id ?? "");
  const webhookType = String(parsed.webhook_type ?? "unknown");
  const sessionId = parsed.session_id ? String(parsed.session_id) : null;
  const businessSessionId = parsed.business_session_id ? String(parsed.business_session_id) : null;
  const effectiveSessionId = sessionId ?? businessSessionId;
  const vendorData = parsed.vendor_data ? String(parsed.vendor_data) : null;
  const status = parsed.status ? String(parsed.status) : null;
  const workflowId = parsed.workflow_id ? String(parsed.workflow_id) : null;

  if (!eventId) {
    log({ event: "missing_event_id" });
    return new Response("bad_payload", { status: 400, headers: corsHeaders });
  }

  // 3) Idempotency — insert first; unique constraint short-circuits duplicates
  const { error: insErr } = await supabase.from("didit_webhook_events").insert({
    event_id: eventId,
    webhook_type: webhookType,
    session_id: effectiveSessionId,
    vendor_data: vendorData,
    status,
    workflow_id: workflowId,
    payload: parsed,
    signature_valid: true,
    processed: false,
  });

  if (insErr) {
    // Duplicate delivery — already stored. Return 2xx so Didit stops retrying.
    if (insErr.code === "23505") {
      log({ event: "duplicate_delivery", event_id: eventId });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    log({ event: "inbox_insert_failed", error: insErr.message });
    // Return 500 so Didit retries.
    return new Response("inbox_write_failed", { status: 500, headers: corsHeaders });
  }

  // 4) Process by status — session lifecycle events only
  let processingError: string | null = null;
  try {
    if (
      status &&
      (webhookType === "status.updated" || webhookType === "data.updated")
    ) {
      const kycStatus = mapDiditStatusToKyc(status);
      const decision = (parsed.decision ?? null) as Record<string, unknown> | null;

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (kycStatus) {
        patch.status = kycStatus;
        if (kycStatus === "approved") patch.verified_at = new Date().toISOString();
      }
      if (decision) {
        patch.metadata = {
          provider: "didit",
          workflow_id: workflowId,
          didit_status: status,
          decision,
          last_event_id: eventId,
          last_event_at: new Date().toISOString(),
        };
      }
      if (status === "Kyc Expired") {
        patch.status = "expired";
      }

      // Locate the row: prefer didit_session_id, fallback to vendor_data → user_id
      let matched = false;
      if (effectiveSessionId) {
        const { data: bySession, error: selErr } = await supabase
          .from("kyc_verifications")
          .select("id")
          .eq("didit_session_id", effectiveSessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (selErr) throw new Error(`select_by_session: ${selErr.message}`);
        if (bySession?.id) {
          const { error: updErr } = await supabase
            .from("kyc_verifications")
            .update(patch)
            .eq("id", bySession.id);
          if (updErr) throw new Error(`update_by_session: ${updErr.message}`);
          matched = true;
        }
      }

      if (!matched && vendorData) {
        // vendor_data is our internal user_id.
        const { data: byUser, error: selErr } = await supabase
          .from("kyc_verifications")
          .select("id")
          .eq("user_id", vendorData)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (selErr) throw new Error(`select_by_vendor: ${selErr.message}`);
        if (byUser?.id) {
          patch.didit_session_id = effectiveSessionId ?? null;
          const { error: updErr } = await supabase
            .from("kyc_verifications")
            .update(patch)
            .eq("id", byUser.id);
          if (updErr) throw new Error(`update_by_vendor: ${updErr.message}`);
          matched = true;
        }
      }

      log({
        event: "processed",
        event_id: eventId,
        webhook_type: webhookType,
        didit_status: status,
        kyc_status: kycStatus,
        matched,
      });
    } else {
      log({
        event: "acknowledged_only",
        event_id: eventId,
        webhook_type: webhookType,
      });
    }
  } catch (err) {
    processingError = (err as Error).message;
    log({ event: "processing_failed", event_id: eventId, error: processingError });
  }

  await supabase
    .from("didit_webhook_events")
    .update({
      processed: !processingError,
      processing_error: processingError,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  // Always return 2xx after signature+dedupe — retries won't help.
  return new Response("ok", { status: 200, headers: corsHeaders });
});

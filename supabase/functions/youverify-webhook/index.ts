// Youverify webhook receiver — HMAC verified, idempotent.
// Updates verification status only if no prior decision exists (first-decision wins).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  // Timing-safe compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("YOUVERIFY_WEBHOOK_SECRET") ?? "";
  const signature = req.headers.get("x-youverify-signature") ?? req.headers.get("x-signature") ?? "";
  const raw = await req.text();

  if (!await verifySignature(raw, signature, secret)) {
    console.log(JSON.stringify({ scope: "yv-webhook", event: "bad_signature" }));
    return json({ error: "invalid_signature" }, 401);
  }

  const payload = JSON.parse(raw) as Record<string, unknown>;
  const eventId = String(payload.id ?? payload.eventId ?? crypto.randomUUID());
  const eventType = String(payload.event ?? payload.type ?? "unknown");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotency: insert event row; conflict means duplicate
  const { error: insErr } = await supabase.from("youverify_webhook_events").insert({
    event_id: eventId, event_type: eventType, payload, signature,
  });
  if (insErr && !String(insErr.message).includes("duplicate")) {
    console.log(JSON.stringify({ scope: "yv-webhook", event: "audit_insert_failed", error: insErr.message }));
  }
  if (insErr && String(insErr.message).includes("duplicate")) {
    return json({ ok: true, duplicate: true });
  }

  // Locate the verification by youverify_session_id
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const sessionId = String(data.id ?? data.requestId ?? "");
  if (!sessionId) return json({ ok: true, ignored: "no_session_id" });

  const yvStatus = String(data.status ?? "").toLowerCase();
  const newStatus =
    ["found", "approved", "successful", "verified", "success"].includes(yvStatus) ? "approved" :
    ["not_found", "rejected", "failed"].includes(yvStatus) ? "rejected" :
    "pending";

  // Update kyc_verifications (only if not already decided)
  const { data: existing } = await supabase
    .from("kyc_verifications").select("id, verification_status").eq("youverify_session_id", sessionId).maybeSingle();

  if (existing) {
    const decided = existing.verification_status === "approved" || existing.verification_status === "rejected";
    if (decided && existing.verification_status !== newStatus) {
      await supabase.from("youverify_webhook_events").update({ discrepancy: true }).eq("event_id", eventId);
      console.log(JSON.stringify({ scope: "yv-webhook", event: "discrepancy", session: sessionId, existing: existing.verification_status, incoming: newStatus }));
    } else if (!decided) {
      await supabase.from("kyc_verifications").update({ verification_status: newStatus, verified_at: new Date().toISOString() }).eq("id", existing.id);
    }
  } else {
    // Try business_kyc
    const { data: biz } = await supabase
      .from("business_kyc").select("id, verification_status").eq("youverify_session_id", sessionId).maybeSingle();
    if (biz) {
      const decided = biz.verification_status === "approved" || biz.verification_status === "rejected";
      if (decided && biz.verification_status !== newStatus) {
        await supabase.from("youverify_webhook_events").update({ discrepancy: true }).eq("event_id", eventId);
      } else if (!decided) {
        await supabase.from("business_kyc").update({ verification_status: newStatus, verified_at: new Date().toISOString() }).eq("id", biz.id);
      }
    }
  }

  return json({ ok: true });
});

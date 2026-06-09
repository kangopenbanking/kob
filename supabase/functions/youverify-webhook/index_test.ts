// End-to-end tests for the Youverify webhook receiver.
//
// Verifies:
//   1. A signed webhook with a fresh timestamp updates kyc_verifications.status
//      when matched via youverify_session_id, and is idempotent on replay.
//   2. An unmapped Youverify status (e.g. "needs_attention") maps to the
//      explicit "manual_review" state and the audit row records the raw value.
//
// Uses the deployed function URL with the service role for direct seeding.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("YOUVERIFY_WEBHOOK_SECRET") ?? "test-secret";

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function postWebhook(payload: string) {
  const timestamp = String(Date.now());
  const signature = await hmac(`${timestamp}.${payload}`, WEBHOOK_SECRET);
  return await fetch(`${SUPABASE_URL}/functions/v1/youverify-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-youverify-signature": signature,
      "x-youverify-timestamp": timestamp,
    },
    body: payload,
  });
}

Deno.test("youverify-webhook applies updates idempotently to matched session", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping webhook E2E test");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const sessionId = `yv_test_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();
  const { data: seed, error: seedErr } = await admin
    .from("kyc_verifications")
    .insert({
      user_id: userId,
      status: "pending",
      document_type: "national_id",
      youverify_session_id: sessionId,
    })
    .select("id")
    .single();
  if (seedErr) {
    console.warn("Seed failed:", seedErr.message);
    return;
  }

  const eventId = `evt_test_${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    id: eventId,
    event: "id.verification.completed",
    data: { id: sessionId, status: "approved" },
  });

  // First delivery
  const r1 = await postWebhook(payload);
  const j1 = await r1.json();
  assertEquals(r1.status, 200);
  assertEquals(j1.ok, true);
  assertEquals(j1.duplicate ?? false, false);
  assertEquals(j1.outcome, "applied");

  // Replay (same event_id → idempotent)
  const r2 = await postWebhook(payload);
  const j2 = await r2.json();
  assertEquals(r2.status, 200);
  assertEquals(j2.duplicate, true);

  // Exactly one webhook event row
  const { data: events } = await admin
    .from("youverify_webhook_events").select("event_id").eq("event_id", eventId);
  assertEquals(events?.length ?? 0, 1);

  // kyc_verifications.status updated (correct column name)
  const { data: updated } = await admin
    .from("kyc_verifications").select("status, verified_at").eq("id", seed!.id).single();
  assertEquals(updated?.status, "approved");

  // Cleanup
  await admin.from("kyc_verifications").delete().eq("id", seed!.id);
  await admin.from("youverify_webhook_events").delete().eq("event_id", eventId);
});

Deno.test("youverify-webhook routes unmapped statuses to manual_review with raw status in audit", async () => {
  if (!SERVICE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const sessionId = `yv_test_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();
  const { data: seed, error: seedErr } = await admin
    .from("kyc_verifications")
    .insert({ user_id: userId, status: "pending", document_type: "national_id", youverify_session_id: sessionId })
    .select("id").single();
  if (seedErr) { console.warn("Seed failed:", seedErr.message); return; }

  const eventId = `evt_test_${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    id: eventId,
    event: "id.verification.completed",
    data: { id: sessionId, status: "needs_attention" }, // unmapped
  });

  const r = await postWebhook(payload);
  const j = await r.json();
  assertEquals(r.status, 200);
  assertEquals(j.outcome, "applied");

  const { data: updated } = await admin
    .from("kyc_verifications").select("status").eq("id", seed!.id).single();
  assertEquals(updated?.status, "manual_review");

  const { data: audit } = await admin
    .from("youverify_webhook_events").select("outcome_detail").eq("event_id", eventId).single();
  // outcome_detail must call out the unmapped raw status for admin triage
  if (!audit?.outcome_detail?.includes("raw=needs_attention")) {
    throw new Error(`expected outcome_detail to mention raw status, got: ${audit?.outcome_detail}`);
  }

  await admin.from("kyc_verifications").delete().eq("id", seed!.id);
  await admin.from("youverify_webhook_events").delete().eq("event_id", eventId);
});

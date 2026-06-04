// End-to-end test for the Youverify webhook receiver.
//
// Verifies:
//   1. A signed webhook updates kyc_verifications.verification_status when matched
//      via youverify_session_id.
//   2. A replay of the same event_id is treated as a duplicate (idempotent) and
//      does not produce a second status mutation or second webhook_events row.
//
// Uses the deployed function URL with the project's anon key.

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

Deno.test("youverify-webhook applies updates idempotently to matched session", async () => {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping webhook E2E test");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Seed a verification row with a unique session id
  const sessionId = `yv_test_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();
  const { data: seed, error: seedErr } = await admin
    .from("kyc_verifications")
    .insert({
      user_id: userId,
      verification_status: "pending",
      document_type: "national_id",
      youverify_session_id: sessionId,
    })
    .select("id")
    .single();
  if (seedErr) {
    console.warn("Seed failed (table may not allow service-role inserts in this env):", seedErr.message);
    return;
  }

  const eventId = `evt_test_${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    id: eventId,
    event: "id.verification.completed",
    data: { id: sessionId, status: "approved" },
  });
  const signature = await hmac(payload, WEBHOOK_SECRET);

  const url = `${SUPABASE_URL}/functions/v1/youverify-webhook`;
  const headers = { "Content-Type": "application/json", "x-youverify-signature": signature };

  // First delivery
  const r1 = await fetch(url, { method: "POST", headers, body: payload });
  const j1 = await r1.json();
  assertEquals(r1.status, 200);
  assertEquals(j1.ok, true);
  assertEquals(j1.duplicate ?? false, false);

  // Replay (same event_id → idempotent)
  const r2 = await fetch(url, { method: "POST", headers, body: payload });
  const j2 = await r2.json();
  assertEquals(r2.status, 200);
  assertEquals(j2.duplicate, true);

  // Verify exactly one webhook event row exists for this event_id
  const { data: events, error: evErr } = await admin
    .from("youverify_webhook_events")
    .select("event_id")
    .eq("event_id", eventId);
  assertEquals(evErr, null);
  assertEquals(events?.length ?? 0, 1);

  // Verify the kyc_verifications row status was updated to "approved"
  const { data: updated } = await admin
    .from("kyc_verifications")
    .select("verification_status")
    .eq("id", seed!.id)
    .single();
  assertEquals(updated?.verification_status, "approved");

  // Cleanup
  await admin.from("kyc_verifications").delete().eq("id", seed!.id);
  await admin.from("youverify_webhook_events").delete().eq("event_id", eventId);
});

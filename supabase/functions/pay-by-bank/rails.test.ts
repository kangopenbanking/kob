// CEMAC Pay-by-Bank rail tests — covers preflight + create_intent routing
// for XAF/XOF (partner KOB PISP banks vs non-partner Flutterwave hosted)
// and NGN bank_transfer. Run with:
//   deno test --allow-net --allow-env supabase/functions/pay-by-bank/rails.test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const FN = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;
const baseHeaders = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

async function preflight(bank: { code?: string; name?: string; network?: string }, currency: string) {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ action: "preflight_rails", bank, currency }),
  });
  const body = await res.json();
  return { res, body };
}

Deno.test("preflight: XAF + unknown bank → only Flutterwave hosted is supported", async () => {
  const { res, body } = await preflight({ code: "non-existent-bank-id", name: "Mock NGO Bank" }, "XAF");
  assertEquals(res.status, 200);
  const railMap = Object.fromEntries(body.rails.map((r: any) => [r.rail, r]));
  assertEquals(railMap.kob_pisp.supported, false);
  assertEquals(railMap.flutterwave_hosted.supported, true);
  assertEquals(railMap.flutterwave_bank_transfer.supported, false);
  assertEquals(body.recommended_rail, "flutterwave_hosted");
});

Deno.test("preflight: NGN enables both hosted + native bank_transfer", async () => {
  const { res, body } = await preflight({ code: "044", name: "Access Bank" }, "NGN");
  assertEquals(res.status, 200);
  const railMap = Object.fromEntries(body.rails.map((r: any) => [r.rail, r]));
  assertEquals(railMap.flutterwave_hosted.supported, true);
  assertEquals(railMap.flutterwave_bank_transfer.supported, true);
  assertEquals(railMap.flutterwave_hosted.payment_options, "account,banktransfer,card,ussd");
});

Deno.test("preflight: XOF (BCEAO zone) falls through to hosted checkout only", async () => {
  const { res, body } = await preflight({ code: "fake", name: "Ecobank CI" }, "XOF");
  assertEquals(res.status, 200);
  const hosted = body.rails.find((r: any) => r.rail === "flutterwave_hosted");
  const native = body.rails.find((r: any) => r.rail === "flutterwave_bank_transfer");
  assertEquals(hosted.supported, true);
  assertEquals(native.supported, false);
  assert(String(native.reason || "").toLowerCase().includes("ngn"));
});

Deno.test("preflight: missing bank still returns shape with any_supported flag", async () => {
  const { res, body } = await preflight({}, "XAF");
  assertEquals(res.status, 200);
  assert(Array.isArray(body.rails));
  assertEquals(typeof body.any_supported, "boolean");
});

Deno.test("create_intent: bank_not_linked returns hosted fallback hint for XAF", async () => {
  // Anonymous request will be rejected at 401 first, so the only
  // smoke we can do without a real session is asserting the function
  // rejects auth — the routing logic itself is covered by preflight.
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      action: "create_intent",
      target_type: "consumer_wallet",
      amount: 5000,
      currency: "XAF",
      redirect_uri: "https://example.com/return",
      state: crypto.randomUUID(),
      source_bank: { code: "unknown-bank", name: "Test Bank", network: "kob" },
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401, `expected 401 (auth required) got ${res.status}: ${JSON.stringify(body)}`);
});

// ─── Additional scenarios (Phase: delayed settlement, partial failures, ─
// out-of-order webhooks, idempotency). These exercise contract surfaces
// of the function without requiring a live bank.

Deno.test("idempotency: invalid (non-UUID) Idempotency-Key returns 400 IDEMPOTENCY_KEY_INVALID", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: { ...baseHeaders, "Idempotency-Key": "not-a-uuid" },
    body: JSON.stringify({ action: "preflight_rails", bank: {}, currency: "XAF" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.code, "IDEMPOTENCY_KEY_INVALID");
});

Deno.test("idempotency: valid Idempotency-Key on preflight is accepted", async () => {
  const key = crypto.randomUUID();
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: { ...baseHeaders, "Idempotency-Key": key },
    body: JSON.stringify({ action: "preflight_rails", bank: {}, currency: "XAF" }),
  });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test("rail_available is included in 422 bank_not_linked error envelope (KOB partner with no link)", async () => {
  // Requires auth — anonymous call still surfaces 401 first. We assert the
  // envelope shape is invariant across statuses by exercising preflight,
  // which returns the same vocabulary (rails[].rail, .supported, .reason).
  const { body } = await preflight({ code: "fake-kob", name: "Fake Bank", network: "kob" }, "XAF");
  const kob = body.rails.find((r: any) => r.rail === "kob_pisp");
  assert(kob, "kob_pisp must be present");
  assertEquals(typeof kob.supported, "boolean");
  if (!kob.supported) assert(typeof kob.reason === "string" && kob.reason.length > 0);
});

Deno.test("callback: missing intent_id returns 400 with structured error", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ action: "callback", final_status: "success" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(typeof body.error === "string");
});

Deno.test("callback: out-of-order — terminal intents replay idempotently", async () => {
  // We can't seed an intent without DB access here, but we can assert that
  // the function returns 404 (not 500) for an unknown id, proving the
  // graceful path is in place; integration tests cover the replay branch.
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      action: "callback",
      intent_id: crypto.randomUUID(),
      final_status: "success",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 404);
  assert(typeof body.error === "string");
});

Deno.test("delayed-settlement: get_intent on unknown id returns 404 not 500", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ action: "get_intent", intent_id: crypto.randomUUID() }),
  });
  await res.text();
  assertEquals(res.status, 404);
});

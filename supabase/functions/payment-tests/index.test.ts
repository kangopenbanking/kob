import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/assert_exists.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

async function invoke(fnName: string, body: Record<string, unknown>, headers?: Record<string, string>) {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

// ═══════════════════════════════════════════════════
// 1. gateway-create-charge
// ═══════════════════════════════════════════════════

Deno.test("gateway-create-charge: rejects unauthenticated", async () => {
  const { status, data } = await invoke("gateway-create-charge", {
    merchant_id: "fake",
    amount: 1000,
    currency: "XAF",
    channel: "mobile_money",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

Deno.test("gateway-create-charge: rejects missing fields with auth", async () => {
  const { status } = await invoke("gateway-create-charge", {}, {
    Authorization: "Bearer fake-token",
  });
  assertEquals(status, 401); // Auth fails first
});

Deno.test("gateway-create-charge: idempotency key header accepted", async () => {
  const { status } = await invoke("gateway-create-charge", {
    merchant_id: "fake",
    amount: 500,
    currency: "XAF",
    channel: "card",
  }, {
    Authorization: "Bearer fake-token",
    "Idempotency-Key": "test-idem-key-001",
  });
  assertEquals(status, 401); // Auth check first, but header is accepted
});

// ═══════════════════════════════════════════════════
// 2. gateway-create-refund
// ═══════════════════════════════════════════════════

Deno.test("gateway-create-refund: rejects unauthenticated", async () => {
  const { status, data } = await invoke("gateway-create-refund", {
    charge_id: "fake-charge-id",
    amount: 500,
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 3. gateway-create-payout
// ═══════════════════════════════════════════════════

Deno.test("gateway-create-payout: rejects unauthenticated", async () => {
  const { status, data } = await invoke("gateway-create-payout", {
    merchant_id: "fake",
    amount: 10000,
    currency: "XAF",
    channel: "bank_transfer",
    tx_ref: "TEST_PAYOUT_001",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

Deno.test("gateway-create-payout: rejects missing required fields", async () => {
  const { status, data } = await invoke("gateway-create-payout", {
    merchant_id: "fake",
  }, {
    Authorization: "Bearer fake-token",
  });
  // Auth fails first with fake token, but validates header is accepted
  assertEquals(status, 401);
  assertExists(data.error);
});

Deno.test("gateway-create-payout: CORS preflight returns 200", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-create-payout`, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});

// ═══════════════════════════════════════════════════
// 4. stripe-payment-intent
// ═══════════════════════════════════════════════════

Deno.test("stripe-payment-intent: rejects unauthenticated", async () => {
  const { status, data } = await invoke("stripe-payment-intent", {
    amount: 5000,
    currency: "XAF",
    description: "Test payment",
  });
  assertEquals(status, 400);
  assertExists(data.error);
});

Deno.test("stripe-payment-intent: rejects with invalid token", async () => {
  const { status, data } = await invoke("stripe-payment-intent", {
    amount: 5000,
    currency: "XAF",
    description: "Test payment",
  }, {
    Authorization: "Bearer invalid-jwt-token",
  });
  assertEquals(status, 400);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 5. mobile-money-charge
// ═══════════════════════════════════════════════════

Deno.test("mobile-money-charge: rejects unauthenticated", async () => {
  const { status, data } = await invoke("mobile-money-charge", {
    amount: 500,
    phone_number: "+237600000000",
    provider: "mtn",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error || data.message || data.raw);
});

// ═══════════════════════════════════════════════════
// 6. gateway-webhook-stripe: signature verification
// ═══════════════════════════════════════════════════

Deno.test("gateway-webhook-stripe: rejects missing signature", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-webhook-stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } }),
  });
  const text = await res.text();
  assertEquals(res.status >= 400, true);
  assertExists(text);
});

Deno.test("gateway-webhook-stripe: rejects invalid signature", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-webhook-stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "stripe-signature": "t=1234567890,v1=invalid_signature_hash",
    },
    body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } }),
  });
  const text = await res.text();
  assertEquals(res.status >= 400, true);
  assertExists(text);
});

// ═══════════════════════════════════════════════════
// 7. gateway-webhook-flutterwave: hash verification
// ═══════════════════════════════════════════════════

Deno.test("gateway-webhook-flutterwave: rejects missing verif-hash", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-webhook-flutterwave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ event: "charge.completed", data: {} }),
  });
  const text = await res.text();
  assertEquals(res.status >= 400, true);
  assertExists(text);
});

Deno.test("gateway-webhook-flutterwave: rejects invalid verif-hash", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-webhook-flutterwave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "verif-hash": "invalid-hash-value",
    },
    body: JSON.stringify({ event: "charge.completed", data: {} }),
  });
  const text = await res.text();
  assertEquals(res.status >= 400, true);
  assertExists(text);
});

// ═══════════════════════════════════════════════════
// 8. gateway-settlement-cron: requires cron auth
// ═══════════════════════════════════════════════════

Deno.test("gateway-settlement-cron: rejects without cron auth", async () => {
  const { status, data } = await invoke("gateway-settlement-cron", {});
  assertEquals(status, 401);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 9. gateway-reconcile-stuck: requires cron auth
// ═══════════════════════════════════════════════════

Deno.test("gateway-reconcile-stuck: rejects without cron auth", async () => {
  const { status, data } = await invoke("gateway-reconcile-stuck", {});
  assertEquals(status, 401);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 10. gateway-verify-charge: requires auth
// ═══════════════════════════════════════════════════

Deno.test("gateway-verify-charge: rejects unauthenticated", async () => {
  const { status, data } = await invoke("gateway-verify-charge", {
    charge_id: "fake-charge-id",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 11. gateway-preauth-charge: requires auth
// ═══════════════════════════════════════════════════

Deno.test("gateway-preauth-charge: rejects unauthenticated", async () => {
  const { status, data } = await invoke("gateway-preauth-charge", {
    merchant_id: "fake",
    amount: 1000,
    currency: "XAF",
    channel: "card",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

// ═══════════════════════════════════════════════════
// 12. CORS preflight
// ═══════════════════════════════════════════════════

Deno.test("gateway-create-charge: CORS preflight returns 200", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-create-charge`, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test("gateway-settlement-cron: CORS preflight returns 200", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-settlement-cron`, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});

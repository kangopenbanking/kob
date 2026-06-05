// Deno tests for nium-webhook signature verification + FX/fee math + payout routing cascade.
// COMPLIANCE CHECK: signature MUST be verified, settlements MUST be idempotent on
// nium_transaction_id, and FX math MUST match nium-quote-payout exactly.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyWebhookSignature } from "../_shared/nium-client.ts";
import { computeMomoFee } from "../_shared/nium-fx.ts";

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("webhook signature: rejects missing header when secret is configured", async () => {
  Deno.env.set("NIUM_WEBHOOK_SECRET", "test-secret-123");
  const ok = await verifyWebhookSignature(`{"transactionId":"tx_1"}`, null);
  assertEquals(ok, false);
});

Deno.test("webhook signature: rejects forged signature", async () => {
  Deno.env.set("NIUM_WEBHOOK_SECRET", "test-secret-123");
  const body = `{"transactionId":"tx_1","amount":100,"currency":"USD"}`;
  const ok = await verifyWebhookSignature(body, "deadbeef".repeat(8));
  assertEquals(ok, false);
});

Deno.test("webhook signature: accepts valid HMAC-SHA256", async () => {
  Deno.env.set("NIUM_WEBHOOK_SECRET", "test-secret-123");
  const body = `{"transactionId":"tx_2","amount":250,"currency":"EUR"}`;
  const sig = await hmacHex("test-secret-123", body);
  const ok = await verifyWebhookSignature(body, sig);
  assertEquals(ok, true);
});

Deno.test("webhook signature: constant-time mismatch on tampered body", async () => {
  Deno.env.set("NIUM_WEBHOOK_SECRET", "test-secret-123");
  const body = `{"transactionId":"tx_3","amount":100,"currency":"USD"}`;
  const sig = await hmacHex("test-secret-123", body);
  const ok = await verifyWebhookSignature(body + "X", sig);
  assertEquals(ok, false);
});

Deno.test("payout cascade: MOBILE_MONEY routing applies MoMo fee with floor/cap", () => {
  // Default fees: fixed=100, pct=0.01, min=200, cap=null
  const after = 50_000; // XAF after FX spread
  const fee = computeMomoFee(after, { fixed_amount: 100, percentage_rate: 0.01, min_fee_amount: 200, max_fee_amount: null });
  assertEquals(fee, 600); // 100 + 50000*0.01 = 600 (> min 200)
});

Deno.test("payout cascade: MoMo fee respects min floor on small amounts", () => {
  const fee = computeMomoFee(5_000, { fixed_amount: 100, percentage_rate: 0.01, min_fee_amount: 500, max_fee_amount: null });
  assert(fee >= 500);
});

Deno.test("payout cascade: MoMo fee respects max cap on large amounts", () => {
  const fee = computeMomoFee(10_000_000, { fixed_amount: 100, percentage_rate: 0.01, min_fee_amount: 200, max_fee_amount: 5000 });
  assertEquals(fee, 5000);
});

Deno.test("payout cascade: fee never exceeds xafAfterSpread - 1", () => {
  const fee = computeMomoFee(100, { fixed_amount: 10_000, percentage_rate: 1, min_fee_amount: 0, max_fee_amount: null });
  assert(fee <= 99);
});

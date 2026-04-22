// Deno tests for the Integration Layer — pure logic tests (no network).
// Run with: deno test --allow-net --allow-env

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { routePayment, routeTransfer } from "../_shared/integration-layer/router.ts";
import {
  normalizePayment, normalizeAccount, normalizeTransfer,
  envelope, errorEnvelope,
} from "../_shared/integration-layer/normalize.ts";
import { simulate, listMagicValues } from "../_shared/integration-layer/sandbox.ts";
import { sha256 } from "../_shared/integration-layer/idempotency.ts";

Deno.test("router: card payment in CM routes to gateway-create-charge", () => {
  const d = routePayment({ method: "card", country: "CM" });
  assertEquals(d.primary, "gateway-create-charge");
  assertEquals(d.connector, "flutterwave");
});

Deno.test("router: MTN MSISDN routes to mtn_momo", () => {
  const d = routePayment({ method: "mobile_money", country: "CM", msisdn: "237670000000" });
  assertEquals(d.connector, "mtn_momo");
  assertEquals(d.primary, "payment-router-charge");
});

Deno.test("router: Orange MSISDN routes to orange_money", () => {
  const d = routePayment({ method: "mobile_money", country: "CM", msisdn: "237690000000" });
  assertEquals(d.connector, "orange_money");
});

Deno.test("router: bank method routes to PISP first", () => {
  const d = routePayment({ method: "bank" });
  assertEquals(d.primary, "pisp-domestic-payment");
  assertExists(d.fallback);
});

Deno.test("router: transfer defaults to internal ledger", () => {
  const d = routeTransfer({});
  assertEquals(d.primary, "api-transfers");
  assertEquals(d.connector, "internal_ledger");
});

Deno.test("normalize: payment envelope has unified shape", () => {
  const env = normalizePayment({
    id: "ch_123", status: "SUCCESS", amount: 5000, currency: "XAF",
    provider: "flutterwave", reference: "ref_x",
  });
  assertEquals(env.object, "payment");
  assertEquals(env.id, "ch_123");
  assertEquals(env.status, "success");
  assertEquals(env.amount, 5000);
});

Deno.test("normalize: account envelope marks inactive", () => {
  const env = normalizeAccount({ id: "acc_1", is_active: false, currency: "XAF" });
  assertEquals(env.status, "inactive");
});

Deno.test("normalize: transfer envelope preserves reference", () => {
  const env = normalizeTransfer({ id: "tr_1", status: "PENDING", amount: 100, reference: "r" });
  assertEquals(env.status, "pending");
  assertExists(env.data);
});

Deno.test("envelope: includeRaw=false strips raw payload", () => {
  const e = envelope({
    id: "x", object: "payment", status: "succeeded",
    data: { foo: "bar" }, raw: { secret: "leak" }, includeRaw: false,
  });
  assertEquals(e.raw, undefined);
});

Deno.test("error: shape matches Stripe-style envelope", () => {
  const e = errorEnvelope({
    type: "connector_error", code: "x", message: "y", request_id: "req_1",
  });
  assertEquals(e.error.type, "connector_error");
  assertEquals(e.error.request_id, "req_1");
});

Deno.test("sandbox: 4242 simulates success", () => {
  const r = simulate(4242, "sandbox");
  assertEquals(r?.kind, "success");
});

Deno.test("sandbox: 4000 simulates decline", () => {
  const r = simulate(4000, "sandbox");
  assertEquals(r?.kind, "declined");
});

Deno.test("sandbox: live env returns null (no simulation)", () => {
  assertEquals(simulate(4242, "live"), null);
});

Deno.test("sandbox: magic values list is non-empty", () => {
  const list = listMagicValues();
  assertEquals(list.length >= 4, true);
});

Deno.test("idempotency: sha256 produces 64-char hex", async () => {
  const h = await sha256("hello");
  assertEquals(h.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(h), true);
});

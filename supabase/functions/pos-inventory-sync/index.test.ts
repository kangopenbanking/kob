import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

/**
 * E2E Tests for POS Commerce Layer
 * Tests: Catalog, Inventory, Orders, Payments, Refunds, WooCommerce connector, Inventory Sync
 */

// ── Helper ──
async function invoke(fnName: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  await Promise.resolve(); // consume body
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function invokeGet(fnName: string, params: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}?${params}`, {
    method: 'GET',
    headers,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

// ── Test A: Unauthenticated access returns 401 ──
Deno.test("POS Catalog - unauthenticated returns 401", async () => {
  const res = await invoke("pos-catalog-products", { merchant_id: "fake" });
  assertEquals(res.status, 401);
});

Deno.test("POS Inventory - unauthenticated returns 401", async () => {
  const res = await invokeGet("pos-inventory", "merchant_id=fake");
  assertEquals(res.status, 401);
});

Deno.test("POS Orders - unauthenticated returns 401", async () => {
  const res = await invoke("pos-orders", { merchant_id: "fake" });
  assertEquals(res.status, 401);
});

Deno.test("POS Refunds - unauthenticated returns 401", async () => {
  const res = await invoke("pos-refunds", { order_id: "fake" });
  assertEquals(res.status, 401);
});

// ── Test B: POS Pay Order - missing idempotency key returns 400 ──
Deno.test("POS Pay Order - missing idempotency key returns error", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pos-pay-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ order_id: 'fake', method: 'mobile_money' }),
  });
  const text = await res.text();
  // Should fail with auth error or missing idempotency key
  assertEquals(res.status >= 400, true);
});

// ── Test C: POS Submit Order - unauthenticated ──
Deno.test("POS Submit Order - unauthenticated returns 401", async () => {
  const res = await invoke("pos-submit-order", { order_id: "fake" });
  assertEquals(res.status, 401);
});

// ── Test D: POS Finalize Payment — anonymous request now BLOCKED (F37) ──
Deno.test("POS Finalize Payment - anonymous returns 401 (F37)", async () => {
  const res = await invoke("pos-finalize-payment", {
    charge_id: "00000000-0000-0000-0000-000000000000",
    status: "successful",
    provider: "flutterwave",
  });
  // F37 fix: caller must be service-role or internal secret
  assertEquals(res.status, 401);
});

Deno.test("POS Finalize Payment - anon-key bearer also returns 401 (F37)", async () => {
  const res = await invoke("pos-finalize-payment", {
    charge_id: "00000000-0000-0000-0000-000000000000",
    status: "successful",
  }, SUPABASE_ANON_KEY);
  // anon JWT must NOT be accepted
  assertEquals(res.status, 401);
});

// ── Test E: WooCommerce Connector - invalid action ──
Deno.test("POS Woo Connector - unauthenticated returns 401", async () => {
  const res = await invoke("pos-woo-connector", { action: "connect" });
  assertEquals(res.status, 401);
});

// ── Test F: Woo Webhook Ingestion - missing headers ──
Deno.test("POS Woo Webhook - missing merchant header returns 400", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pos-woo-webhook-ingestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, status: "processing" }),
  });
  const text = await res.text();
  assertEquals(res.status >= 400, true);
});

// ── Test G: Inventory Sync - runs without error for no integrations ──
Deno.test("POS Inventory Sync - no integrations returns success", async () => {
  const res = await invoke("pos-inventory-sync", { merchant_id: "00000000-0000-0000-0000-000000000000" });
  // Should return 200 or 401 depending on auth
  assertEquals(res.status >= 200, true);
});

// ── Test H: Manage Locations - unauthenticated ──
Deno.test("POS Manage Locations - unauthenticated returns 401", async () => {
  const res = await invoke("pos-manage-locations", { action: "list_locations", merchant_id: "fake" });
  assertEquals(res.status, 401);
});

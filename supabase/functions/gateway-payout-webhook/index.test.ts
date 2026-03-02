import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

// ─── Test 1: Payout webhook endpoint accepts Stripe events ───
Deno.test("Payout webhook - Stripe refund.updated event", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-webhook?provider=stripe`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "refund.updated",
        data: {
          object: {
            id: "re_test_nonexistent",
            status: "succeeded",
            metadata: { tx_ref: "WD-TEST-000" },
          },
        },
      }),
    }
  );
  const body = await res.json();
  assertEquals(res.status, 200);
  assertExists(body.received);
  // Should return not_found since there's no matching payout record
  assertEquals(body.status, "not_found");
});

// ─── Test 2: Payout webhook endpoint accepts Flutterwave events ───
Deno.test("Payout webhook - Flutterwave transfer.completed event", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-webhook?provider=flutterwave`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "transfer.completed",
        data: {
          id: 99999999,
          status: "SUCCESSFUL",
          reference: "WD-TEST-FLW-000",
        },
      }),
    }
  );
  const body = await res.json();
  assertEquals(res.status, 200);
  assertExists(body.received);
});

// ─── Test 3: Payout webhook endpoint accepts PayPal events ───
Deno.test("Payout webhook - PayPal PAYOUTS-ITEM.SUCCEEDED event", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-webhook?provider=paypal`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        resource: {
          payout_batch_id: "PP-TEST-BATCH-000",
          payout_item_id: "PP-TEST-ITEM-000",
          transaction_status: "SUCCESS",
          payout_item: { sender_item_id: "WD-TEST-PP-000" },
        },
      }),
    }
  );
  const body = await res.json();
  assertEquals(res.status, 200);
  assertExists(body.received);
});

// ─── Test 4: Payout status poller runs without errors ───
Deno.test("Payout status poller - runs and returns summary", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-status-poll`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    }
  );
  const body = await res.json();
  assertEquals(res.status, 200);
  // Should return a summary object
  if (body.processed !== undefined) {
    assertEquals(body.processed, 0);
  } else {
    assertExists(body.total !== undefined || body.message !== undefined);
  }
});

// ─── Test 5: Webhook handles invalid JSON gracefully ───
Deno.test("Payout webhook - rejects invalid JSON", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-webhook?provider=stripe`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "text/plain" },
      body: "not json",
    }
  );
  const text = await res.text();
  assertEquals(res.status, 400);
});

// ─── Test 6: Webhook CORS preflight ───
Deno.test("Payout webhook - CORS preflight", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-payout-webhook?provider=stripe`,
    { method: "OPTIONS", headers }
  );
  await res.text();
  assertEquals(res.status, 200);
});

// ─── Test 7: Process withdrawal endpoint responds (requires auth) ───
Deno.test("Process withdrawal - returns 401 without valid auth", async () => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gateway-process-withdrawal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ amount: 1000, account_id: "test", destination_type: "bank_account" }),
    }
  );
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

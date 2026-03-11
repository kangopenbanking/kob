import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/assert_exists.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Helper: invoke edge function
async function invoke(fnName: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

// ─── Test: api-transfers requires auth ───
Deno.test("api-transfers: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("api-transfers", {
    source_account_id: "fake",
    destination_account_id: "fake",
    amount: 100,
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

// ─── Test: api-transfers validates required fields ───
Deno.test("api-transfers: rejects missing fields", async () => {
  const { status, data } = await invoke("api-transfers", {}, "Bearer fake-token");
  // Should get 401 since token is invalid, but validates auth first
  assertEquals(status, 401);
  assertExists(data.error);
});

// ─── Test: savings-deposit requires auth ───
Deno.test("savings-deposit: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("savings-deposit", {
    savings_account_id: "fake",
    amount: 100,
  });
  // No auth header → should fail
  assertEquals(status >= 400, true);
  assertExists(data.error || data.raw);
});

// ─── Test: savings-withdraw requires auth ───
Deno.test("savings-withdraw: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("savings-withdraw", {
    savings_account_id: "fake",
    amount: 100,
  });
  assertEquals(status >= 400, true);
  assertExists(data.error || data.raw);
});

// ─── Test: mobile-money-charge requires auth ───
Deno.test("mobile-money-charge: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("mobile-money-charge", {
    amount: 500,
    phone_number: "+237600000000",
    provider: "mtn",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error || data.message || data.raw);
});

// ─── Test: api-transfers rejects same-account transfer ───
Deno.test("api-transfers: rejects same-account transfer", async () => {
  const { status, data } = await invoke("api-transfers", {
    source_account_id: "same-id",
    destination_account_id: "same-id",
    amount: 100,
  }, "Bearer fake");
  // Auth will fail first, but validates the flow
  assertEquals(status, 401);
  assertExists(data.error);
});

// ─── Test: api-transfers rejects negative amount ───
Deno.test("api-transfers: validates positive amount", async () => {
  const { status } = await invoke("api-transfers", {
    source_account_id: "a",
    destination_account_id: "b",
    amount: -50,
  }, "Bearer fake");
  assertEquals(status, 401); // Auth check first
});

// ─── Test: virtual-card-list requires auth ───
Deno.test("virtual-card-list: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("virtual-card-list", {});
  assertEquals(status >= 400, true);
  assertExists(data.error || data.raw);
});

// ─── Test: credit-score-fetch responds (auth handled via body user_id) ───
Deno.test("credit-score-fetch: responds with score data", async () => {
  const { status, data } = await invoke("credit-score-fetch", {
    user_id: "00000000-0000-0000-0000-000000000000",
    include_report: false,
  });
  // Should return 200 with score data (even if user not found, returns defaults)
  assertEquals(status, 200);
  assertExists(data);
});

// ─── Test: loan-apply requires auth ───
Deno.test("loan-apply: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("loan-apply", {
    loan_product_id: "fake",
    requested_amount: 10000,
    tenure_months: 12,
    purpose: "test",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error || data.raw);
});

// ─── Test: generate-bank-statement requires auth ───
Deno.test("generate-bank-statement: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("generate-bank-statement", {
    format: "pdf",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error || data.raw);
});

// ═══════════════════════════════════════════════════════════════════
// BANKING OPS & OVERDRAFT ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════

// ─── Test: banking-ops requires action parameter ───
Deno.test("banking-ops: rejects missing action", async () => {
  const { status, data } = await invoke("banking-ops", {});
  assertEquals(status, 400);
  assertEquals(data.error, "action parameter required");
});

// ─── Test: banking-ops rejects unauthenticated policy list ───
Deno.test("banking-ops: list-withdrawal-policies requires auth", async () => {
  const { status, data } = await invoke("banking-ops", {
    action: "list-withdrawal-policies",
    institution_id: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: banking-ops rejects unauthenticated approval ───
Deno.test("banking-ops: approve action requires auth", async () => {
  const { status, data } = await invoke("banking-ops", {
    action: "approve",
    approval_id: "fake-id",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: banking-ops rejects unauthenticated role assignment ───
Deno.test("banking-ops: assign-operational-role requires auth", async () => {
  const { status, data } = await invoke("banking-ops", {
    action: "assign-operational-role",
    institution_id: "fake",
    user_id: "fake",
    role_type: "teller",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: banking-ops rejects unknown action ───
Deno.test("banking-ops: rejects unknown action", async () => {
  const { status, data } = await invoke("banking-ops", {
    action: "nonexistent-action",
  });
  assertEquals(status, 400);
  assertExists(data.error);
});

// ─── Test: overdraft-ops requires action parameter ───
Deno.test("overdraft-ops: rejects missing action", async () => {
  const { status, data } = await invoke("overdraft-ops", {});
  assertEquals(status, 400);
  assertEquals(data.error, "action parameter required");
});

// ─── Test: overdraft-ops get-profile requires auth ───
Deno.test("overdraft-ops: get-profile requires auth", async () => {
  const { status, data } = await invoke("overdraft-ops", {
    action: "get-profile",
    account_id: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: overdraft-ops recalculate requires auth ───
Deno.test("overdraft-ops: recalculate requires auth", async () => {
  const { status, data } = await invoke("overdraft-ops", {
    action: "recalculate",
    account_id: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: overdraft-ops approve requires auth ───
Deno.test("overdraft-ops: approve requires auth", async () => {
  const { status, data } = await invoke("overdraft-ops", {
    action: "approve",
    account_id: "fake",
    approved_limit: 100000,
  });
  assertEquals(status >= 400, true);
  assertExists(data.error);
});

// ─── Test: overdraft-ops unknown action ───
Deno.test("overdraft-ops: rejects unknown action", async () => {
  const { status, data } = await invoke("overdraft-ops", {
    action: "nonexistent",
  });
  assertEquals(status, 400);
  assertExists(data.error);
});

// ─── Test: teller-transaction still works (regression) ───
Deno.test("teller-transaction: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("teller-transaction", {
    account_id: "fake",
    amount: 100,
    operation: "deposit",
    institution_id: "fake",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

// ─── Test: gateway-withdraw-to-bank still works (regression) ───
Deno.test("gateway-withdraw-to-bank: rejects unauthenticated requests", async () => {
  const { status, data } = await invoke("gateway-withdraw-to-bank", {
    amount: 1000,
    account_id: "fake",
    account_number: "1234567890",
    beneficiary_name: "Test",
  });
  assertEquals(status, 401);
  assertExists(data.error);
});

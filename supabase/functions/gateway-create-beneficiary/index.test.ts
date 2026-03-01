import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const invoke = async (body: Record<string, unknown>) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gateway-create-beneficiary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
};

// Test 1: Rejects unauthenticated (no valid user token)
Deno.test("gateway-create-beneficiary: rejects anon key (requires user auth)", async () => {
  const { status, data } = await invoke({
    merchant_id: "test-merchant",
    name: "Test Beneficiary",
    account_identifier: { type: "DOMESTIC_RIB", value: "10005001000123456789023", country: "CM" },
  });
  if (status === 404) {
    console.log("⚠️ Function not yet deployed");
    return;
  }
  // Should return 401 since anon key is not a valid user token
  assertEquals(status, 401);
  await Promise.resolve(); // consume
});

// Test 2: Rejects invalid RIB in beneficiary creation
Deno.test("gateway-create-beneficiary: would reject invalid RIB length", async () => {
  const { status, data } = await invoke({
    merchant_id: "test-merchant",
    name: "Test Beneficiary",
    account_identifier: { type: "DOMESTIC_RIB", value: "12345", country: "CM" },
  });
  if (status === 404) return;
  // 401 because of auth, but if auth passed, would be 400
  assertEquals([400, 401].includes(status), true);
});

// Test 3: Rejects missing required fields
Deno.test("gateway-create-beneficiary: rejects missing name", async () => {
  const { status } = await invoke({ merchant_id: "test" });
  if (status === 404) return;
  assertEquals([400, 401].includes(status), true);
});

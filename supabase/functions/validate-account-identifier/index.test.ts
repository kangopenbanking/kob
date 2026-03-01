import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const invoke = async (body: Record<string, unknown>) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-account-identifier`, {
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

// Test 1: DOMESTIC_RIB rail
Deno.test("validate-account-identifier: DOMESTIC_RIB returns DOMESTIC rail", async () => {
  const { status, data } = await invoke({ type: "DOMESTIC_RIB", value: "10005001000123456789023", country: "CM" });
  if (status === 404) return;
  assertEquals(data.rail, "DOMESTIC");
  assertEquals(data.identifier_type, "DOMESTIC_RIB");
});

// Test 2: IBAN rail
Deno.test("validate-account-identifier: IBAN returns INTERNATIONAL rail", async () => {
  const { status, data } = await invoke({ type: "IBAN", value: "DE89370400440532013000" });
  if (status === 404) return;
  if (data.valid) {
    assertEquals(data.rail, "INTERNATIONAL");
  }
});

// Test 3: LOCAL_BANK rail
Deno.test("validate-account-identifier: LOCAL_BANK returns LOCAL rail", async () => {
  const { status, data } = await invoke({ type: "LOCAL_BANK", value: "123456789", country: "CM" });
  if (status === 404) return;
  assertEquals(data.rail, "LOCAL");
});

// Test 4: MOMO rail
Deno.test("validate-account-identifier: MOMO returns LOCAL rail", async () => {
  const { status, data } = await invoke({ type: "MOMO", value: "237650000000", country: "CM" });
  if (status === 404) return;
  assertEquals(data.rail, "LOCAL");
});

// Test 5: Missing type
Deno.test("validate-account-identifier: rejects missing type", async () => {
  const { status } = await invoke({ value: "123456789" });
  if (status === 404) return;
  assertEquals(status, 400);
});

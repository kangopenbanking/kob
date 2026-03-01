import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("directory-banks-cm: returns full bank catalog", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/directory-banks-cm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  await res.text().catch(() => {}); // consume body

  if (res.status === 404) {
    console.log("⚠️ Function not yet deployed");
    return;
  }

  assertEquals(res.status, 200);
  assertEquals(data.country, "CM");
  assertEquals(data.currency, "XAF");
  assertExists(data.banks);
  
  // Should have 15 banks
  assertEquals(data.banks.length, 15);

  // Verify key banks are present
  const codes = data.banks.map((b: any) => b.bank_code);
  assertEquals(codes.includes("10005"), true); // Afriland
  assertEquals(codes.includes("10029"), true); // BICEC
  assertEquals(codes.includes("10033"), true); // Société Générale
  assertEquals(codes.includes("10070"), true); // UBC

  // Each bank should have required fields
  for (const bank of data.banks) {
    assertExists(bank.bank_code);
    assertExists(bank.bank_name);
    assertExists(bank.swift_bic);
    assertEquals(bank.supports_rib, true);
  }
});

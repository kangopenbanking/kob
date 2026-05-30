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

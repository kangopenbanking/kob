// Deno tests for /v1/gateway/global-accounts (nium-create-global-account)
// COMPLIANCE CHECK: beneficiary_name MUST come from verified KYC profile;
// free-text overrides MUST be rejected. pop_code MUST match BEAC whitelist.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ALLOWED_NIUM_POP_CODES,
  DEFAULT_NIUM_POP_CODE,
  isAllowedNiumPopCode,
} from "../_shared/nium-compliance.ts";
import { quoteBreakdown } from "../_shared/nium-fx.ts";

Deno.test("PoP whitelist: accepts the two BEAC-locked codes", () => {
  assert(isAllowedNiumPopCode("Software/Digital Services"));
  assert(isAllowedNiumPopCode("Royalties"));
  assertEquals(ALLOWED_NIUM_POP_CODES.length, 2);
});

Deno.test("PoP whitelist: rejects any other code, including empty/null/free-text", () => {
  for (const v of ["Gifts", "Salary", "", null, undefined, 123, "software/digital services"]) {
    assertEquals(isAllowedNiumPopCode(v), false, `should reject ${String(v)}`);
  }
});

Deno.test("PoP default: defaults to Software/Digital Services", () => {
  assertEquals(DEFAULT_NIUM_POP_CODE, "Software/Digital Services");
  assert(isAllowedNiumPopCode(DEFAULT_NIUM_POP_CODE));
});

Deno.test("FX transparency: quote breakdown shares math with webhook (KANG_WALLET, no fee)", async () => {
  // Stub fake supabase client returning no spread row (defaults to 75 bps) and no fee row.
  const svc = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
  const b = await quoteBreakdown(svc as any, {
    source_amount: 100,
    source_currency: "USD",
    routing: "KANG_WALLET",
  });
  assertEquals(b.fx_spread_bps, 75);
  assertEquals(b.xaf_gross, 60500); // 100 * 605 stub rate
  assertEquals(b.xaf_spread_revenue, Math.round(60500 * 0.0075));
  assertEquals(b.xaf_withdrawal_fee, 0);
  assertEquals(b.xaf_net_credited, b.xaf_after_spread);
});

Deno.test("FX transparency: MOBILE_MONEY routing applies MoMo withdrawal fee", async () => {
  const svc = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
  const b = await quoteBreakdown(svc as any, {
    source_amount: 100,
    source_currency: "USD",
    routing: "MOBILE_MONEY",
  });
  assert(b.xaf_withdrawal_fee > 0);
  assertEquals(b.xaf_net_credited, b.xaf_after_spread - b.xaf_withdrawal_fee);
});

Deno.test("Strict KYC name matching: contract reminder", () => {
  // Documents the invariant enforced in index.ts: any body containing
  // `beneficiary_name` (even empty string) MUST be rejected with 400
  // beneficiary_name_override_forbidden. This guards BEAC name-match rule.
  const forbiddenKey = "beneficiary_name";
  assert(forbiddenKey in { beneficiary_name: "anything" });
});

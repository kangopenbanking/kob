// Unit tests for the step-up MFA helper.
// Verifies that the JWT inspection rejects aal1 tokens, stale MFA assertions,
// and non-MFA methods (e.g. password-only login), while accepting fresh aal2.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkStepUp } from "./step-up.ts";

function makeToken(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${enc({ alg: "HS256" })}.${enc(payload)}.sig`;
}

const now = () => Math.floor(Date.now() / 1000);

Deno.test("step-up: rejects aal1 tokens", () => {
  const t = makeToken({ aal: "aal1", amr: [{ method: "password", timestamp: now() }] });
  assertEquals(checkStepUp(t).ok, false);
  assertEquals(checkStepUp(t).reason, "aal2_required");
});

Deno.test("step-up: rejects aal2 with no MFA method (e.g. password-only)", () => {
  const t = makeToken({ aal: "aal2", amr: [{ method: "password", timestamp: now() }] });
  assertEquals(checkStepUp(t).ok, false);
  assertEquals(checkStepUp(t).reason, "no_mfa_method");
});

Deno.test("step-up: rejects stale MFA assertion (>10 min old)", () => {
  const t = makeToken({ aal: "aal2", amr: [{ method: "totp", timestamp: now() - 3600 }] });
  const r = checkStepUp(t);
  assertEquals(r.ok, false);
  assertEquals(r.reason, "mfa_stale");
});

Deno.test("step-up: accepts fresh TOTP aal2 token", () => {
  const t = makeToken({ aal: "aal2", amr: [{ method: "totp", timestamp: now() - 30 }] });
  const r = checkStepUp(t);
  assertEquals(r.ok, true);
  assertEquals(r.aal, "aal2");
  assertEquals(r.methods?.[0], "totp");
});

Deno.test("step-up: accepts WebAuthn and phone too", () => {
  for (const method of ["webauthn", "phone", "sms"] as const) {
    const t = makeToken({ aal: "aal2", amr: [{ method, timestamp: now() }] });
    assertEquals(checkStepUp(t).ok, true, `should accept ${method}`);
  }
});

Deno.test("step-up: invalid token shape is rejected", () => {
  assertEquals(checkStepUp("not-a-jwt").ok, false);
  assertEquals(checkStepUp("not-a-jwt").reason, "invalid_token");
});

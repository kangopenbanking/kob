// Phase 1B-R1I-b.2.1 — updateGlobalAccountPayoutPreference idempotency wiring.
// Handler-boundary source guards (executed by Vitest against the Deno file):
//   1. Shared idempotency helper is wired (no bespoke framework).
//   2. Idempotency-Key is read case-insensitively, optional (absence preserved).
//   3. Scope is derived from server-authenticated userId + canonical route only.
//   4. Fingerprint is SHA-256 of canonical(scope + normalised body).
//   5. Reservation happens AFTER authentication + validation, BEFORE the UPDATE.
//   6. Success paths (user + account) store the completed response for replay.
//   7. account_not_found (404) is stored — but validation/auth failures are not.
//   8. CORS allows the Idempotency-Key request header.
//   9. Canonical body normalisation is stable across property ordering.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const handler = fs.readFileSync(
  path.join(root, "supabase/functions/nium-update-payout-preference/index.ts"),
  "utf-8",
);

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}

describe("Phase 1B-R1I-b.2.1 — updatePayoutPreference idempotency wiring", () => {
  it("imports the shared idempotency helper (no bespoke framework)", () => {
    expect(handler).toMatch(/from "\.\.\/_shared\/integration-layer\/idempotency\.ts"/);
    expect(handler).toContain("reserveIdempotency");
    expect(handler).toContain("storeIdempotency");
    expect(handler).toContain("idempotencyResponse");
    expect(handler).toContain("canonicalStringify");
    expect(handler).toContain("sha256(canonical)");
  });

  it("does not introduce a second idempotency framework", () => {
    expect(handler).not.toMatch(/function reserveIdempotency\s*\(/);
    expect(handler).not.toMatch(/function storeIdempotency\s*\(/);
    expect(handler).not.toMatch(/function idempotencyResponse\s*\(/);
  });

  it("reads Idempotency-Key case-insensitively and treats it as optional", () => {
    expect(handler).toMatch(/req\.headers\.get\("Idempotency-Key"\)/);
    expect(handler).toMatch(/req\.headers\.get\("idempotency-key"\)/);
    // The reservation block is guarded by `if (idemKey)` so omission preserves
    // legacy behaviour (no reservation, no completion row).
    expect(handler).toMatch(/if\s*\(\s*idemKey\s*\)\s*\{[\s\S]*?reserveIdempotency/);
  });

  it("scope uses server-authenticated userId — never any client-supplied field", () => {
    expect(handler).toMatch(/scope:\s*\{\s*user_id:\s*userId/);
    // No body.tenant/institution/merchant field is fed into the scope.
    expect(handler).not.toMatch(/scope:\s*\{[^}]*body\.(tenant|institution|merchant)/);
  });

  it("route/method are baked into scope and route constant", () => {
    expect(handler).toMatch(/RESOURCE\s*=\s*"PATCH \/v1\/gateway\/global-accounts\/payout-preference"/);
    expect(handler).toMatch(/method:\s*"PATCH"/);
  });

  it("reservation happens AFTER validation (auth → validate → reserve → mutate)", () => {
    const idxValidateUser = handler.indexOf('body.scope === "user"');
    const idxValidateAccount = handler.indexOf('body.scope === "account"');
    // Locate the reserveIdempotency CALL (arg block), not the import symbol.
    const reserveCall = handler.search(/reserveIdempotency\(\{/);
    const idxUpdate = handler.indexOf('from("profiles").update');
    expect(idxValidateUser).toBeGreaterThan(-1);
    expect(idxValidateAccount).toBeGreaterThan(-1);
    expect(reserveCall).toBeGreaterThan(idxValidateUser);
    expect(reserveCall).toBeGreaterThan(idxValidateAccount);
    expect(idxUpdate).toBeGreaterThan(reserveCall);
  });

  it("user-scope success path stores the response for replay", () => {
    const block = handler.match(/from\("profiles"\)\.update[\s\S]*?return json\(resp\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("storeIdempotency");
    expect(block![0]).toMatch(/status:\s*200/);
  });

  it("account-scope success path stores the response for replay", () => {
    const block = handler.match(/from\("nium_global_accounts"\)\.update[\s\S]*?return json\(resp\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("storeIdempotency");
    expect(block![0]).toMatch(/status:\s*200/);
  });

  it("account_not_found (404) is stored so replays return the same 404", () => {
    const block = handler.match(/account_not_found[\s\S]{0,500}?return json\(notFound, 404\)/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("storeIdempotency");
    expect(block![0]).toMatch(/status:\s*404/);
  });

  it("does NOT store completion for pre-reservation validation errors", () => {
    const reserveCall = handler.search(/reserveIdempotency\(\{/);
    for (const marker of [
      '"invalid_payout_preference"',
      '"payout_channel_required"',
      '"invalid_payout_preference_override"',
      '"invalid_scope"',
      '"account_id_required"',
      '"invalid_json"',
    ]) {
      const idx = handler.indexOf(marker);
      expect(idx, `marker missing: ${marker}`).toBeGreaterThan(-1);
      expect(idx, `marker moved past reservation: ${marker}`).toBeLessThan(reserveCall);
    }
  });

  it("CORS allows the Idempotency-Key request header", () => {
    expect(handler).toMatch(/Access-Control-Allow-Headers[\s\S]*?idempotency-key/);
  });

  it("canonical fingerprint is stable across property ordering", () => {
    const a = { scope: "user", payout_preference: "MOBILE_MONEY", payout_channel: "+237600000000" };
    const b = { payout_channel: "+237600000000", payout_preference: "MOBILE_MONEY", scope: "user" };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("canonical fingerprint changes when destination/preference materially changes", () => {
    const a = { scope: "user", payout_preference: "KANG_WALLET", payout_channel: null };
    const b = { scope: "user", payout_preference: "MOBILE_MONEY", payout_channel: "+237600000000" };
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));

    const c = { scope: "account", account_id: "acc-1", payout_preference_override: "KANG_WALLET", payout_channel_override: null };
    const d = { scope: "account", account_id: "acc-2", payout_preference_override: "KANG_WALLET", payout_channel_override: null };
    expect(canonicalStringify(c)).not.toBe(canonicalStringify(d));
  });

  it("canonical fingerprint excludes undefined but preserves null (clears)", () => {
    expect(canonicalStringify({ payout_channel: undefined, payout_preference_override: null }))
      .toBe('{"payout_preference_override":null}');
  });

  it("reservation is per-user (merchantId=userId), not per-body-tenant", () => {
    expect(handler).toMatch(/reserveIdempotency\(\{[\s\S]*?merchantId:\s*userId/);
    expect(handler).toMatch(/storeIdempotency\(\{[\s\S]*?merchantId:\s*userId/);
  });

  it("account-scope UPDATE filters by both id AND user_id (ownership check)", () => {
    expect(handler).toMatch(/\.eq\("id",\s*normalised\.account_id\)\.eq\("user_id",\s*userId\)/);
  });

  it("does not log the Authorization header or payout destination secrets", () => {
    // No console.log of auth/body/payout_channel that would leak PII / bearer.
    expect(handler).not.toMatch(/console\.(log|info|debug)\([^)]*(?:auth|Authorization|payout_channel|body)\s*\)/);
  });
});

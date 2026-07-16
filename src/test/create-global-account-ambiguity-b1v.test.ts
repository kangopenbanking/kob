// Phase 1B-R1I-b.1V — createGlobalAccount provider-ambiguity guards.
//
// Verifies the handler cannot cause a duplicate provider account when the
// provider result is unknown (timeout, connection reset, interrupted
// response, invalid provider response, local crash after provider success).
//
// The Deno runtime handler is inspected via source assertions (same
// approach as b.1 wiring tests — vitest cannot exercise Deno.serve
// directly, but ratchet-locked source guards deterministically enforce
// the wiring contract on every commit).
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const handler = fs.readFileSync(
  path.join(root, "supabase/functions/nium-create-global-account/index.ts"),
  "utf-8",
);

describe("Phase 1B-R1I-b.1V — createGlobalAccount provider-ambiguity guards", () => {
  // ── Ambiguity completion (§6, §11) ──────────────────────────────────────
  it("catch block stores an ambiguity completion under the idempotency key", () => {
    const block = handler.match(/console\.error\("nium createGlobalAccount failed"[\s\S]*?json\(ambiguity, 502\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("storeIdempotency");
    expect(block![0]).toMatch(/status:\s*502/);
  });

  it("ambiguity response uses a stable machine code (PROVIDER_RESULT_UNKNOWN)", () => {
    expect(handler).toContain('"PROVIDER_RESULT_UNKNOWN"');
    expect(handler).toContain('nium_provider_result_unknown');
  });

  it("ambiguity response does not leak provider secrets or stack traces", () => {
    const block = handler.match(/console\.error\("nium createGlobalAccount failed"[\s\S]*?json\(ambiguity, 502\);/)![0];
    // Only the sanitised message is included — no raw error object, no stack.
    expect(block).not.toMatch(/e\.stack/);
    expect(block).not.toMatch(/JSON\.stringify\(e\)/);
    expect(block).not.toMatch(/NIUM_API_KEY|NIUM_CLIENT_ID|x-api-key/);
  });

  // ── Reconciliation-on-replay (§7, §8, §9) ───────────────────────────────
  it("reconciles by re-checking nium_global_accounts before replaying a 502", () => {
    // Recognises the ambiguity-marker cached body and re-queries the local
    // provider-account table for a recovered row.
    expect(handler).toMatch(/reservation\.kind === "replay"/);
    expect(handler).toMatch(/reservation\.status === 502/);
    expect(handler).toMatch(/code:\s*string.*PROVIDER_RESULT_UNKNOWN/s);
    expect(handler).toMatch(/from\("nium_global_accounts"\)[\s\S]*?\.eq\("user_id",\s*userId\)[\s\S]*?\.eq\("currency",\s*currency\)/);
  });

  it("on successful reconciliation, promotes the cached response to a 200 replay", () => {
    // Upgraded body is stored so subsequent retries see the success directly.
    expect(handler).toMatch(/reconciled:\s*true/);
    expect(handler).toMatch(/storeIdempotency\([^)]*status:\s*200,\s*body:\s*upgraded/);
  });

  it("reconciliation-on-replay does NOT fall through to the provider path", () => {
    // The reconciliation branch must return; it must never continue into the
    // createGlobalAccount call below. The comment marker locks this intent.
    const recon = handler.match(/reconciliation-on-replay[\s\S]*?const early = idempotencyResponse/i);
    expect(recon).toBeTruthy();
    expect(recon![0]).not.toMatch(/await createGlobalAccount/);
  });

  // ── Same-key retry cannot re-invoke provider (§6, §12) ──────────────────
  it("identical retry paths (replay + in_flight + conflict) all return before createGlobalAccount", () => {
    // idempotencyResponse() short-circuits every non-miss reservation and
    // returns before the try/catch that calls createGlobalAccount.
    const upTo = handler.slice(0, handler.indexOf("await createGlobalAccount"));
    expect(upTo).toContain("idempotencyResponse(reservation, corsHeaders)");
    expect(upTo).toMatch(/if \(early\) return early;/);
  });

  it("changed request body with the same key remains a 409 conflict (delegated to helper)", () => {
    // Handler relies on reserveIdempotency's fingerprint comparison; that
    // helper is the single source of truth for IDEMPOTENCY_KEY_REUSED.
    expect(handler).toMatch(/reserveIdempotency\(\{/);
    expect(handler).not.toMatch(/IDEMPOTENCY_KEY_REUSED/); // never re-implemented here
  });

  // ── Tenant isolation (§6, §14) ──────────────────────────────────────────
  it("reservation and reconciliation are both scoped to the authenticated userId", () => {
    expect(handler).toMatch(/merchantId:\s*userId/);
    // Reconciliation query is filtered by user_id derived from JWT claims.
    expect(handler).toMatch(/\.eq\("user_id",\s*userId\)/);
    // No request-body-supplied tenant/institution is ever used as scope.
    expect(handler).not.toMatch(/merchantId:\s*body\.(tenant|institution|merchant)/);
  });

  it("authentication precedes any idempotency or provider work", () => {
    const authIdx = handler.indexOf("auth.getClaims");
    // Match the reservation CALL, not the top-of-file import statement.
    const reserveIdx = handler.indexOf("reserveIdempotency({");
    const providerIdx = handler.indexOf("await createGlobalAccount");
    expect(authIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeGreaterThan(authIdx);
    expect(providerIdx).toBeGreaterThan(reserveIdx);
  });

  // ── Contract stability (§18) ────────────────────────────────────────────
  it("does not introduce a new public status code or response media type", () => {
    // Ambiguity still uses the existing 502 declared in OpenAPI; no new
    // status like 202/425 has been added.
    expect(handler).not.toMatch(/\}, 202\)/);
    expect(handler).not.toMatch(/\}, 425\)/);
    // Content-Type stays application/json (no application/problem+json shift
    // that would drift from the published OpenAPI response media type).
    expect(handler).not.toContain("application/problem+json");
  });

  it("does not introduce a second idempotency framework (§Prohibited)", () => {
    expect(handler).not.toMatch(/function reserveIdempotency/);
    expect(handler).not.toMatch(/function storeIdempotency/);
  });

  it("does not silently swallow the provider error — surfaces sanitised detail", () => {
    const block = handler.match(/console\.error\("nium createGlobalAccount failed"[\s\S]*?json\(ambiguity, 502\);/)![0];
    expect(block).toMatch(/detail:\s*String\(/);
  });
});

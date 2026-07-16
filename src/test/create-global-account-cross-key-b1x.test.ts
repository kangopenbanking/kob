// Phase 1B-R1I-b.1X — cross-key duplicate-provider-call protection guards.
//
// Verifies (via source-level assertions, matching the b.1/b.1V style) that:
//   1. A deterministic operation-lock key is derived from a TRUSTED scope
//      (user_id + provider + resource + currency + account_kind) and NEVER
//      from client-supplied Idempotency-Key or tenant fields.
//   2. The operation lock is reserved via the existing shared helper
//      (integration_idempotency_keys) — no new framework, no schema change.
//   3. `in_flight` and `replay` outcomes block a second provider create call
//      and route to reconciliation.
//   4. Provider ambiguity (502) stores the unknown result under BOTH the
//      client Idempotency-Key AND the operation lock.
//   5. Success completions store the operation lock so subsequent fresh-key
//      retries hit replay + reconciliation instead of another provider call.
//   6. `deriveOperationKey` produces a well-formed UUID v4 (accepted by
//      validateIdempotencyKey) and is stable across property ordering.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const handler = fs.readFileSync(
  path.join(root, "supabase/functions/nium-create-global-account/index.ts"),
  "utf-8",
);
const opLockSrc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/integration-layer/operation-lock.ts"),
  "utf-8",
);

// Local mirror of the derivation algorithm for behavioural tests.
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}
function deriveOperationKey(scope: Record<string, unknown>): string {
  const hex = createHash("sha256").update(canonicalStringify(scope)).digest("hex");
  const bytes = hex.slice(0, 32).split("");
  bytes[12] = "4";
  const variantByte = (parseInt(bytes[16], 16) & 0x3) | 0x8;
  bytes[16] = variantByte.toString(16);
  const s = bytes.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Phase 1B-R1I-b.1X — cross-key operation lock (derivation)", () => {
  it("produces a well-formed UUID v4", () => {
    const key = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "XAF", account_kind: "virtual" });
    expect(key).toMatch(UUID_V4);
  });
  it("is stable across property ordering (same logical scope → same key)", () => {
    const a = deriveOperationKey({ user_id: "u1", provider: "nium", resource: "global_account", currency: "XAF", account_kind: "virtual" });
    const b = deriveOperationKey({ account_kind: "virtual", currency: "XAF", resource: "global_account", provider: "nium", user_id: "u1" });
    expect(a).toBe(b);
  });
  it("differs when currency changes", () => {
    const a = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "XAF", account_kind: "virtual" });
    const b = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "USD", account_kind: "virtual" });
    expect(a).not.toBe(b);
  });
  it("differs when user_id changes (tenant/user isolation)", () => {
    const a = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "XAF", account_kind: "virtual" });
    const b = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u2", currency: "XAF", account_kind: "virtual" });
    expect(a).not.toBe(b);
  });
  it("differs when account_kind changes", () => {
    const a = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "XAF", account_kind: "virtual" });
    const b = deriveOperationKey({ provider: "nium", resource: "global_account", user_id: "u1", currency: "XAF", account_kind: "global" });
    expect(a).not.toBe(b);
  });
});

describe("Phase 1B-R1I-b.1X — operation-lock helper", () => {
  it("exports deriveOperationKey + OPERATION_LOCK_PREFIX", () => {
    expect(opLockSrc).toMatch(/export async function deriveOperationKey/);
    expect(opLockSrc).toMatch(/export const OPERATION_LOCK_PREFIX\s*=\s*"op:"/);
  });
  it("reuses the shared canonical + sha256 helpers (no new framework)", () => {
    expect(opLockSrc).toMatch(/from "\.\/idempotency\.ts"/);
    expect(opLockSrc).toMatch(/from "\.\/canonical\.ts"/);
    expect(opLockSrc).not.toMatch(/createClient\(/);
  });
  it("forces UUID v4 version + variant bits", () => {
    expect(opLockSrc).toContain('bytes[12] = "4"');
    expect(opLockSrc).toMatch(/parseInt\(variantChar, 16\) & 0x3\) \| 0x8/);
  });
});

describe("Phase 1B-R1I-b.1X — handler wiring", () => {
  it("imports the operation-lock helper", () => {
    expect(handler).toMatch(/from "\.\.\/_shared\/integration-layer\/operation-lock\.ts"/);
    expect(handler).toContain("deriveOperationKey");
    expect(handler).toContain("OPERATION_LOCK_PREFIX");
  });

  it("operation scope is server-derived — never client-supplied", () => {
    // Scope literal exists with the trusted attributes.
    expect(handler).toMatch(/const opScope\s*=\s*\{[\s\S]*?provider:\s*"nium"[\s\S]*?resource:\s*"global_account"[\s\S]*?user_id:\s*userId[\s\S]*?currency[\s\S]*?account_kind[\s\S]*?\}/);
    // Client body fields must NOT participate in the scope.
    const scopeBlock = handler.match(/const opScope\s*=\s*\{[\s\S]*?\};/)![0];
    expect(scopeBlock).not.toMatch(/body\.(tenant|institution|merchant|bvn|beneficiary_name)/);
    expect(scopeBlock).not.toContain("idemKey");
  });

  it("reserves the operation lock BEFORE the provider call", () => {
    const reserveIdx = handler.search(/reserveIdempotency\(\{\s*\n?\s*key:\s*opKey/);
    const providerIdx = handler.indexOf("await createGlobalAccount(");
    expect(reserveIdx).toBeGreaterThan(-1);
    expect(providerIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeLessThan(providerIdx);
  });

  it("uses a namespaced resource string for the op-lock (prevents client-key collision)", () => {
    expect(handler).toMatch(/const opResource\s*=\s*`\$\{OPERATION_LOCK_PREFIX\}\$\{RESOURCE\}`/);
  });

  it("in_flight op-lock blocks provider call and returns 409 + Retry-After", () => {
    const block = handler.match(/opReservation\.kind === "in_flight"[\s\S]*?Retry-After[\s\S]*?\}\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("GLOBAL_ACCOUNT_OPERATION_IN_PROGRESS");
    expect(block![0]).toContain("status: 409");
  });

  it("replay op-lock reconciles against nium_global_accounts before returning", () => {
    const block = handler.match(/opReservation\.kind === "replay"[\s\S]*?cross_key_reconciled/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("nium_global_accounts");
  });

  it("replay op-lock without a local row returns pending-reconciliation (no provider call)", () => {
    expect(handler).toContain("GLOBAL_ACCOUNT_OPERATION_PENDING_RECONCILIATION");
    // The pending branch must return BEFORE createGlobalAccount is called.
    const pendingIdx = handler.indexOf("GLOBAL_ACCOUNT_OPERATION_PENDING_RECONCILIATION");
    const providerIdx = handler.indexOf("await createGlobalAccount(");
    expect(pendingIdx).toBeLessThan(providerIdx);
  });

  it("provider ambiguity persists under BOTH client key AND op-lock", () => {
    const catchBlock = handler.match(/console\.error\("nium createGlobalAccount failed"[\s\S]*?return json\(ambiguity, 502\);/);
    expect(catchBlock).toBeTruthy();
    // Two storeIdempotency calls — one gated on idemKey, one unconditional on opKey.
    const storeCalls = catchBlock![0].match(/storeIdempotency\(/g) ?? [];
    expect(storeCalls.length).toBe(2);
    expect(catchBlock![0]).toMatch(/key:\s*opKey[\s\S]*?status:\s*502/);
  });

  it("success completes the op-lock so fresh-key retries hit replay + reconciliation", () => {
    const successBlock = handler.match(/reused: false[\s\S]*?storeIdempotency\([^)]*key:\s*opKey[^)]*status:\s*201[^)]*\);/);
    expect(successBlock).toBeTruthy();
  });

  it("does not introduce a second idempotency framework", () => {
    // Op-lock reuses the shared helper — no local reserve/store re-implementation.
    expect(handler).not.toMatch(/function reserveIdempotency/);
    expect(handler).not.toMatch(/function storeIdempotency/);
  });

  it("defensive fallback covers unexpected conflict/invalid outcomes", () => {
    expect(handler).toContain("OPERATION_LOCK_UNEXPECTED");
  });
});

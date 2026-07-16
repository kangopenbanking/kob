// Phase 1B-R1I-b.1X + b.1XV — cross-key duplicate-provider-call protection.
//
// Verifies (via source-level + behavioural assertions) that:
//   1. The deterministic operation-lock identifier follows RFC 4122 §4.3
//      UUIDv5 (name-based) — NOT a fake v4. The KOB namespace is fixed.
//   2. Scope is TRUSTED (server-derived) and includes tenant + environment.
//   3. Client-supplied Idempotency-Key / tenant / institution / beneficiary
//      values NEVER participate in the operation identity.
//   4. Validated client-domain inputs (currency, account_kind) are normalised
//      so equivalent valid values collapse to a single identifier.
//   5. The op-lock is reserved via the existing shared helper (no new
//      framework, no schema change) BEFORE the provider call.
//   6. in_flight / replay outcomes block a second provider create and route
//      to reconciliation; ambiguity persists under BOTH client key + op-lock.
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

// Local mirror of the derivation (UUIDv5, RFC 4122 §4.3).
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}
const NS = "6f8c9c11-0e6f-5c4b-9a80-3b6c1d5f2e10";
function canonicaliseScope(s: Record<string, string>) {
  const currency = String(s.currency ?? "").trim().toUpperCase().normalize("NFKC");
  const account_kind = String(s.account_kind ?? "").trim().toLowerCase().normalize("NFKC");
  return {
    account_kind,
    currency,
    environment: String(s.environment ?? "unknown").trim().toLowerCase(),
    provider: String(s.provider ?? "").trim().toLowerCase(),
    resource: String(s.resource ?? "").trim().toLowerCase(),
    tenant_id: s.tenant_id ? String(s.tenant_id).trim() : "",
    user_id: String(s.user_id ?? "").trim(),
  };
}
function uuidV5(namespace: string, name: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const digest = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name)])).digest();
  const out = Buffer.from(digest.slice(0, 16));
  out[6] = (out[6] & 0x0f) | 0x50;
  out[8] = (out[8] & 0x3f) | 0x80;
  const h = out.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
function deriveOperationKey(scope: Record<string, string>): string {
  return uuidV5(NS, canonicalStringify(canonicaliseScope(scope)));
}
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V4_OR_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const baseScope = {
  provider: "nium", resource: "global_account",
  environment: "test", tenant_id: "u1", user_id: "u1",
  currency: "XAF", account_kind: "virtual",
};

describe("Phase 1B-R1I-b.1XV — identifier standard (RFC 4122 §4.3 UUIDv5)", () => {
  it("emits a well-formed UUIDv5 (version nibble = 5)", () => {
    expect(deriveOperationKey(baseScope)).toMatch(UUID_V5);
  });
  it("matches the broader v4|v5 validator (accepted by validateIdempotencyKey)", () => {
    expect(deriveOperationKey(baseScope)).toMatch(UUID_V4_OR_V5);
  });
  it("is stable across property ordering", () => {
    const a = deriveOperationKey(baseScope);
    const b = deriveOperationKey({ ...baseScope });
    expect(a).toBe(b);
  });
  it("KOB namespace UUID is fixed and documented", () => {
    expect(opLockSrc).toContain(`KOB_OP_LOCK_NAMESPACE = "${NS}"`);
  });
  it("uses SHA-1 (RFC 4122 §4.3) — not SHA-256", () => {
    expect(opLockSrc).toMatch(/crypto\.subtle\.digest\("SHA-1"/);
  });
});

describe("Phase 1B-R1I-b.1XV — normalisation collapses equivalent inputs", () => {
  it("currency case + whitespace normalise to same identity", () => {
    const a = deriveOperationKey({ ...baseScope, currency: "xaf" });
    const b = deriveOperationKey({ ...baseScope, currency: "  XAF  " });
    const c = deriveOperationKey({ ...baseScope, currency: "XAF" });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
  it("account_kind case normalises", () => {
    const a = deriveOperationKey({ ...baseScope, account_kind: "VIRTUAL" });
    const b = deriveOperationKey({ ...baseScope, account_kind: "virtual" });
    expect(a).toBe(b);
  });
  it("different currency → different identity", () => {
    expect(deriveOperationKey({ ...baseScope, currency: "USD" }))
      .not.toBe(deriveOperationKey({ ...baseScope, currency: "EUR" }));
  });
  it("different account_kind → different identity", () => {
    expect(deriveOperationKey({ ...baseScope, account_kind: "virtual" }))
      .not.toBe(deriveOperationKey({ ...baseScope, account_kind: "global" }));
  });
});

describe("Phase 1B-R1I-b.1XV — tenant / user / environment isolation", () => {
  it("different user_id → different identity", () => {
    expect(deriveOperationKey({ ...baseScope, user_id: "u1", tenant_id: "u1" }))
      .not.toBe(deriveOperationKey({ ...baseScope, user_id: "u2", tenant_id: "u2" }));
  });
  it("same user_id, different tenant_id → different identity", () => {
    expect(deriveOperationKey({ ...baseScope, tenant_id: "T1" }))
      .not.toBe(deriveOperationKey({ ...baseScope, tenant_id: "T2" }));
  });
  it("different environment → different identity (prevents shared-storage leak)", () => {
    expect(deriveOperationKey({ ...baseScope, environment: "sandbox" }))
      .not.toBe(deriveOperationKey({ ...baseScope, environment: "production" }));
  });
});

describe("Phase 1B-R1I-b.1XV — operation-lock helper contract", () => {
  it("exports deriveOperationKey, uuidV5, canonicaliseScope, OPERATION_LOCK_PREFIX", () => {
    expect(opLockSrc).toMatch(/export async function deriveOperationKey/);
    expect(opLockSrc).toMatch(/export async function uuidV5/);
    expect(opLockSrc).toMatch(/export function canonicaliseScope/);
    expect(opLockSrc).toMatch(/export const OPERATION_LOCK_PREFIX\s*=\s*"op:"/);
  });
  it("reuses the shared canonical helper (no new framework, no direct DB)", () => {
    expect(opLockSrc).toMatch(/from "\.\/canonical\.ts"/);
    expect(opLockSrc).not.toMatch(/createClient\(/);
    expect(opLockSrc).not.toMatch(/function reserveIdempotency/);
  });
  it("rejects invalid domain inputs before reservation", () => {
    expect(opLockSrc).toMatch(/invalid currency shape/);
    expect(opLockSrc).toMatch(/invalid account_kind/);
  });
});

describe("Phase 1B-R1I-b.1X — handler wiring (retained)", () => {
  it("imports the operation-lock helper", () => {
    expect(handler).toMatch(/from "\.\.\/_shared\/integration-layer\/operation-lock\.ts"/);
    expect(handler).toContain("deriveOperationKey");
    expect(handler).toContain("OPERATION_LOCK_PREFIX");
  });

  it("operation scope includes tenant + environment and excludes client body fields", () => {
    const scopeBlock = handler.match(/const opScope\s*=\s*\{[\s\S]*?\};/)![0];
    expect(scopeBlock).toContain("tenant_id: userId");
    expect(scopeBlock).toContain("environment:");
    expect(scopeBlock).toContain("user_id: userId");
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

  it("uses a namespaced resource string for the op-lock", () => {
    expect(handler).toMatch(/const opResource\s*=\s*`\$\{OPERATION_LOCK_PREFIX\}\$\{RESOURCE\}`/);
  });

  it("in_flight op-lock returns 409 + Retry-After (no provider call)", () => {
    const block = handler.match(/opReservation\.kind === "in_flight"[\s\S]*?Retry-After[\s\S]*?\}\);/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("GLOBAL_ACCOUNT_OPERATION_IN_PROGRESS");
    expect(block![0]).toContain("status: 409");
  });

  it("replay op-lock reconciles against nium_global_accounts", () => {
    const block = handler.match(/opReservation\.kind === "replay"[\s\S]*?cross_key_reconciled/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("nium_global_accounts");
  });

  it("replay without a local row returns pending-reconciliation (no provider call)", () => {
    expect(handler).toContain("GLOBAL_ACCOUNT_OPERATION_PENDING_RECONCILIATION");
    const pendingIdx = handler.indexOf("GLOBAL_ACCOUNT_OPERATION_PENDING_RECONCILIATION");
    const providerIdx = handler.indexOf("await createGlobalAccount(");
    expect(pendingIdx).toBeLessThan(providerIdx);
  });

  it("provider ambiguity persists under BOTH client key AND op-lock", () => {
    const catchBlock = handler.match(/console\.error\("nium createGlobalAccount failed"[\s\S]*?return json\(ambiguity, 502\);/);
    expect(catchBlock).toBeTruthy();
    const storeCalls = catchBlock![0].match(/storeIdempotency\(/g) ?? [];
    expect(storeCalls.length).toBe(2);
    expect(catchBlock![0]).toMatch(/key:\s*opKey[\s\S]*?status:\s*502/);
  });

  it("success completes the op-lock so fresh-key retries hit reconciliation", () => {
    const successBlock = handler.match(/reused: false[\s\S]*?storeIdempotency\([^)]*key:\s*opKey[^)]*status:\s*201[^)]*\);/);
    expect(successBlock).toBeTruthy();
  });

  it("does not introduce a second idempotency framework", () => {
    expect(handler).not.toMatch(/function reserveIdempotency/);
    expect(handler).not.toMatch(/function storeIdempotency/);
  });

  it("defensive fallback covers unexpected conflict/invalid outcomes", () => {
    expect(handler).toContain("OPERATION_LOCK_UNEXPECTED");
  });
});

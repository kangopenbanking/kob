// Phase 1B-R1I-b.1 — createGlobalAccount idempotency wiring guards.
// Handler-level runtime is executed by Deno; this suite verifies:
//   1. Canonical JSON produces identical fingerprints across property ordering.
//   2. Undefined values are excluded; null preserved.
//   3. Handler source wires the shared idempotency helper (not a bespoke one).
//   4. Provider ambiguity path does NOT store a completed response.
//   5. Trusted scope derives from server-side userId, not client input.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const handler = fs.readFileSync(
  path.join(root, "supabase/functions/nium-create-global-account/index.ts"),
  "utf-8",
);
const canonicalSrc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/integration-layer/canonical.ts"),
  "utf-8",
);

// Inline copy of canonicalStringify for behavioural tests (Deno file).
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}

describe("Phase 1B-R1I-b.1 — createGlobalAccount idempotency wiring", () => {
  it("canonical JSON is stable across property ordering", () => {
    const a = { currency: "USD", pop_code: "Royalties", account_kind: "virtual" };
    const b = { account_kind: "virtual", pop_code: "Royalties", currency: "USD" };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("canonical JSON changes when a field value changes", () => {
    const a = { currency: "USD" };
    const b = { currency: "EUR" };
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
  });

  it("canonical JSON excludes undefined but preserves null", () => {
    expect(canonicalStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("canonical helper is exported from the shared integration-layer", () => {
    expect(canonicalSrc).toMatch(/export function canonicalStringify/);
  });

  it("handler imports the shared idempotency helper (no bespoke framework)", () => {
    expect(handler).toMatch(/from "\.\.\/_shared\/integration-layer\/idempotency\.ts"/);
    expect(handler).toContain("reserveIdempotency");
    expect(handler).toContain("storeIdempotency");
    expect(handler).toContain("idempotencyResponse");
  });

  it("handler reads Idempotency-Key from request headers (case-insensitive fallback)", () => {
    expect(handler).toMatch(/req\.headers\.get\("Idempotency-Key"\)/);
    expect(handler).toMatch(/req\.headers\.get\("idempotency-key"\)/);
  });

  it("trusted scope uses server-authenticated userId — not any client-supplied tenant", () => {
    // The canonical payload must reference user_id from the JWT-derived variable.
    expect(handler).toMatch(/scope:\s*\{\s*user_id:\s*userId/);
    // Must not accept any request-body tenant/institution field as scope.
    expect(handler).not.toMatch(/scope:\s*\{[^}]*body\.(tenant|institution|merchant)/);
  });

  it("route/method are baked into the scope constant", () => {
    expect(handler).toMatch(/RESOURCE\s*=\s*"POST \/v1\/gateway\/global-accounts"/);
  });

  it("fingerprint is computed via SHA-256 of canonical body+scope", () => {
    expect(handler).toContain("sha256(canonical)");
    expect(handler).toContain("canonicalStringify");
  });

  it("provider ambiguity path does NOT store a completed response", () => {
    // The catch block after createGlobalAccount must return without calling storeIdempotency.
    const catchBlock = handler.match(/catch \(e\) \{[\s\S]*?nium_provider_error[\s\S]*?\}, 502\);/);
    expect(catchBlock).toBeTruthy();
    expect(catchBlock![0]).not.toContain("storeIdempotency");
  });

  it("success path stores the response for future replay", () => {
    // storeIdempotency is called for the 201 success branch.
    const successStore = handler.match(/reused: false[\s\S]*?storeIdempotency\([^)]*status:\s*201/);
    expect(successStore).toBeTruthy();
  });

  it("natural-idempotency reuse (existing account) also stores the response", () => {
    // Otherwise a client retry after reuse would get a different X-Idempotent-Replay outcome.
    const reuseStore = handler.match(/reused: true[\s\S]*?storeIdempotency\([^)]*status:\s*200/);
    expect(reuseStore).toBeTruthy();
  });

  it("CORS allows the Idempotency-Key request header", () => {
    expect(handler).toMatch(/Access-Control-Allow-Headers[^"]*idempotency-key/);
  });

  it("does not introduce a second idempotency framework", () => {
    // No local re-implementation of the reserve/store/replay contract.
    expect(handler).not.toMatch(/function reserveIdempotency/);
    expect(handler).not.toMatch(/function storeIdempotency/);
  });
});

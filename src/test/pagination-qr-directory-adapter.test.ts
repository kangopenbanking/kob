/**
 * Phase 1B — R1I-d.2B-I1c-X2-A — Adapter tests for the isolated
 * qr-directory pagination helper.
 *
 * Exercises `supabase/functions/merchants-qr-directory/_pagination-qr-directory.ts`
 * against the ratified X2 compatibility decision. No live runtime,
 * OpenAPI, SDK, database, Supabase client, or bearer / API-credential is
 * touched. Only the shared foundation and this operation adapter are
 * exercised.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  QR_DIRECTORY_OPERATION_ID,
  QR_DIRECTORY_DEFAULT_LIMIT,
  QR_DIRECTORY_MAX_LIMIT,
  QR_DIRECTORY_CURSOR_LIFETIME_SECONDS,
  QR_DIRECTORY_ORDER_PROFILE,
  QR_DIRECTORY_PAGINATION_HEADER_NAMES,
  QR_DIRECTORY_ACCESS_CONTROL_EXPOSE_HEADERS,
  normalizeQrDirectoryEnvironment,
  normalizeQrDirectoryFilters,
  parseQrDirectoryLimit,
  computeQrDirectoryScopeHash,
  computeQrDirectoryFilterHash,
  encodeQrDirectoryCursor,
  decodeQrDirectoryCursor,
  finalizeQrDirectoryPage,
  type QrDirectoryFilters,
} from "../../supabase/functions/merchants-qr-directory/_pagination-qr-directory";
import {
  encodeCursor,
  hashFilters,
  hashScope,
  PaginationConfigurationError,
} from "../../supabase/functions/_shared/pagination";

const TEST_SECRET = "qr-directory-adapter-test-secret-".padEnd(64, "x");
const ALT_SECRET = "qr-directory-alt-secret-".padEnd(64, "y");
const NO_FILTERS: QrDirectoryFilters = { country: null, category: null };
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";

// -----------------------------------------------------------------------------
// Configuration

describe("R1I-d.2B-I1c-X2-A — configuration", () => {
  it("operation ID is exactly merchantsQrDirectoryList", () => {
    expect(QR_DIRECTORY_OPERATION_ID).toBe("merchantsQrDirectoryList");
  });
  it("default limit is 25", () => {
    expect(QR_DIRECTORY_DEFAULT_LIMIT).toBe(25);
  });
  it("maximum limit is 100", () => {
    expect(QR_DIRECTORY_MAX_LIMIT).toBe(100);
  });
  it("cursor lifetime is 1800 seconds", () => {
    expect(QR_DIRECTORY_CURSOR_LIFETIME_SECONDS).toBe(1800);
  });
  it("order profile is single-field merchant_id ASC unique", () => {
    expect(QR_DIRECTORY_ORDER_PROFILE.id).toBe("qr-directory.merchant-id-asc.v1");
    expect(QR_DIRECTORY_ORDER_PROFILE.fields.length).toBe(1);
    const f = QR_DIRECTORY_ORDER_PROFILE.fields[0];
    expect(f.key).toBe("merchant_id");
    expect(f.direction).toBe("asc");
    expect(f.nullable).toBe(false);
    expect(f.unique).toBe(true);
  });
  it("exposes exactly the four ratified header names in canonical order", () => {
    expect([...QR_DIRECTORY_PAGINATION_HEADER_NAMES]).toEqual([
      "X-Pagination-Mode",
      "X-Pagination-Has-More",
      "X-Pagination-Next-Cursor",
      "X-Pagination-Limit",
    ]);
    expect(QR_DIRECTORY_ACCESS_CONTROL_EXPOSE_HEADERS).toBe(
      "X-Pagination-Mode, X-Pagination-Has-More, X-Pagination-Next-Cursor, X-Pagination-Limit",
    );
  });
  it("accepts sandbox and production environments only", () => {
    expect(normalizeQrDirectoryEnvironment("sandbox")).toBe("sandbox");
    expect(normalizeQrDirectoryEnvironment("production")).toBe("production");
    expect(normalizeQrDirectoryEnvironment("SANDBOX")).toBe("sandbox");
  });
  it("rejects unknown environment as configuration failure", () => {
    expect(() => normalizeQrDirectoryEnvironment("staging"))
      .toThrow(PaginationConfigurationError);
    expect(() => normalizeQrDirectoryEnvironment(""))
      .toThrow(PaginationConfigurationError);
    expect(() => normalizeQrDirectoryEnvironment(undefined))
      .toThrow(PaginationConfigurationError);
  });
  it("scope hash rejects unsupported environment as configuration failure", async () => {
    await expect(
      // deliberately bypass the string type — the runtime guard must still fire.
      computeQrDirectoryScopeHash("staging" as unknown as "sandbox"),
    ).rejects.toBeInstanceOf(PaginationConfigurationError);
  });
  it("short cursor secret is a configuration failure at encode time", async () => {
    await expect(
      encodeQrDirectoryCursor({
        environment: "sandbox",
        filters: NO_FILTERS,
        merchantId: UUID_A,
        secretOptions: { secret: "too-short" },
      }),
    ).rejects.toBeInstanceOf(PaginationConfigurationError);
  });
});

// -----------------------------------------------------------------------------
// Normalisation

describe("R1I-d.2B-I1c-X2-A — filter normalisation", () => {
  it("country omitted, empty and null all normalise to null", () => {
    for (const raw of [{}, { country: "" }, { country: null }]) {
      const r = normalizeQrDirectoryFilters(raw);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.country).toBeNull();
    }
  });
  it("country is trimmed and uppercased", () => {
    const r = normalizeQrDirectoryFilters({ country: "  cm  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.country).toBe("CM");
  });
  it("invalid country is rejected as PAGINATION_FILTER_INVALID", () => {
    for (const bad of ["c", "CMR", "1M", "cm1", "US-EAST"]) {
      const r = normalizeQrDirectoryFilters({ country: bad });
      expect(r.ok, `bad=${bad}`).toBe(false);
      if (r.ok === false) expect(r.error.code).toBe("PAGINATION_FILTER_INVALID");
    }
  });
  it("category omitted, empty and null all normalise to null", () => {
    for (const raw of [{}, { category: "" }, { category: null }]) {
      const r = normalizeQrDirectoryFilters(raw);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.category).toBeNull();
    }
  });
  it("category is trimmed and preserved as digits", () => {
    const r = normalizeQrDirectoryFilters({ category: " 5411 " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe("5411");
  });
  it("invalid category is rejected as PAGINATION_FILTER_INVALID", () => {
    for (const bad of ["12", "123456", "AB12", "54-11", "5411.0"]) {
      const r = normalizeQrDirectoryFilters({ category: bad });
      expect(r.ok, `bad=${bad}`).toBe(false);
      if (r.ok === false) expect(r.error.code).toBe("PAGINATION_FILTER_INVALID");
    }
  });
  it("canonical filter hash is stable across equivalent inputs", async () => {
    const a = await computeQrDirectoryFilterHash({ country: "CM", category: "5411" });
    const b = await computeQrDirectoryFilterHash({ country: "CM", category: "5411" });
    expect(a).toBe(b);
  });
  it("filter hash changes with country", async () => {
    const a = await computeQrDirectoryFilterHash({ country: "CM", category: null });
    const b = await computeQrDirectoryFilterHash({ country: "NG", category: null });
    expect(a).not.toBe(b);
  });
  it("filter hash changes with category", async () => {
    const a = await computeQrDirectoryFilterHash({ country: null, category: "5411" });
    const b = await computeQrDirectoryFilterHash({ country: null, category: "5812" });
    expect(a).not.toBe(b);
  });
});

// -----------------------------------------------------------------------------
// Limit parsing

describe("R1I-d.2B-I1c-X2-A — limit parsing", () => {
  it("omitted returns 25", () => {
    const r = parseQrDirectoryLimit(undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(25);
  });
  it("empty string returns 25", () => {
    const r = parseQrDirectoryLimit("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(25);
  });
  it("null returns 25", () => {
    const r = parseQrDirectoryLimit(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(25);
  });
  it("accepts 1", () => {
    const r = parseQrDirectoryLimit(1);
    if (r.ok) expect(r.value).toBe(1);
    else throw new Error("expected ok");
  });
  it("accepts 100", () => {
    const r = parseQrDirectoryLimit(100);
    if (r.ok) expect(r.value).toBe(100);
    else throw new Error("expected ok");
  });
  it("rejects 0", () => {
    const r = parseQrDirectoryLimit(0);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("rejects negative", () => {
    const r = parseQrDirectoryLimit(-3);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("rejects decimal", () => {
    const r = parseQrDirectoryLimit("3.5");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("rejects non-numeric", () => {
    const r = parseQrDirectoryLimit("abc");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("rejects unsafe integer", () => {
    const r = parseQrDirectoryLimit("999999999999999999999");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("rejects 101", () => {
    const r = parseQrDirectoryLimit(101);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
  it("mutation guard: no silent clamping — 200 is rejected, not coerced to 100", () => {
    const r = parseQrDirectoryLimit(200);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_LIMIT_INVALID");
  });
});

// -----------------------------------------------------------------------------
// Cursor security

describe("R1I-d.2B-I1c-X2-A — cursor security", () => {
  const validEncode = () => encodeQrDirectoryCursor({
    environment: "sandbox",
    filters: NO_FILTERS,
    merchantId: UUID_A,
    secretOptions: { secret: TEST_SECRET },
  });

  it("accepts a valid signed cursor", async () => {
    const token = await validEncode();
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.merchantId).toBe(UUID_A);
  });

  it("rejects a raw UUID cursor", async () => {
    const r = await decodeQrDirectoryCursor({
      token: UUID_A,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects a malformed token", async () => {
    const r = await decodeQrDirectoryCursor({
      token: "not-a-real-token",
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects an altered payload segment", async () => {
    const token = await validEncode();
    const parts = token.split(".");
    parts[1] = parts[1].slice(0, -2) + "AA";
    const r = await decodeQrDirectoryCursor({
      token: parts.join("."),
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects an altered signature segment", async () => {
    const token = await validEncode();
    const parts = token.split(".");
    parts[2] = parts[2].slice(0, -2) + "AA";
    const r = await decodeQrDirectoryCursor({
      token: parts.join("."),
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects a cursor signed with a different secret", async () => {
    const token = await encodeQrDirectoryCursor({
      environment: "sandbox",
      filters: NO_FILTERS,
      merchantId: UUID_A,
      secretOptions: { secret: ALT_SECRET },
    });
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects an expired cursor", async () => {
    // issue a cursor in the far past
    const nowSeconds = Math.floor(Date.now() / 1000) - 3600 * 24;
    const scopeHash = await hashScope({ environment: "sandbox", visibility: "public" });
    const filterHash = await hashFilters({ country: null, category: null });
    const token = await encodeCursor(
      {
        operation: "merchantsQrDirectoryList",
        scopeHash,
        filterHash,
        orderProfileId: "qr-directory.merchant-id-asc.v1",
        issuedAt: nowSeconds,
        expiresAt: nowSeconds + 1800,
        position: [UUID_A],
      },
      { secret: TEST_SECRET },
    );
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_EXPIRED");
  });

  it("rejects a cursor bound to a different operation", async () => {
    const scopeHash = await hashScope({ environment: "sandbox", visibility: "public" });
    const filterHash = await hashFilters({ country: null, category: null });
    const now = Math.floor(Date.now() / 1000);
    const token = await encodeCursor(
      {
        operation: "someOtherOperation",
        scopeHash,
        filterHash,
        orderProfileId: "qr-directory.merchant-id-asc.v1",
        issuedAt: now,
        expiresAt: now + 1800,
        position: [UUID_A],
      },
      { secret: TEST_SECRET },
    );
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_OPERATION_MISMATCH");
  });

  it("rejects a cursor bound to a different environment", async () => {
    const token = await encodeQrDirectoryCursor({
      environment: "sandbox",
      filters: NO_FILTERS,
      merchantId: UUID_A,
      secretOptions: { secret: TEST_SECRET },
    });
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "production",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_SCOPE_MISMATCH");
  });

  it("rejects a cursor when filters change", async () => {
    const token = await encodeQrDirectoryCursor({
      environment: "sandbox",
      filters: { country: "CM", category: null },
      merchantId: UUID_A,
      secretOptions: { secret: TEST_SECRET },
    });
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: { country: "NG", category: null },
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_FILTER_MISMATCH");
  });

  it("rejects a cursor from an incompatible ordering profile", async () => {
    const scopeHash = await hashScope({ environment: "sandbox", visibility: "public" });
    const filterHash = await hashFilters({ country: null, category: null });
    const now = Math.floor(Date.now() / 1000);
    const token = await encodeCursor(
      {
        operation: "merchantsQrDirectoryList",
        scopeHash,
        filterHash,
        orderProfileId: "some-other-profile.v1",
        issuedAt: now,
        expiresAt: now + 1800,
        position: [UUID_A],
      },
      { secret: TEST_SECRET },
    );
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects a cursor with wrong position arity", async () => {
    const scopeHash = await hashScope({ environment: "sandbox", visibility: "public" });
    const filterHash = await hashFilters({ country: null, category: null });
    const now = Math.floor(Date.now() / 1000);
    const token = await encodeCursor(
      {
        operation: "merchantsQrDirectoryList",
        scopeHash,
        filterHash,
        orderProfileId: "qr-directory.merchant-id-asc.v1",
        issuedAt: now,
        expiresAt: now + 1800,
        position: [UUID_A, "extra"],
      },
      { secret: TEST_SECRET },
    );
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("rejects a cursor with a non-UUID position", async () => {
    const scopeHash = await hashScope({ environment: "sandbox", visibility: "public" });
    const filterHash = await hashFilters({ country: null, category: null });
    const now = Math.floor(Date.now() / 1000);
    const token = await encodeCursor(
      {
        operation: "merchantsQrDirectoryList",
        scopeHash,
        filterHash,
        orderProfileId: "qr-directory.merchant-id-asc.v1",
        issuedAt: now,
        expiresAt: now + 1800,
        position: ["not-a-uuid"],
      },
      { secret: TEST_SECRET },
    );
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error.code).toBe("PAGINATION_CURSOR_INVALID");
  });

  it("cursor contains no filter value in plaintext (opacity assumption)", async () => {
    const token = await encodeQrDirectoryCursor({
      environment: "sandbox",
      filters: { country: "CM", category: "5411" },
      merchantId: UUID_A,
      secretOptions: { secret: TEST_SECRET },
    });
    // The base64url payload is not encrypted, but MUST NOT contain the raw
    // filter tokens — only their hash is bound.
    expect(token).not.toContain("CM");
    expect(token).not.toContain("5411");
    expect(token).not.toContain("country");
    expect(token).not.toContain("category");
  });

  it("secret is never embedded in error messages", async () => {
    const token = await encodeQrDirectoryCursor({
      environment: "sandbox",
      filters: NO_FILTERS,
      merchantId: UUID_A,
      secretOptions: { secret: TEST_SECRET },
    });
    const r = await decodeQrDirectoryCursor({
      token,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: ALT_SECRET },
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.error.detail).not.toContain(TEST_SECRET);
      expect(r.error.detail).not.toContain(ALT_SECRET);
      expect(r.error.title).not.toContain(TEST_SECRET);
    }
  });
});

// -----------------------------------------------------------------------------
// Finalisation

describe("R1I-d.2B-I1c-X2-A — page finalisation", () => {
  const finalize = (items: Array<{ merchant_id: string }>, limit = 3) =>
    finalizeQrDirectoryPage({
      environment: "sandbox",
      filters: NO_FILTERS,
      limit,
      fetchedItems: items,
      secretOptions: { secret: TEST_SECRET },
    });

  it("empty page returns has_more=false and null next_cursor", async () => {
    const r = await finalize([]);
    expect(r.body.data).toEqual([]);
    expect(r.body.pagination.has_more).toBe(false);
    expect(r.body.pagination.next_cursor).toBeNull();
    expect(r.body.pagination.limit).toBe(3);
    expect(r.body.pagination.mode).toBe("cursor");
    expect(r.body.meta).toEqual({});
  });

  it("exact-limit page returns has_more=false and null next_cursor", async () => {
    const r = await finalize([
      { merchant_id: UUID_A },
      { merchant_id: UUID_B },
      { merchant_id: UUID_C },
    ]);
    expect(r.body.data.length).toBe(3);
    expect(r.body.pagination.has_more).toBe(false);
    expect(r.body.pagination.next_cursor).toBeNull();
  });

  it("limit-plus-one page signals has_more and emits a signed cursor over the last returned row", async () => {
    const r = await finalize([
      { merchant_id: UUID_A },
      { merchant_id: UUID_B },
      { merchant_id: UUID_C },
      { merchant_id: UUID_D },
    ]);
    expect(r.body.data.length).toBe(3);
    expect(r.body.data[r.body.data.length - 1].merchant_id).toBe(UUID_C);
    expect(r.body.pagination.has_more).toBe(true);
    expect(r.body.pagination.next_cursor).toMatch(/^kobp1\./);
    // The cursor position must decode back to the last returned row (UUID_C),
    // not the truncated row (UUID_D).
    const decoded = await decodeQrDirectoryCursor({
      token: r.body.pagination.next_cursor!,
      environment: "sandbox",
      filters: NO_FILTERS,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.merchantId).toBe(UUID_C);
  });

  it("headers exactly match the canonical values on limit-plus-one", async () => {
    const r = await finalize([
      { merchant_id: UUID_A },
      { merchant_id: UUID_B },
      { merchant_id: UUID_C },
      { merchant_id: UUID_D },
    ]);
    expect(r.headers["X-Pagination-Mode"]).toBe("cursor");
    expect(r.headers["X-Pagination-Has-More"]).toBe("true");
    expect(r.headers["X-Pagination-Limit"]).toBe("3");
    expect(r.headers["X-Pagination-Next-Cursor"]).toBe(r.body.pagination.next_cursor);
  });

  it("headers emit empty next-cursor string when no continuation exists", async () => {
    const r = await finalize([{ merchant_id: UUID_A }]);
    expect(r.headers["X-Pagination-Has-More"]).toBe("false");
    expect(r.headers["X-Pagination-Next-Cursor"]).toBe("");
    expect(r.body.pagination.next_cursor).toBeNull();
  });

  it("body contains no legacy or total fields", async () => {
    const r = await finalize([{ merchant_id: UUID_A }]);
    const bodyKeys = Object.keys(r.body).sort();
    expect(bodyKeys).toEqual(["data", "meta", "pagination"]);
    const pageKeys = Object.keys(r.body.pagination).sort();
    expect(pageKeys).toEqual(["has_more", "limit", "mode", "next_cursor"]);
    // Legacy / disallowed fields:
    for (const bad of ["object", "total", "total_count", "page_count", "offset", "previous_cursor"]) {
      expect(bodyKeys).not.toContain(bad);
      expect(pageKeys).not.toContain(bad);
    }
  });

  it("input array is not mutated by finalisation", async () => {
    const input = [
      { merchant_id: UUID_A },
      { merchant_id: UUID_B },
      { merchant_id: UUID_C },
      { merchant_id: UUID_D },
    ];
    const snapshot = input.map((r) => ({ ...r }));
    const before = input.length;
    await finalize(input);
    expect(input.length).toBe(before);
    expect(input).toEqual(snapshot);
  });
});

// -----------------------------------------------------------------------------
// Isolation

describe("R1I-d.2B-I1c-X2-A — adapter isolation", () => {
  const ADAPTER_PATH = resolve(
    __dirname,
    "../../supabase/functions/merchants-qr-directory/_pagination-qr-directory.ts",
  );
  const source = readFileSync(ADAPTER_PATH, "utf8");

  it("does not import gateway-query adapters", () => {
    expect(source).not.toContain("gateway-query/_pagination");
    expect(source).not.toContain("_pagination-d2b");
    expect(source).not.toMatch(/gateway-query\//);
  });
  it("does not import Supabase or database drivers", () => {
    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("postgres");
  });
  it("does not construct a Response", () => {
    expect(source).not.toMatch(/new Response\b/);
    expect(source).not.toMatch(/Deno\.serve/);
  });
  it("does not read bearer / API credentials", () => {
    expect(source).not.toMatch(/Authorization/i);
    expect(source).not.toMatch(/Bearer\s/);
    expect(source).not.toMatch(/api[-_]?key/i);
  });
  it("imports the shared pagination foundation but does not copy it", () => {
    expect(source).toContain('from "../_shared/pagination.ts"');
    // Sanity: we don't redefine the shared primitives locally.
    expect(source).not.toMatch(/function\s+encodeCursor\s*\(/);
    expect(source).not.toMatch(/function\s+decodeCursor\s*\(/);
    expect(source).not.toMatch(/function\s+finalizePage\s*\(/);
    expect(source).not.toMatch(/function\s+hashScope\s*\(/);
    expect(source).not.toMatch(/function\s+hashFilters\s*\(/);
  });
});

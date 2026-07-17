/**
 * Phase 1B-R1I-d.1F — shared pagination foundation tests.
 *
 * These tests operate against an AISP-shaped reference dataset (accounts /
 * transactions). No live handler code is exercised. The tests inject a fixed
 * test-only secret; no live secret is required.
 */
// Import path resolves at test time via vitest esbuild transformer.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  hashScope,
  hashFilters,
  parsePaginationLimit,
  validateOrderProfile,
  finalizePage,
  canonicalStringify,
  CURSOR_PREFIX,
  ABSOLUTE_MAX_LIMIT,
  MIN_SECRET_BYTES,
  PaginationConfigurationError,
  PaginationValidationError,
  type PaginationOrderProfile,
  type CursorEncodeContext,
  type CursorExpectedContext,
} from "../../supabase/functions/_shared/pagination";

const TEST_SECRET = "test-secret-".padEnd(48, "x"); // ≥ 32 bytes
const WEAK_SECRET = "too-short";

const AISP_TX_PROFILE: PaginationOrderProfile = {
  id: "aisp.transactions.booked_at_desc.id_desc",
  fields: [
    { key: "booked_at", direction: "desc", nullable: false, unique: false },
    { key: "id", direction: "desc", nullable: false, unique: true },
  ],
};

interface AispTx { id: string; booked_at: string; amount: number }

function makeTx(i: number, bookedAt: string, id?: string): AispTx {
  return { id: id ?? `tx_${String(i).padStart(4, "0")}`, booked_at: bookedAt, amount: i };
}

async function makeExpected(overrides?: Partial<CursorExpectedContext>): Promise<CursorExpectedContext> {
  return {
    operation: "aispListTransactions",
    scopeHash: await hashScope({ env: "test", tenant: "t1", user: "u1", account: "acc_1" }),
    filterHash: await hashFilters({ sort: "booked_at", direction: "desc", from: "2026-01-01" }),
    orderProfile: AISP_TX_PROFILE,
    ...overrides,
  };
}

async function baseEncodeCtx(): Promise<Omit<CursorEncodeContext, "position">> {
  const now = Math.floor(Date.now() / 1000);
  return {
    operation: "aispListTransactions",
    scopeHash: await hashScope({ env: "test", tenant: "t1", user: "u1", account: "acc_1" }),
    filterHash: await hashFilters({ sort: "booked_at", direction: "desc", from: "2026-01-01" }),
    orderProfileId: AISP_TX_PROFILE.id,
    issuedAt: now,
    expiresAt: now + 3600,
  };
}

describe("R1I-d.1F — parsePaginationLimit", () => {
  it("uses explicit default when raw is missing", () => {
    expect(parsePaginationLimit(undefined, { defaultLimit: 25, maxLimit: 100 })).toBe(25);
    expect(parsePaginationLimit(null, { defaultLimit: 25, maxLimit: 100 })).toBe(25);
    expect(parsePaginationLimit("", { defaultLimit: 25, maxLimit: 100 })).toBe(25);
  });
  it("accepts valid integer within range", () => {
    expect(parsePaginationLimit(50, { defaultLimit: 25, maxLimit: 100 })).toBe(50);
    expect(parsePaginationLimit("42", { defaultLimit: 25, maxLimit: 100 })).toBe(42);
  });
  it("rejects zero", () => {
    expect(() => parsePaginationLimit(0, { defaultLimit: 25, maxLimit: 100 })).toThrow(PaginationValidationError);
  });
  it("rejects negative", () => {
    expect(() => parsePaginationLimit(-1, { defaultLimit: 25, maxLimit: 100 })).toThrow();
    expect(() => parsePaginationLimit("-5", { defaultLimit: 25, maxLimit: 100 })).toThrow();
  });
  it("rejects decimal", () => {
    expect(() => parsePaginationLimit(1.5, { defaultLimit: 25, maxLimit: 100 })).toThrow();
    expect(() => parsePaginationLimit("1.5", { defaultLimit: 25, maxLimit: 100 })).toThrow();
  });
  it("rejects non-numeric strings", () => {
    expect(() => parsePaginationLimit("many", { defaultLimit: 25, maxLimit: 100 })).toThrow();
    expect(() => parsePaginationLimit({} as unknown, { defaultLimit: 25, maxLimit: 100 })).toThrow();
  });
  it("rejects values above configured maximum (no silent clamp)", () => {
    expect(() => parsePaginationLimit(101, { defaultLimit: 25, maxLimit: 100 })).toThrow();
  });
  it("rejects unsafe integers", () => {
    expect(() => parsePaginationLimit(Number.MAX_SAFE_INTEGER + 2, { defaultLimit: 25, maxLimit: 100 })).toThrow();
  });
  it("rejects invalid limit configuration", () => {
    expect(() => parsePaginationLimit(1, { defaultLimit: 0, maxLimit: 10 })).toThrow(PaginationConfigurationError);
    expect(() => parsePaginationLimit(1, { defaultLimit: 20, maxLimit: 10 })).toThrow(PaginationConfigurationError);
    expect(() => parsePaginationLimit(1, { defaultLimit: 1, maxLimit: ABSOLUTE_MAX_LIMIT + 1 })).toThrow(PaginationConfigurationError);
  });
});

describe("R1I-d.1F — cursor round trip", () => {
  it("round-trips a valid cursor", async () => {
    const ctx = { ...(await baseEncodeCtx()), position: ["2026-06-01T12:00:00Z", "tx_0007"] as const };
    const token = await encodeCursor({ ...ctx, position: [...ctx.position] }, { secret: TEST_SECRET });
    expect(token.startsWith(`${CURSOR_PREFIX}.`)).toBe(true);
    expect(token.split(".").length).toBe(3);
    const decoded = await decodeCursor(token, await makeExpected(), { secret: TEST_SECRET });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload.pos).toEqual(["2026-06-01T12:00:00Z", "tx_0007"]);
  });
  it("is operation-bound", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["2026-06-01", "tx_1"] }, { secret: TEST_SECRET });
    const res = await decodeCursor(token, await makeExpected({ operation: "aispListAccounts" }), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("OPERATION_MISMATCH");
  });
  it("is scope-bound", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const otherScope = await hashScope({ env: "test", tenant: "t2", user: "u1", account: "acc_1" });
    const res = await decodeCursor(token, await makeExpected({ scopeHash: otherScope }), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("SCOPE_MISMATCH");
  });
  it("is filter-bound", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const otherFilter = await hashFilters({ sort: "booked_at", direction: "desc", from: "2026-02-01" });
    const res = await decodeCursor(token, await makeExpected({ filterHash: otherFilter }), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("FILTER_MISMATCH");
  });
  it("is ordering-profile-bound", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const otherProfile: PaginationOrderProfile = {
      id: "aisp.transactions.value_date_desc.id_desc",
      fields: [
        { key: "value_date", direction: "desc", nullable: false, unique: false },
        { key: "id", direction: "desc", nullable: false, unique: true },
      ],
    };
    const res = await decodeCursor(token, await makeExpected({ orderProfile: otherProfile }), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("ORDER_MISMATCH");
  });
  it("fails on tampered payload", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const [p, payload, sig] = token.split(".");
    // Flip a byte in the payload segment
    const swappedPayload = payload.slice(0, -1) + (payload.slice(-1) === "A" ? "B" : "A");
    const tampered = `${p}.${swappedPayload}.${sig}`;
    const res = await decodeCursor(tampered, await makeExpected(), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(["INVALID_SIGNATURE", "MALFORMED"]).toContain((res as { code: string }).code);
  });
  it("fails on tampered signature", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const [p, payload, sig] = token.split(".");
    // Flip a mid-signature char across a wide alphabet distance so the
    // decoded byte differs regardless of any bit-slack in the final segment.
    const mid = Math.floor(sig.length / 2);
    const swapped = sig[mid] === "z" ? "a" : "z";
    const flipped = sig.slice(0, mid) + swapped + sig.slice(mid + 1);
    const res = await decodeCursor(`${p}.${payload}.${flipped}`, await makeExpected(), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("INVALID_SIGNATURE");
  });
  it("fails on expired cursor", async () => {
    const past = Math.floor(Date.now() / 1000) - 4000;
    const ctx = { ...(await baseEncodeCtx()), issuedAt: past, expiresAt: past + 61, position: ["a", "b"] };
    const token = await encodeCursor(ctx, { secret: TEST_SECRET });
    const res = await decodeCursor(token, await makeExpected(), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("EXPIRED");
  });
  it("fails on unsupported version prefix", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: TEST_SECRET });
    const bumped = `kobp99.${token.split(".").slice(1).join(".")}`;
    const res = await decodeCursor(bumped, await makeExpected(), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("UNSUPPORTED_VERSION");
  });
  it("fails on malformed token", async () => {
    for (const bad of ["", "not.a.token.extra", "kobp1.***.***", "kobp1.only-two"]) {
      const res = await decodeCursor(bad, await makeExpected(), { secret: TEST_SECRET });
      expect(res.ok, `bad=${bad}`).toBe(false);
      if (!res.ok) expect(["MALFORMED", "UNSUPPORTED_VERSION"]).toContain((res as { code: string }).code);
    }
  });
});

describe("R1I-d.1F — secret handling", () => {
  const savedEnv = process.env.KOB_CURSOR_HMAC_SECRET;
  beforeEach(() => { delete process.env.KOB_CURSOR_HMAC_SECRET; });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.KOB_CURSOR_HMAC_SECRET;
    else process.env.KOB_CURSOR_HMAC_SECRET = savedEnv;
  });
  it("fails closed when secret is absent", async () => {
    await expect(
      encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }),
    ).rejects.toBeInstanceOf(PaginationConfigurationError);
  });
  it("fails closed when secret is weaker than minimum", async () => {
    await expect(
      encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: WEAK_SECRET }),
    ).rejects.toBeInstanceOf(PaginationConfigurationError);
    expect(WEAK_SECRET.length).toBeLessThan(MIN_SECRET_BYTES);
  });
  it("does not leak secret material in error messages", async () => {
    try {
      await encodeCursor({ ...(await baseEncodeCtx()), position: ["a", "b"] }, { secret: WEAK_SECRET });
    } catch (e) {
      expect((e as Error).message).not.toContain(WEAK_SECRET);
    }
  });
});

describe("R1I-d.1F — canonical hashing", () => {
  it("hashes identically regardless of object-key order", async () => {
    const a = await hashScope({ env: "test", tenant: "t1", user: "u1" });
    const b = await hashScope({ user: "u1", tenant: "t1", env: "test" });
    expect(a).toBe(b);
  });
  it("hashes different tenants differently", async () => {
    const a = await hashScope({ env: "test", tenant: "t1" });
    const b = await hashScope({ env: "test", tenant: "t2" });
    expect(a).not.toBe(b);
  });
  it("hashes different filters differently", async () => {
    const a = await hashFilters({ from: "2026-01-01" });
    const b = await hashFilters({ from: "2026-02-01" });
    expect(a).not.toBe(b);
  });
  it("rejects prohibited keys", async () => {
    await expect(hashScope({ tenant: "t1", password: "x" } as unknown as Record<string, unknown>))
      .rejects.toBeInstanceOf(PaginationValidationError);
    await expect(hashFilters({ token: "x" } as unknown as Record<string, unknown>))
      .rejects.toBeInstanceOf(PaginationValidationError);
  });
  it("does not mutate input objects", async () => {
    const input = { env: "test", tenant: "t1", nested: { b: 1, a: 2 } };
    const before = JSON.stringify(input);
    await hashScope(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("canonicalStringify sorts keys deterministically", () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it("array element order remains significant", async () => {
    const a = await hashFilters({ tags: ["x", "y"] });
    const b = await hashFilters({ tags: ["y", "x"] });
    expect(a).not.toBe(b);
  });
});

describe("R1I-d.1F — ordering profile validation", () => {
  it("requires unique final tie-breaker", () => {
    expect(() => validateOrderProfile({
      id: "bad",
      fields: [{ key: "booked_at", direction: "desc", nullable: false, unique: false }],
    })).toThrow(PaginationValidationError);
  });
  it("requires nulls ordering for nullable fields", () => {
    expect(() => validateOrderProfile({
      id: "bad",
      fields: [
        { key: "value_date", direction: "desc", nullable: true, unique: false },
        { key: "id", direction: "desc", nullable: false, unique: true },
      ],
    })).toThrow(PaginationValidationError);
  });
  it("rejects duplicate field keys", () => {
    expect(() => validateOrderProfile({
      id: "bad",
      fields: [
        { key: "x", direction: "asc", nullable: false, unique: false },
        { key: "x", direction: "desc", nullable: false, unique: true },
      ],
    })).toThrow();
  });
  it("accepts a valid profile", () => {
    expect(() => validateOrderProfile(AISP_TX_PROFILE)).not.toThrow();
  });
});

describe("R1I-d.1F — position validation", () => {
  it("rejects position arity mismatch", async () => {
    const token = await encodeCursor({ ...(await baseEncodeCtx()), position: ["only-one"] }, { secret: TEST_SECRET });
    const res = await decodeCursor(token, await makeExpected(), { secret: TEST_SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res as { code: string }).code).toBe("POSITION_INVALID");
  });
  it("rejects invalid scalar via encode", async () => {
    await expect(encodeCursor(
      { ...(await baseEncodeCtx()), position: [{} as unknown as string, "b"] },
      { secret: TEST_SECRET },
    )).rejects.toThrow();
  });
});

describe("R1I-d.1F — page finalisation (AISP-shaped fixture)", () => {
  // 10 items, duplicate primary timestamp between tx_0005 and tx_0006
  const dataset: AispTx[] = [
    makeTx(1, "2026-06-10T10:00:00Z"),
    makeTx(2, "2026-06-09T10:00:00Z"),
    makeTx(3, "2026-06-08T10:00:00Z"),
    makeTx(4, "2026-06-07T10:00:00Z"),
    makeTx(5, "2026-06-06T10:00:00Z"),
    makeTx(6, "2026-06-06T10:00:00Z"),
    makeTx(7, "2026-06-05T10:00:00Z"),
    makeTx(8, "2026-06-04T10:00:00Z"),
    makeTx(9, "2026-06-03T10:00:00Z"),
    makeTx(10, "2026-06-02T10:00:00Z"),
  ];

  const extract = (t: AispTx) => [t.booked_at, t.id];

  it("first page returns correct items and hasMore=true", async () => {
    const enc = await baseEncodeCtx();
    // Simulate: fetch limit+1 rows
    const fetched = dataset.slice(0, 5 + 1);
    const page = await finalizePage({
      fetchedItems: fetched,
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeDefined();
  });
  it("middle continuation returns no duplicate across pages", async () => {
    const enc = await baseEncodeCtx();
    const first = await finalizePage({
      fetchedItems: dataset.slice(0, 6),
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    // second page starts strictly after first.items[4]
    const boundary = first.items[first.items.length - 1];
    const secondFetch = dataset.filter(
      (t) => (t.booked_at < boundary.booked_at) ||
             (t.booked_at === boundary.booked_at && t.id < boundary.id),
    );
    const second = await finalizePage({
      fetchedItems: secondFetch,
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    const ids = new Set(first.items.map((i) => i.id));
    for (const item of second.items) expect(ids.has(item.id)).toBe(false);
  });
  it("final page returns no nextCursor", async () => {
    const enc = await baseEncodeCtx();
    const page = await finalizePage({
      fetchedItems: dataset.slice(-3),
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });
  it("empty collection returns no cursor", async () => {
    const enc = await baseEncodeCtx();
    const page = await finalizePage({
      fetchedItems: [],
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });
  it("exact page-size collection returns hasMore=false", async () => {
    const enc = await baseEncodeCtx();
    const page = await finalizePage({
      fetchedItems: dataset.slice(0, 5),
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });
  it("page-size-plus-one collection returns hasMore=true", async () => {
    const enc = await baseEncodeCtx();
    const page = await finalizePage({
      fetchedItems: dataset.slice(0, 6),
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeDefined();
  });
  it("does not mutate input arrays", async () => {
    const enc = await baseEncodeCtx();
    const input = dataset.slice(0, 6);
    const snapshot = JSON.stringify(input);
    await finalizePage({
      fetchedItems: input,
      requestedLimit: 5,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it("duplicate primary timestamps remain deterministic through tie-breaker", async () => {
    const enc = await baseEncodeCtx();
    // Only the duplicate-timestamp rows
    const dup = [makeTx(5, "2026-06-06T10:00:00Z", "tx_0005"), makeTx(6, "2026-06-06T10:00:00Z", "tx_0006")];
    const page = await finalizePage({
      fetchedItems: dup.slice(0, 1 + 1),
      requestedLimit: 1,
      encodeContext: enc,
      positionExtractor: extract,
      secretOptions: { secret: TEST_SECRET },
    });
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    // Continuation cursor must carry the id tie-breaker, not just the timestamp
    const decoded = await decodeCursor(page.nextCursor!, await makeExpected(), { secret: TEST_SECRET });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.pos[0]).toBe("2026-06-06T10:00:00Z");
      expect(decoded.payload.pos[1]).toBe(page.items[0].id);
    }
  });
});

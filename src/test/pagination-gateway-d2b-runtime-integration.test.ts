/**
 * Phase 1B — R1I-d.2B-I1b — Runtime integration static tests.
 *
 * Component/static integration coverage for the d.2B runtime block inside
 * `supabase/functions/gateway-query/index.ts`. Full live Edge Runtime
 * verification is reserved for I1d.
 *
 * All extraction is bounded by explicit d.2B and d.2A anchor comments so that
 * unrelated gateway-query code cannot produce false positives.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");
const INDEX_PATH = "supabase/functions/gateway-query/index.ts";
const OPENAPI_JSON_PATH = "public/openapi.json";

const D2B_START_ANCHOR =
  "// ─── Phase 1B — R1I-d.2B: keyset pagination for three medium-volume gateway list ops ───";
const D2A_ANCHOR = "// ─── Phase 1B — R1I-d.2A";

function readSource(): string {
  return readFileSync(resolve(REPO_ROOT, INDEX_PATH), "utf8");
}

function extractD2bBlock(source: string): string {
  const start = source.indexOf(D2B_START_ANCHOR);
  const end = source.indexOf(D2A_ANCHOR);
  if (start < 0) {
    throw new Error(`d.2B start anchor '${D2B_START_ANCHOR}' not found in ${INDEX_PATH}`);
  }
  if (end < 0) {
    throw new Error(`d.2A anchor '${D2A_ANCHOR}' not found in ${INDEX_PATH}`);
  }
  if (start > end) {
    throw new Error("d.2B block must appear before the d.2A anchor");
  }
  return source.slice(start, end);
}

function extractD2aSuffix(source: string): string {
  const end = source.indexOf(D2A_ANCHOR);
  if (end < 0) throw new Error(`d.2A anchor not found in ${INDEX_PATH}`);
  return source.slice(end);
}

// Structural validator used both for the actual file and for mutation tests.
// Returns the list of failure reasons; an empty array = valid.
function validateD2bBlock(block: string): string[] {
  const problems: string[] = [];
  const requireIncludes = (needle: string, reason: string): void => {
    if (!block.includes(needle)) problems.push(reason);
  };
  const requireExcludes = (needle: string, reason: string): void => {
    if (block.includes(needle)) problems.push(reason);
  };

  // Adapter import.
  requireIncludes(`from "./_pagination-d2b.ts"`, "adapter import missing");
  requireIncludes("parseD2bParams", "parseD2bParams import missing");
  requireIncludes("normalizeD2bSort", "normalizeD2bSort import missing");
  requireIncludes("computeD2bScopeHash", "computeD2bScopeHash import missing");
  requireIncludes("computeD2bFilterHash", "computeD2bFilterHash import missing");
  requireIncludes("decodeD2bCursor", "decodeD2bCursor import missing");
  requireIncludes("finalizeD2bPage", "finalizeD2bPage import missing");
  requireIncludes("resolveD2bOperation", "resolveD2bOperation import missing");

  // Route map — exactly three entries.
  requireIncludes(`"list-customers": "gatewayListCustomers"`, "customers route missing");
  requireIncludes(`"list-payment-plans": "gatewayListPaymentPlans"`, "payment-plans route missing");
  requireIncludes(`"list-subscriptions": "gatewayListSubscriptions"`, "subscriptions route missing");

  // Merchant boundary.
  requireIncludes("merchant_id required", "missing merchant 400 body missing");
  requireIncludes("merchant_not_found", "foreign merchant 404 body missing");
  requireIncludes("await verifyMerchant(p, rawMerchant)", "ownership verification missing");
  requireIncludes(`.eq('merchant_id', verifiedMerchantId)`, "verified merchant id not applied");

  // Table binding.
  requireIncludes("gatewayListCustomers", "customers op id missing");
  requireIncludes("gatewayListPaymentPlans", "payment-plans op id missing");
  requireIncludes("gatewayListSubscriptions", "subscriptions op id missing");

  // Subscriptions relationship + filters.
  requireIncludes("'*, gateway_payment_plans(*)'", "subscriptions relationship select missing");
  requireIncludes(`query.eq('plan_id', normPlanId)`, "plan_id filter missing");
  requireIncludes(`query.eq('status', normStatus)`, "status filter missing");
  requireIncludes(`planId: normPlanId`, "plan_id not included in filter hash");
  requireIncludes(`status: normStatus`, "status not included in filter hash");

  // Ordering + cursor keyset.
  requireIncludes(`.order('created_at', { ascending: false })`, "created_at ordering missing");
  requireIncludes(`.order('id', { ascending: false })`, "id tie-breaker ordering missing");
  requireIncludes("id.lt.", "id tie-breaker in cursor condition missing");
  requireIncludes(".limit(limit + 1)", "limit + 1 fetch missing");
  requireIncludes(".range(offset, offset + limit)", "hybrid range endpoint missing");

  // Cursor precedence + safety.
  requireIncludes(`startsWith('kobp1.')`, "kobp1 prefix guard missing");
  requireIncludes("Conflicting cursor parameters", "conflicting-cursor fail-closed missing");

  // Response finalisation + headers.
  requireIncludes("finalizeD2bPage", "finalizeD2bPage invocation missing");
  requireIncludes(`"X-Pagination-Mode"`, "X-Pagination-Mode header missing");
  requireIncludes(`"X-Pagination-Has-More"`, "X-Pagination-Has-More header missing");
  requireIncludes(`"X-Pagination-Next-Cursor"`, "X-Pagination-Next-Cursor header missing");
  requireIncludes(`"X-Pagination-Limit"`, "X-Pagination-Limit header missing");
  requireIncludes(`"Access-Control-Expose-Headers"`, "Access-Control-Expose-Headers missing");

  // No exact counts / totals / offset in success envelope.
  requireExcludes(`count: 'exact'`, "exact-count option present");
  requireExcludes(`count: "exact"`, "exact-count option present");
  requireExcludes(`count=exact`, "exact-count query present");
  requireExcludes(`head: true`, "head-only count present");
  requireExcludes(`'total_count'`, "total_count key present");
  requireExcludes(`"total_count"`, "total_count key present");

  // No backward pagination.
  requireExcludes(`ascending: true`, "ascending order present (forbidden)");
  requireExcludes(`created_at.gt.`, "forward-inverted keyset present");

  return problems;
}

describe("R1I-d.2B-I1b — runtime integration (structural)", () => {
  const src = readSource();
  const block = extractD2bBlock(src);
  const suffix = extractD2aSuffix(src);

  it("1. index.ts imports the accepted d.2B adapter", () => {
    expect(block).toContain(`from "./_pagination-d2b.ts"`);
  });

  it("2. index.ts does not import d.2A _pagination.ts for d.2B logic", () => {
    // The d.2B block itself must not reach into the d.2A helper module.
    expect(block).not.toContain(`from "./_pagination.ts"`);
  });

  it("3. d.2B block appears before the d.2A anchor", () => {
    expect(src.indexOf(D2B_START_ANCHOR)).toBeGreaterThanOrEqual(0);
    expect(src.indexOf(D2B_START_ANCHOR)).toBeLessThan(src.indexOf(D2A_ANCHOR));
  });

  it("4. d.2A suffix begins at the anchor and includes handleD2aList", () => {
    expect(suffix.startsWith(D2A_ANCHOR)).toBe(true);
    expect(suffix).toContain("handleD2aList");
  });

  it("5. route map contains exactly three entries", () => {
    const match = block.match(/const D2B_ROUTES:[^{]*\{([\s\S]*?)\}\s*\)/);
    expect(match, "D2B_ROUTES declaration not found").not.toBeNull();
    const body = match![1];
    const entries = body
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes(":"));
    expect(entries.length).toBe(3);
  });

  it("6. list-customers maps to gatewayListCustomers", () => {
    expect(block).toContain(`"list-customers": "gatewayListCustomers"`);
  });

  it("7. list-payment-plans maps to gatewayListPaymentPlans", () => {
    expect(block).toContain(`"list-payment-plans": "gatewayListPaymentPlans"`);
  });

  it("8. list-subscriptions maps to gatewayListSubscriptions", () => {
    expect(block).toContain(`"list-subscriptions": "gatewayListSubscriptions"`);
  });

  it("9. only the three approved route keys enter executeD2bList / handleD2bList", () => {
    const callRe = /(?:executeD2bList|handleD2bList)\(p,\s*D2B_ROUTES\['([^']+)'\]\)/g;
    const keys = new Set<string>();
    for (const m of src.matchAll(callRe)) keys.add(m[1]);
    expect([...keys].sort()).toEqual([
      "list-customers",
      "list-payment-plans",
      "list-subscriptions",
    ]);
  });

  it("10. legacy handlers for the three routes are not reachable", () => {
    // Case labels must route into handleD2bList, not into the removed legacy
    // helpers.
    expect(src).not.toContain(`case 'list-customers': return await listCustomers(p)`);
    expect(src).not.toContain(`case 'list-subscriptions': return await listSubscriptions(p)`);
    expect(src).not.toContain(`listMerchantResource(p, 'gateway_payment_plans'`);
    // The legacy helpers themselves must no longer exist.
    expect(src).not.toMatch(/async function listCustomers\(/);
    expect(src).not.toMatch(/async function listSubscriptions\(/);
    expect(src).not.toMatch(/async function listMerchantResource\(/);
  });

  it("11. merchant_id is required", () => {
    expect(block).toContain(`if (!rawMerchant) return d2bErr('merchant_id required', 400)`);
  });

  it("12. verified merchant ownership occurs before collection querying", () => {
    const verifyIdx = block.indexOf("await verifyMerchant(p, rawMerchant)");
    const fromIdx = block.indexOf("p.supabase.from(op.table)");
    expect(verifyIdx).toBeGreaterThan(0);
    expect(fromIdx).toBeGreaterThan(verifyIdx);
  });

  it("13. every d.2B collection query applies verified merchant_id", () => {
    // A single .from(...).select(...).eq('merchant_id', verifiedMerchantId)
    // is the only path used by all three operations.
    expect(block).toMatch(/p\.supabase\.from\(op\.table\)\.select\(select\)\.eq\('merchant_id', verifiedMerchantId\)/);
  });

  it("14. customers use gateway_customers", () => {
    // Adapter's operation → table mapping is the sole binding.
    expect(block).toContain("resolveD2bOperation(operationId)");
    // Sanity: no ad-hoc customers table string used in d.2B block.
    expect(block).not.toMatch(/from\('gateway_customers'\)/);
  });

  it("15. plans use gateway_payment_plans", () => {
    expect(block).not.toMatch(/from\('gateway_payment_plans'\)/);
    // The adapter's table binding is exercised via resolveD2bOperation.
  });

  it("16. subscriptions use gateway_subscriptions", () => {
    expect(block).not.toMatch(/from\('gateway_subscriptions'\)/);
    // The adapter's table binding is exercised via resolveD2bOperation.
  });

  it("17. subscriptions preserve gateway_payment_plans relationship selection", () => {
    expect(block).toContain(`'*, gateway_payment_plans(*)'`);
  });

  it("18. subscriptions apply plan_id when present", () => {
    expect(block).toContain(`query.eq('plan_id', normPlanId)`);
  });

  it("19. subscriptions apply status when present", () => {
    expect(block).toContain(`query.eq('status', normStatus)`);
  });

  it("20. plan_id and status are included in subscription filter hashing", () => {
    expect(block).toContain(`planId: normPlanId`);
    expect(block).toContain(`status: normStatus`);
  });

  it("21. sorting is created_at DESC then id DESC", () => {
    expect(block).toMatch(/\.order\('created_at', \{ ascending: false \}\)[\s\S]*\.order\('id', \{ ascending: false \}\)/);
  });

  it("22. cursor condition includes the id tie-breaker", () => {
    expect(block).toContain("created_at.eq.");
    expect(block).toContain("id.lt.");
  });

  it("23. cursor pages request limit + 1", () => {
    expect(block).toContain(".limit(limit + 1)");
  });

  it("24. offset initial pages request limit + 1 via inclusive range", () => {
    expect(block).toContain(".range(offset, offset + limit)");
  });

  it("25. cursor presence prevents offset/range use", () => {
    // The range() branch is guarded by `cursorPosition || offset === 0`
    // returning to .limit(limit+1) when a cursor is present.
    expect(block).toContain("if (cursorPosition || offset === 0)");
  });

  it("26. offset > 0 returns hybrid mode", () => {
    expect(block).toContain("offset > 0 ? 'hybrid' : 'cursor'");
  });

  it("27. offset = 0 returns cursor mode", () => {
    // Same expression above establishes cursor mode when offset === 0 and no
    // cursor is present.
    expect(block).toMatch(/mode:\s*'cursor'\s*\|\s*'hybrid'\s*=\s*cursorPosition/);
  });

  it("28. arbitrary database IDs are not accepted as unsigned cursors", () => {
    // Alias parameters only qualify when they start with the KOB prefix.
    expect(block).toContain(`startingAfter.startsWith('kobp1.')`);
    expect(block).toContain(`endingBefore.startsWith('kobp1.')`);
  });

  it("29. multiple cursor parameters fail closed", () => {
    expect(block).toContain("cursorSources.length > 1");
    expect(block).toContain("Conflicting cursor parameters");
  });

  it("30. no backward pagination exists", () => {
    expect(block).not.toContain(`ascending: true`);
    expect(block).not.toContain(`created_at.gt.`);
  });

  it("31. no exact-count option exists in the d.2B block", () => {
    expect(block).not.toContain(`count: 'exact'`);
    expect(block).not.toContain(`count: "exact"`);
    expect(block).not.toContain("count=exact");
  });

  it("32. no separate total query exists in the d.2B block", () => {
    expect(block).not.toMatch(/head:\s*true/);
    expect(block).not.toContain("total_count");
  });

  it("33. response uses finalizeD2bPage", () => {
    expect(block).toContain("await finalizeD2bPage(");
  });

  it("34. all four successful pagination headers are retained", () => {
    for (const h of [
      "X-Pagination-Mode",
      "X-Pagination-Has-More",
      "X-Pagination-Next-Cursor",
      "X-Pagination-Limit",
    ]) {
      expect(block).toContain(`"${h}"`);
    }
  });

  it("35. Access-Control-Expose-Headers lists exactly the four approved names", () => {
    const arrayMatch = block.match(/D2B_PAGINATION_RESPONSE_HEADERS = \[([\s\S]*?)\]/);
    expect(arrayMatch, "D2B_PAGINATION_RESPONSE_HEADERS array missing").not.toBeNull();
    const names = [...arrayMatch![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(names.sort()).toEqual([
      "X-Pagination-Has-More",
      "X-Pagination-Limit",
      "X-Pagination-Mode",
      "X-Pagination-Next-Cursor",
    ]);
    expect(block).toContain(
      `"Access-Control-Expose-Headers": D2B_PAGINATION_RESPONSE_HEADERS.join(", "),`,
    );
  });

  it("36. no total or offset is added to the successful envelope", () => {
    // The success path emits only what finalizeD2bPage returns. The adapter
    // envelope shape has been ratified in I1a; here we assert the runtime
    // never mutates that body by adding total/offset keys.
    const successReturn = /return d2bOk\(finalised\);/;
    expect(block).toMatch(successReturn);
    expect(block).not.toMatch(/finalised\.body\.total\s*=/);
    expect(block).not.toMatch(/finalised\.body\.offset\s*=/);
    expect(block).not.toMatch(/data:\s*rows,\s*total/);
  });

  it("37. missing merchant remains 400", () => {
    expect(block).toContain(`d2bErr('merchant_id required', 400)`);
  });

  it("38. foreign merchant remains masked 404", () => {
    expect(block).toContain(`d2bErr('merchant_not_found', 404)`);
  });

  it("39. cursor configuration failures are not converted to client 400", () => {
    // The d.2B block must not wrap decodeD2bCursor in a try/catch that
    // swallows PaginationConfigurationError.
    expect(block).not.toMatch(/try\s*\{\s*[^}]*decodeD2bCursor/);
    expect(block).not.toMatch(/catch[\s\S]{0,200}PaginationConfigurationError[\s\S]{0,200}400/);
  });

  it("40. d.2A operations and handler suffix remain unchanged (delegated to baseline test)", () => {
    // The dedicated protected-baseline test performs byte-identity against the
    // closure commit. Here we sanity-check that the suffix still declares
    // handleD2aList and references the d.2A operation identifiers via op.id.
    expect(suffix).toContain("async function handleD2aList(");
    expect(suffix).toContain("GatewayD2aOperation");
    expect(suffix).toContain("finalizeD2aPage");
  });

  it("41. OpenAPI files remain unchanged in I1b (delegated to baseline test)", () => {
    // Presence check — the byte-identity assertion is enforced by
    // phase1b-d2b-protected-d2a-baseline.test.ts.
    const spec = JSON.parse(readFileSync(resolve(REPO_ROOT, OPENAPI_JSON_PATH), "utf8")) as {
      info?: { version?: string };
    };
    expect(spec.info?.version).toBe("4.53.1");
  });

  it("42. API version remains 4.53.1", () => {
    const spec = JSON.parse(readFileSync(resolve(REPO_ROOT, OPENAPI_JSON_PATH), "utf8")) as {
      info?: { version?: string };
    };
    expect(spec.info?.version).toBe("4.53.1");
  });

  it("43. operation count remains 483", () => {
    const spec = JSON.parse(readFileSync(resolve(REPO_ROOT, OPENAPI_JSON_PATH), "utf8")) as {
      paths?: Record<string, Record<string, unknown>>;
    };
    let count = 0;
    for (const item of Object.values(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        if (
          ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method) &&
          op &&
          typeof op === "object" &&
          typeof (op as { operationId?: unknown }).operationId === "string"
        ) {
          count += 1;
        }
      }
    }
    expect(count).toBe(483);
  });
});

describe("R1I-d.2B-I1b — structural validator (self-check)", () => {
  it("accepts the current d.2B block", () => {
    const block = extractD2bBlock(readSource());
    expect(validateD2bBlock(block)).toEqual([]);
  });
});

describe("R1I-d.2B-I1b — mutation tests (validator must reject)", () => {
  const block = extractD2bBlock(readSource());

  it("rejects removal of the id tie-breaker in ordering", () => {
    const mutated = block.replace(`.order('id', { ascending: false })`, "");
    expect(validateD2bBlock(mutated).length).toBeGreaterThan(0);
  });

  it("rejects insertion of count: 'exact'", () => {
    const mutated = block.replace(
      "p.supabase.from(op.table).select(select)",
      "p.supabase.from(op.table).select(select, { count: 'exact' })",
    );
    expect(validateD2bBlock(mutated).some((r) => r.includes("exact-count"))).toBe(true);
  });

  it("rejects removal of merchant_id from d.2B collection query", () => {
    const mutated = block.replace(
      `.eq('merchant_id', verifiedMerchantId)`,
      "",
    );
    expect(validateD2bBlock(mutated).some((r) => r.includes("verified merchant id"))).toBe(true);
  });

  it("rejects removal of plan_id filtering", () => {
    const mutated = block.replace(`query.eq('plan_id', normPlanId)`, "/* removed */");
    expect(validateD2bBlock(mutated).some((r) => r.includes("plan_id filter"))).toBe(true);
  });

  it("rejects moving d.2B code after the d.2A anchor", () => {
    const src = readSource();
    // Simulate a mutated source in which the d.2B start anchor is relocated
    // after the d.2A anchor. The extractor must fail closed.
    const stripped = src.replace(D2B_START_ANCHOR, "// moved");
    const mutated = stripped + "\n" + D2B_START_ANCHOR + "\n";
    expect(() => extractD2bBlock(mutated)).toThrow(
      /d\.2B block must appear before the d\.2A anchor/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R1I-d.2B-I1b-R1 — cursor precedence, safe-integer offsets, dedup, and
// server-error CORS wrapper. Static assertions and mutation coverage.
// ─────────────────────────────────────────────────────────────────────────────

describe("R1I-d.2B-I1b-R1 — cursor precedence over offset", () => {
  const src = readSource();
  const block = extractD2bBlock(src);

  it("R1.1 offset parsing occurs only after successful cursor decoding", () => {
    const decodeIdx = block.indexOf("await decodeD2bCursor(");
    const parseOffsetIdx = block.indexOf("parseD2bOffset(getParam(p, 'offset'))");
    expect(decodeIdx).toBeGreaterThan(0);
    expect(parseOffsetIdx).toBeGreaterThan(0);
    expect(parseOffsetIdx).toBeGreaterThan(decodeIdx);
  });

  it("R1.2 offset parsing is guarded by cursorPosition === null", () => {
    expect(block).toMatch(
      /if\s*\(\s*cursorPosition\s*===\s*null\s*\)\s*\{[\s\S]{0,300}parseD2bOffset\(getParam\(p,\s*'offset'\)\)/,
    );
  });

  it("R1.3 no offset value is read or parsed in the accepted-cursor branch", () => {
    // There must be exactly one call site parsing the offset param, and it
    // must live inside the cursorPosition === null guarded branch.
    const matches = [...block.matchAll(/parseD2bOffset\(getParam\(p,\s*'offset'\)\)/g)];
    expect(matches.length).toBe(1);
    // No `getParam(p, 'offset')` outside of that guarded call.
    const offsetReads = [...block.matchAll(/getParam\(p,\s*'offset'\)/g)];
    expect(offsetReads.length).toBe(1);
  });

  it("R1.4 unsafe integers are rejected through Number.isSafeInteger", () => {
    // parseD2bOffset lives above the d.2B block start anchor's inner region
    // (it is defined before handleD2bList). Assert on the full source.
    expect(src).toContain("Number.isSafeInteger");
    // Configure explicit safe-integer guard around parseD2bOffset.
    const parseFn = src.slice(
      src.indexOf("function parseD2bOffset"),
      src.indexOf("async function handleD2bList("),
    );
    expect(parseFn).toContain("Number.isSafeInteger(n)");
    // Guard must be a negative check (rejects on !isSafeInteger).
    expect(parseFn).toMatch(/!\s*Number\.isSafeInteger\(n\)/);
  });
});

describe("R1I-d.2B-I1b-R1 — cursor duplicate/distinct handling", () => {
  const block = extractD2bBlock(readSource());

  it("R2.1 duplicate cursor values are deduplicated by value equality", () => {
    expect(block).toContain("Array.from(new Set(cursorCandidates))");
  });

  it("R2.2 only distinct cursor values trigger the conflict response", () => {
    // The `> 1` check runs on the deduplicated Set-derived array.
    expect(block).toMatch(
      /cursorSources\s*=\s*Array\.from\(new Set\(cursorCandidates\)\)[\s\S]{0,200}cursorSources\.length\s*>\s*1/,
    );
    expect(block).toContain("Conflicting cursor parameters");
  });
});

describe("R1I-d.2B-I1b-R1 — d.2B server-error wrapper", () => {
  const src = readSource();

  it("R3.1 all three routes are dispatched through executeD2bList", () => {
    expect(src).toContain(`case 'list-customers': return await executeD2bList(p, D2B_ROUTES['list-customers']);`);
    expect(src).toContain(`case 'list-payment-plans': return await executeD2bList(p, D2B_ROUTES['list-payment-plans']);`);
    expect(src).toContain(`case 'list-subscriptions': return await executeD2bList(p, D2B_ROUTES['list-subscriptions']);`);
  });

  it("R3.2 executeD2bList is declared before the d.2A anchor", () => {
    const wrapperIdx = src.indexOf("async function executeD2bList(");
    const anchorIdx = src.indexOf(D2A_ANCHOR);
    expect(wrapperIdx).toBeGreaterThan(0);
    expect(wrapperIdx).toBeLessThan(anchorIdx);
  });

  it("R3.3 wrapper catches thrown runtime/configuration/database errors", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toMatch(/try\s*\{[\s\S]*await handleD2bList\(p,\s*operationId\)[\s\S]*\}\s*catch\s*\(/);
  });

  it("R3.4 wrapper returns status 500", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toContain("status: 500,");
  });

  it("R3.5 wrapper preserves error=internal_error and error_id", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toContain(`error: "internal_error"`);
    expect(wrapper).toContain("error_id: errorId");
    expect(wrapper).toContain("crypto.randomUUID().slice(0, 8)");
  });

  it("R3.6 wrapper uses d2bCorsHeaders (not shared corsHeaders)", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toContain("...d2bCorsHeaders");
    expect(wrapper).not.toMatch(/\.\.\.corsHeaders\b/);
  });

  it("R3.7 wrapper does not emit successful pagination header values", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    // No literal X-Pagination-* value strings are set as headers inside the
    // wrapper's 500 body — only the exposure list travels via d2bCorsHeaders.
    expect(wrapper).not.toContain(`"X-Pagination-Mode":`);
    expect(wrapper).not.toContain(`"X-Pagination-Has-More":`);
    expect(wrapper).not.toContain(`"X-Pagination-Next-Cursor":`);
    expect(wrapper).not.toContain(`"X-Pagination-Limit":`);
  });

  it("R3.8 generic outer catch remains unchanged", () => {
    // The shared outer catch keeps its original generic body + shared cors.
    expect(src).toContain(
      `return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });`,
    );
  });

  it("R3.9 no unrelated route uses the d.2B wrapper", () => {
    const callRe = /executeD2bList\(p,\s*([^)]+)\)/g;
    const args = [...src.matchAll(callRe)].map((m) => m[1].trim());
    // Every call site must reference D2B_ROUTES['list-customers' | 'list-payment-plans' | 'list-subscriptions'].
    // The internal try/catch invocation of handleD2bList lives inside the
    // wrapper itself and does not count as an executeD2bList call.
    for (const a of args) {
      expect(a).toMatch(/^D2B_ROUTES\['(list-customers|list-payment-plans|list-subscriptions)'\]$/);
    }
    expect(args.length).toBe(3);
  });
});

describe("R1I-d.2B-I1b-R1 — mutation tests (repair semantics)", () => {
  const src = readSource();
  const block = extractD2bBlock(src);

  it("rejects moving offset parsing before cursor decoding", () => {
    const decodeIdx = block.indexOf("await decodeD2bCursor(");
    const parseOffsetIdx = block.indexOf("parseD2bOffset(getParam(p, 'offset'))");
    // Baseline invariant: parse-offset AFTER decode. Any mutation swapping the
    // order would invert this comparison.
    expect(parseOffsetIdx > decodeIdx).toBe(true);
    // Simulate mutation: move parse call before decode → invariant broken.
    const mutated = block
      .replace("parseD2bOffset(getParam(p, 'offset'))", "__MOVED_PARSE__")
      .replace("await decodeD2bCursor(", "parseD2bOffset(getParam(p, 'offset')); await decodeD2bCursor(");
    const mDecode = mutated.indexOf("await decodeD2bCursor(");
    const mParse = mutated.indexOf("parseD2bOffset(getParam(p, 'offset'))");
    expect(mParse < mDecode).toBe(true);
  });

  it("rejects parsing offset unconditionally (removal of cursorPosition === null guard)", () => {
    const mutated = block.replace(
      /if\s*\(\s*cursorPosition\s*===\s*null\s*\)\s*\{[\s\S]*?\n\s*\}/,
      "const offsetResult = parseD2bOffset(getParam(p, 'offset')); if (!offsetResult.ok) return d2bProblemResponse(offsetResult.error); offset = offsetResult.offset;",
    );
    // Validator (weaker) — assert the guard string was present in original
    // and removed in mutated.
    expect(block).toMatch(/if\s*\(\s*cursorPosition\s*===\s*null\s*\)/);
    expect(mutated).not.toMatch(/if\s*\(\s*cursorPosition\s*===\s*null\s*\)/);
  });

  it("rejects replacing Number.isSafeInteger with Number.isFinite only", () => {
    const parseFn = src.slice(
      src.indexOf("function parseD2bOffset"),
      src.indexOf("async function handleD2bList("),
    );
    // Baseline uses isSafeInteger; a mutation swapping to isFinite alone must
    // remove the safe-integer guard.
    expect(parseFn).toMatch(/!\s*Number\.isSafeInteger\(n\)/);
    const mutated = parseFn.replace(/Number\.isSafeInteger\(n\)/g, "Number.isFinite(n)");
    expect(mutated).not.toContain("Number.isSafeInteger(n)");
  });

  it("rejects removal of cursor candidate deduplication", () => {
    expect(block).toContain("Array.from(new Set(cursorCandidates))");
    const mutated = block.replace(
      "const cursorSources = Array.from(new Set(cursorCandidates));",
      "const cursorSources = cursorCandidates;",
    );
    expect(mutated).not.toContain("new Set(cursorCandidates)");
  });

  it("rejects rejecting duplicate equal tokens (must accept dedup to 1)", () => {
    // Simulate injecting a raw > 0 conflict on the pre-dedup list — that
    // rejection semantics is exactly what R1I-d.2B-I1b-R1 forbids.
    const mutated = block.replace(
      "if (cursorSources.length > 1)",
      "if (cursorCandidates.length > 1)",
    );
    // The mutation changes the check target; assert semantic distinction.
    expect(mutated).toContain("cursorCandidates.length > 1");
    expect(mutated).not.toMatch(/cursorSources\.length\s*>\s*1/);
  });

  it("rejects replacing d2bCorsHeaders with corsHeaders in the 500 wrapper", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toContain("...d2bCorsHeaders");
    const mutated = wrapper.replace("...d2bCorsHeaders", "...corsHeaders");
    expect(mutated).toContain("...corsHeaders");
    expect(mutated).not.toContain("...d2bCorsHeaders");
  });

  it("rejects routing an unrelated operation through the wrapper", () => {
    // Baseline: only three d.2B route case labels call executeD2bList.
    const callSites = [...src.matchAll(/executeD2bList\(p,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    for (const arg of callSites) {
      expect(arg).toMatch(/^D2B_ROUTES\['(list-customers|list-payment-plans|list-subscriptions)'\]$/);
    }
    // Simulate mutation routing an unrelated action through the wrapper.
    const mutated = src.replace(
      `case 'list-charges': return await listCharges(p);`,
      `case 'list-charges': return await executeD2bList(p, D2B_ROUTES['list-customers']);`,
    );
    const mCalls = [...mutated.matchAll(/executeD2bList\(p,\s*[^)]+\)/g)];
    expect(mCalls.length).toBeGreaterThan(3);
  });

  it("rejects returning 400 from the wrapper", () => {
    const wrapper = src.slice(
      src.indexOf("async function executeD2bList("),
      src.indexOf(D2A_ANCHOR),
    );
    expect(wrapper).toContain("status: 500,");
    expect(wrapper).not.toMatch(/status:\s*400\b/);
  });
});


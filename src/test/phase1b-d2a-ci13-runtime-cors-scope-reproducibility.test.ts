// Phase 1B — R1I-d.2A — CI13 static reproducibility suite.
//
// Verifies (statically, without booting the Edge Runtime) that the CI13
// repair is present in-tree:
//   1. gateway-query exposes exactly the four ratified d.2A pagination
//      response headers via a local d.2A-scoped CORS header object.
//   2. handleD2aList emits the full pagination response contract for
//      unowned merchant_id and no-owned-merchants empty branches.
//   3. runtime-tests.mjs uses the merchant_id query parameter as the
//      public scope selector (never x-merchant-id).
//   4. Actual-response CORS exposure is checked on the authenticated GET
//      response (not only preflight) with a case-insensitive comma parse.
//   5. Complete cursor tokens are not persisted in evidence.
//
// Preserves CI5–CI12 tests (they live in their own files).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const GATEWAY = readFileSync(resolve(ROOT, "supabase/functions/gateway-query/index.ts"), "utf8");
const SHARED_CORS = readFileSync(resolve(ROOT, "supabase/functions/_shared/cors.ts"), "utf8");
const RUNTIME = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/runtime-tests.mjs"), "utf8");
const WORKFLOW = readFileSync(resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml"), "utf8");

describe("Phase 1B R1I-d.2A · CI13 runtime CORS + merchant-scope reproducibility", () => {
  it("1. gateway-query defines the four exact d.2A exposed headers", () => {
    expect(GATEWAY).toMatch(/D2A_PAGINATION_RESPONSE_HEADERS\s*=\s*\[/);
    for (const h of [
      "X-Pagination-Mode",
      "X-Pagination-Has-More",
      "X-Pagination-Next-Cursor",
      "X-Pagination-Limit",
    ]) {
      expect(GATEWAY).toContain(`"${h}"`);
    }
    expect(GATEWAY).toMatch(
      /D2A_PAGINATION_RESPONSE_HEADERS\.join\(\s*", "\s*\)/,
    );
    expect(GATEWAY).toMatch(/Access-Control-Expose-Headers/);
  });

  it("2. d2aOk uses the local d.2A CORS header object", () => {
    const okFn = GATEWAY.match(/function d2aOk[\s\S]+?\n\}/);
    expect(okFn).not.toBeNull();
    expect(okFn![0]).toContain("d2aCorsHeaders");
    expect(okFn![0]).not.toMatch(/\.\.\.corsHeaders\b/);
  });

  it("3. d2aErrorResponse uses the local d.2A CORS header object", () => {
    const errFn = GATEWAY.match(/function d2aErrorResponse[\s\S]+?\n\}/);
    expect(errFn).not.toBeNull();
    expect(errFn![0]).toContain("d2aCorsHeaders");
    expect(errFn![0]).not.toMatch(/\.\.\.corsHeaders\b/);
  });

  it("4. shared cors.ts is not modified to add pagination-specific headers", () => {
    expect(SHARED_CORS).not.toMatch(/Access-Control-Expose-Headers/i);
    expect(SHARED_CORS).not.toMatch(/X-Pagination-/i);
  });

  it("5. no wildcard Access-Control-Expose-Headers is used", () => {
    const line = GATEWAY.match(/Access-Control-Expose-Headers[^\n]*/);
    expect(line).not.toBeNull();
    expect(line![0]).not.toMatch(/"\s*\*\s*"/);
  });

  it("6. unowned merchant_id branch uses d2aOk (not generic ok)", () => {
    const handler = GATEWAY.match(/async function handleD2aList[\s\S]+?\n\}/);
    expect(handler).not.toBeNull();
    const body = handler![0];
    // Unowned branch identified by the non-disclosure comment
    const nonDisclosureIdx = body.indexOf("Never disclose whether an unrelated merchant exists");
    expect(nonDisclosureIdx).toBeGreaterThan(-1);
    const nextReturn = body.slice(nonDisclosureIdx, nonDisclosureIdx + 400);
    expect(nextReturn).toMatch(/return d2aOk\(/);
    expect(nextReturn).not.toMatch(/return ok\(/);
  });

  it("7. unowned response returns empty data", () => {
    expect(GATEWAY).toMatch(/d2aEmptyPayload\s*\(/);
    const empty = GATEWAY.match(/function d2aEmptyPayload[\s\S]+?\n\}/);
    expect(empty![0]).toMatch(/data:\s*\[\s*\]/);
  });

  it("8. unowned response emits mode, has-more and limit headers", () => {
    const empty = GATEWAY.match(/function d2aEmptyPayload[\s\S]+?\n\}/)![0];
    expect(empty).toMatch(/'X-Pagination-Mode'\s*:\s*'cursor'/);
    expect(empty).toMatch(/'X-Pagination-Has-More'\s*:\s*'false'/);
    expect(empty).toMatch(/'X-Pagination-Limit'\s*:\s*String\(limit\)/);
  });

  it("9. unowned response emits no next-cursor header", () => {
    const empty = GATEWAY.match(/function d2aEmptyPayload[\s\S]+?\n\}/)![0];
    expect(empty).not.toMatch(/X-Pagination-Next-Cursor/);
  });

  it("10. empty response uses the validated requested limit", () => {
    const handler = GATEWAY.match(/async function handleD2aList[\s\S]+?\n\}/)![0];
    // parseD2aParams must be called before both empty branches.
    const parseIdx = handler.indexOf("parseD2aParams");
    const scopeEmptyIdx = handler.indexOf("d2aEmptyPayload(limit)");
    expect(parseIdx).toBeGreaterThan(-1);
    expect(scopeEmptyIdx).toBeGreaterThan(parseIdx);
    expect(handler).toMatch(/d2aEmptyPayload\(limit\)/);
  });

  it("11. no-owned-merchants branch uses same d.2A response contract", () => {
    const handler = GATEWAY.match(/async function handleD2aList[\s\S]+?\n\}/)![0];
    // Two d2aEmptyPayload(limit) call sites in the handler.
    const matches = handler.match(/d2aEmptyPayload\(limit\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(handler).toMatch(/merchantScope\.length === 0[\s\S]{0,120}d2aOk\(d2aEmptyPayload\(limit\)\)/);
  });

  it("12. runtime-tests.mjs no longer sets x-merchant-id", () => {
    // authHeaders object must not include x-merchant-id.
    const authBlock = RUNTIME.match(/const authHeaders\s*=\s*\{[\s\S]+?\};/);
    expect(authBlock).not.toBeNull();
    expect(authBlock![0]).not.toMatch(/x-merchant-id/i);
  });

  it("13. foreign merchant scope is sent through merchant_id query parameter", () => {
    expect(RUNTIME).toMatch(
      /params:\s*\{\s*merchant_id:\s*foreignMerchantId,\s*limit:\s*10\s*\}/,
    );
  });

  it("14. authenticated baseline requests explicitly include owned merchant_id", () => {
    expect(RUNTIME).toMatch(
      /const first = await callOp\(op, \{\s*params:\s*merchantParams\(merchantId,\s*\{\s*limit:\s*10\s*\}\)/,
    );
  });

  it("15. page-walk requests explicitly preserve merchant_id", () => {
    expect(RUNTIME).toMatch(/const params = merchantParams\(merchantId,\s*\{\s*limit:\s*pageLimit\s*\}\)/);
  });

  it("16. cursor requests explicitly preserve merchant_id", () => {
    expect(RUNTIME).toMatch(
      /const tampered = await callOp\(op, \{\s*params:\s*merchantParams\(merchantId,\s*\{[^}]*cursor:/,
    );
  });

  it("17. foreign merchant response requires empty data", () => {
    expect(RUNTIME).toMatch(/foreign merchant body\.data is empty array/);
    expect(RUNTIME).toMatch(/fmData\.length === 0/);
  });

  it("18. foreign merchant response requires all pagination headers", () => {
    expect(RUNTIME).toMatch(/foreign merchant emits complete pagination headers/);
    expect(RUNTIME).toMatch(/x-pagination-mode.*cursor/);
    expect(RUNTIME).toMatch(/x-pagination-has-more/);
    expect(RUNTIME).toMatch(/x-pagination-limit/);
    expect(RUNTIME).toMatch(/x-pagination-next-cursor.*undefined/);
  });

  it("19. foreign merchant response requires body/header parity", () => {
    expect(RUNTIME).toMatch(/foreign merchant pagination contract complete/);
    expect(RUNTIME).toMatch(/fmPag\.mode === "cursor"/);
    expect(RUNTIME).toMatch(/fmPag\.has_more === false/);
    expect(RUNTIME).toMatch(/fmPag\.next_cursor === null/);
    expect(RUNTIME).toMatch(/fmPag\.limit === 10/);
  });

  it("20. CORS exposure is checked on the actual authenticated GET response", () => {
    expect(RUNTIME).toMatch(/first\.headers\["access-control-expose-headers"\]/);
    expect(RUNTIME).toMatch(/authenticated GET exposes all four pagination headers explicitly/);
  });

  it("21. CORS exposure is parsed as a case-insensitive comma-separated set", () => {
    expect(RUNTIME).toMatch(/function parseExposedHeaders/);
    expect(RUNTIME).toMatch(/\.split\(",\"\)/);
    expect(RUNTIME).toMatch(/\.toLowerCase\(\)/);
  });

  it("22. all four explicit pagination header names are required", () => {
    for (const h of [
      "x-pagination-mode",
      "x-pagination-has-more",
      "x-pagination-next-cursor",
      "x-pagination-limit",
    ]) {
      expect(RUNTIME).toContain(`"${h}"`);
    }
    expect(RUNTIME).toMatch(/REQUIRED_EXPOSED_HEADERS/);
  });

  it("23. wildcard exposure is not accepted", () => {
    expect(RUNTIME).toMatch(/parseExposedHeaders\([^)]*\)\.has\("\*"\)/);
  });

  it("24. OPTIONS preflight status remains tested", () => {
    expect(RUNTIME).toMatch(/CORS preflight returns 2xx\/204/);
    expect(RUNTIME).toMatch(/preflightStatus/);
  });

  it("25. preflight allow-origin remains tested", () => {
    expect(RUNTIME).toMatch(/CORS preflight declares Access-Control-Allow-Origin/);
    expect(RUNTIME).toMatch(/preflightAllowOrigin/);
    expect(RUNTIME).toMatch(/CORS preflight permits Authorization \+ Content-Type/);
  });

  it("26. complete cursor tokens are not written to evidence", () => {
    // Evidence records must never include a `next_cursor` or `header` field
    // that persists the full cursor. The redaction helper is used instead.
    expect(RUNTIME).toMatch(/function cursorEvidence/);
    // Explicit check: the previous full-cursor evidence lines are gone.
    expect(RUNTIME).not.toMatch(/header:\s*first\.headers\[h\]\s*\?\?\s*null[\s\S]{0,80}next-cursor/);
    expect(RUNTIME).not.toMatch(/lastPageHadCursor,\s*\}\s*\)\s*;\s*\n\s*record\(paginationHeaders, `\$\{op\.op\} walked/);
  });

  it("27. cursor evidence uses only presence, length and safe prefix metadata", () => {
    const fn = RUNTIME.match(/function cursorEvidence[\s\S]+?\n\}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/nextCursorPresent/);
    expect(fn![0]).toMatch(/nextCursorLength/);
    expect(fn![0]).toMatch(/nextCursorPrefix/);
    expect(fn![0]).toMatch(/\.slice\(0,\s*5\)/);
  });

  it("28. JWTs and API keys are not written to evidence", () => {
    // The harness must never dump JWT/api key values into results files.
    expect(RUNTIME).not.toMatch(/writeFileSync\([^)]+,\s*JSON\.stringify\([^)]*jwt/);
    expect(RUNTIME).not.toMatch(/writeFileSync\([^)]+,\s*JSON\.stringify\([^)]*SERVICE_ROLE/);
    expect(RUNTIME).not.toMatch(/writeFileSync\([^)]+,\s*JSON\.stringify\([^)]*ANON_KEY/);
  });

  it("29. workflow explicitly executes CI5 through CI13", () => {
    for (const suite of [
      "phase1b-d2a-ci5-",
      "phase1b-d2a-ci6-",
      "phase1b-d2a-ci7-",
      "phase1b-d2a-ci8-",
      "phase1b-d2a-ci9-",
      "phase1b-d2a-ci10-",
      "phase1b-d2a-ci11-",
      "phase1b-d2a-ci12-",
      "phase1b-d2a-ci13-",
    ]) {
      expect(WORKFLOW).toContain(suite);
    }
    expect(WORKFLOW).toMatch(/CI13 actual-response CORS exposure and merchant query-scope verification/);
    expect(WORKFLOW).toMatch(
      /Static infrastructure suite \(guard \+ CI2 \+ CI3\/CI4 \+ CI5 \+ CI6 \+ CI7 \+ CI8 \+ CI9 \+ CI10 \+ CI11 \+ CI12 \+ CI13\)/,
    );
  });

  it("30. no managed Lovable Supabase access or command is introduced", () => {
    // The disposable local stack invariant is preserved.
    expect(RUNTIME).not.toMatch(/wdzkzeahdtxlynetndqw/);
    expect(GATEWAY).not.toMatch(/wdzkzeahdtxlynetndqw/);
    expect(WORKFLOW).not.toMatch(/wdzkzeahdtxlynetndqw/);
    expect(WORKFLOW).not.toMatch(/supabase\s+link\b/);
    // Verify the disposable-environment guard is still asserted upstream.
    expect(WORKFLOW).toMatch(/KOB_D2A_DISPOSABLE_ENVIRONMENT/);
  });
});

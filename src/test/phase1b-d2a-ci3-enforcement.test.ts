// Phase 1B — R1I-d.2A-CI3 — Static enforcement gates.
//
// These assertions guarantee the CI3 corrections cannot be silently reverted:
//   §CI3-A  Parents-first fixture (buildParentMerchant) + FK verification.
//   §CI3-B  Four table-specific builders.
//   §CI3-C  Runtime harness must NOT spawn supabase functions serve.
//   §CI3-D  Runtime harness emits the five required JSON evidence files.
//   §CI3-E  Full-suite policy evaluator enforces raw ≤93 / stable ≤89.
//   §CI3-F  Structural index parity script exists and rejects mismatches.
//   §CI3-G  Workflow does NOT mask runtime failures with `|| true`, boots
//           supabase functions serve exactly once, runs all five OpenAPI /
//           version commands, and uploads the required evidence artefacts.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildParentMerchant,
  buildSubaccount,
  buildBeneficiary,
  buildPaymentLink,
  buildVirtualAccount,
  merchantIdFor,
  userIdFor,
  deterministicUuidV4,
} from "../../scripts/phase1b-d2a/fixture.mjs";
import { extractIndexes } from "../../scripts/phase1b-d2a/index-definition-parity.mjs";

const ROOT = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(
  resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml"),
  "utf8",
);
const RUNTIME = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/runtime-tests.mjs"), "utf8");
const FIXTURE = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/fixture.mjs"), "utf8");
const POLICY = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/full-suite-policy.mjs"), "utf8");
const PARITY = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/index-definition-parity.mjs"), "utf8");

describe("R1I-d.2A-CI3 §CI3-A — parents-first fixture", () => {
  it("exports a parent gateway_merchants builder", () => {
    const parent = buildParentMerchant(0);
    expect(parent.id).toBe(merchantIdFor(0));
    expect(parent.user_id).toBe(userIdFor(0));
    expect(parent.business_name).toMatch(/D2A Fixture Merchant 0/);
  });
  it("fixture loader truncates and inserts parents BEFORE children", () => {
    const truncateParentIdx = FIXTURE.indexOf("TRUNCATE public.${PARENT_TABLE}");
    const loadParentsIdx = FIXTURE.indexOf("await loadParents(client");
    const loadChildIdx = FIXTURE.indexOf("await loadTable(client, table, builder");
    expect(truncateParentIdx).toBeGreaterThan(0);
    expect(loadParentsIdx).toBeGreaterThan(truncateParentIdx);
    expect(loadChildIdx).toBeGreaterThan(loadParentsIdx);
  });
  it("verifies orphan-free FK linkage in the summary", () => {
    expect(FIXTURE).toContain("parentForeignKeyFixtureCoverage");
    expect(FIXTURE).toContain("LEFT JOIN public.${PARENT_TABLE}");
  });
});

describe("R1I-d.2A-CI3 §CI3-B — four table-specific builders", () => {
  const cases = [
    ["gateway_subaccounts", buildSubaccount],
    ["gateway_beneficiaries", buildBeneficiary],
    ["gateway_payment_links", buildPaymentLink],
    ["gateway_virtual_accounts", buildVirtualAccount],
  ] as const;
  for (const [table, builder] of cases) {
    it(`${table} builder emits merchant-scoped rows with deterministic UUIDs`, () => {
      const row = builder({ merchantIdx: 2, rowIdx: 7 });
      expect(row.merchant_id).toBe(merchantIdFor(2));
      expect(row.id).toBe(deterministicUuidV4(`d2a-${table}-2-7`));
      expect(row.created_at).toBeDefined();
    });
  }
});

describe("R1I-d.2A-CI3 §CI3-C — single Edge Function server instance", () => {
  it("runtime-tests.mjs does NOT spawn supabase functions serve", () => {
    expect(RUNTIME).not.toMatch(/supabase\s+["'].*functions.*serve/);
    expect(RUNTIME).not.toMatch(/spawn\(["']supabase/);
  });
  it("runtime-tests.mjs uses D2A_RUNTIME_BASE_URL to reach the shared server", () => {
    expect(RUNTIME).toContain("D2A_RUNTIME_BASE_URL");
  });
  it("workflow starts supabase functions serve exactly once", () => {
    const occurrences = (WORKFLOW.match(/supabase functions serve gateway-query/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

describe("R1I-d.2A-CI3 §CI3-D — runtime evidence artefacts", () => {
  for (const artefact of [
    "pagination-header-results.json",
    "cursor-security-results.json",
    "database-call-evidence.json",
    "runtime-results.json",
  ]) {
    it(`runtime harness writes ${artefact}`, () => {
      expect(RUNTIME).toContain(artefact);
    });
    it(`workflow uploads ${artefact}`, () => {
      expect(WORKFLOW).toContain(artefact);
    });
  }
  it("runtime harness asserts count-drop (no X-Total-Count)", () => {
    expect(RUNTIME).toMatch(/x-total-count/i);
    expect(RUNTIME).toMatch(/count-drop/);
  });
  it("runtime harness asserts CORS preflight", () => {
    expect(RUNTIME).toMatch(/access-control-request-method/);
    expect(RUNTIME).toMatch(/access-control-expose-headers/);
  });
  it("runtime harness asserts cursor tamper + foreign scope rejection", () => {
    expect(RUNTIME).toMatch(/tampered/);
    expect(RUNTIME).toMatch(/foreign op\/scope binding/);
  });
});

describe("R1I-d.2A-CI3 §CI3-E — full-suite policy evaluator", () => {
  it("declares raw ≤93 and stable ≤89 ceilings", () => {
    expect(POLICY).toMatch(/RAW_CEILING\s*=\s*93/);
    expect(POLICY).toMatch(/STABLE_CEILING\s*=\s*89/);
  });
  it("treats missing full-suite reports as a hard failure", () => {
    expect(POLICY).toMatch(/unevaluatedFullSuiteRuns/);
    expect(POLICY).toMatch(/missing\.length === 0/);
  });
  it("workflow invokes the policy evaluator after all three runs", () => {
    expect(WORKFLOW).toContain("scripts/phase1b-d2a/full-suite-policy.mjs");
    expect(WORKFLOW).toContain("full-suite-policy-results.json");
  });
});

describe("R1I-d.2A-CI3 §CI3-F — structural index parity", () => {
  it("parity script exposes structural extraction", () => {
    const canonical = readFileSync(
      resolve(ROOT, "supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql"),
      "utf8",
    );
    const concurrent = readFileSync(
      resolve(ROOT, "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql"),
      "utf8",
    );
    const cIdx = extractIndexes(canonical);
    const oIdx = extractIndexes(concurrent);
    expect(cIdx).toHaveLength(4);
    expect(oIdx).toHaveLength(4);
    for (let i = 0; i < 4; i += 1) {
      expect(cIdx[i].name).toBe(oIdx[i].name);
      expect(cIdx[i].table).toBe(oIdx[i].table);
      expect(cIdx[i].columns).toEqual(oIdx[i].columns);
    }
  });
  it("parity script is used by workflow (byte-length compare removed)", () => {
    expect(WORKFLOW).toContain("scripts/phase1b-d2a/index-definition-parity.mjs");
    expect(WORKFLOW).not.toContain("canonicalNormalisedBytes");
    expect(PARITY).toContain("structurallyIdentical");
  });
});

describe("R1I-d.2A-CI3 §CI3-G — workflow policy invariants", () => {
  it("runtime harness step is NOT masked with `|| true`", () => {
    const runtimeLines = WORKFLOW
      .split("\n")
      .filter((l) => l.includes("runtime-tests.mjs"));
    for (const line of runtimeLines) {
      expect(line).not.toMatch(/\|\|\s*true/);
    }
  });
  it("runs all five OpenAPI / version commands", () => {
    for (const cmd of [
      "npm run openapi:gates:test",
      "npm run openapi:gates",
      "npm run openapi:check-version",
      "npm run version:check-sync",
      "npm run version:print",
    ]) {
      expect(WORKFLOW).toContain(cmd);
    }
  });
  it("uploads the full CI3 evidence bundle", () => {
    for (const artefact of [
      "cursor-security-results.json",
      "pagination-header-results.json",
      "database-call-evidence.json",
      "targeted-suite-results.json",
      "full-suite-policy-results.json",
      "teardown-results.json",
    ]) {
      expect(WORKFLOW).toContain(artefact);
    }
  });
  it("targeted vitest run writes targeted-suite-results.json", () => {
    expect(WORKFLOW).toMatch(/--outputFile=targeted-suite-results\.json/);
  });
});

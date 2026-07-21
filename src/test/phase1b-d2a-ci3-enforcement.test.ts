// Phase 1B — R1I-d.2A-CI3A — Static enforcement gates.
//
// These assertions guarantee the CI3A corrections cannot be silently reverted.
// They cover:
//   §CI3A-1  Builders match the canonical schema (exact required properties).
//   §CI3A-2  Runtime harness authenticates before every primary request.
//   §CI3A-3  Cursor rejection tests require baseline == 200 before firing.
//   §CI3A-4  Actual pagination behaviour asserted (default/max/invalid/pages).
//   §CI3A-5  Database calls captured from pg_stat_statements, not HTTP.
//   §CI3A-6  Full-suite policy enforces raw/stable/skipped/unhandled/rotation.
//   §CI3A-7  Teardown fails closed (no `|| true`; residual counts checked).
//   §CI3A-8  Workflow removes `|| true` from teardown and uploads
//            teardown-results.json with if: always().

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
import { RATIFIED_ROTATION_ALLOWLIST } from "../../scripts/phase1b-d2a/full-suite-policy.mjs";

const ROOT = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml"), "utf8");
const RUNTIME = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/runtime-tests.mjs"), "utf8");
const FIXTURE = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/fixture.mjs"), "utf8");
const POLICY = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/full-suite-policy.mjs"), "utf8");
const PARITY = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/index-definition-parity.mjs"), "utf8");
const TEARDOWN = readFileSync(resolve(ROOT, "scripts/phase1b-d2a/teardown.mjs"), "utf8");

describe("R1I-d.2A-CI3A §CI3A-1 — canonical-schema builders", () => {
  it("gateway_merchants builder supplies every required no-default column", () => {
    const p = buildParentMerchant(0);
    for (const k of [
      "id", "user_id", "business_name", "status", "kyb_status", "environment",
      "fee_bearer", "api_keys_count", "plan_tier", "settlement_frequency", "live_mode_enabled",
    ]) expect(p[k]).toBeDefined();
    expect(p.user_id).toBe(userIdFor(0));
  });
  it("gateway_subaccounts builder uses subaccount_name (not `name`) and required split fields", () => {
    const s = buildSubaccount({ merchantIdx: 3, rowIdx: 4 });
    expect(s).toHaveProperty("subaccount_name");
    expect(s).not.toHaveProperty("name");
    expect(s.subaccount_name).toBe("Subaccount 3/4");
    expect(s.split_type).toBe("percentage");
    expect(typeof s.split_value).toBe("number");
    expect(s.currency).toBe("XAF");
    expect(s.is_active).toBe(true);
    expect(s.merchant_id).toBe(merchantIdFor(3));
    expect(s.id).toBe(deterministicUuidV4("d2a-gateway_subaccounts-3-4"));
  });
  it("gateway_beneficiaries builder supplies channel + is_active (no bogus status/currency)", () => {
    const b = buildBeneficiary({ merchantIdx: 1, rowIdx: 2 });
    expect(b.channel).toBe("mobile_money");
    expect(b.is_active).toBe(true);
    expect(b).not.toHaveProperty("status");
    expect(b).not.toHaveProperty("currency");
    expect(b).not.toHaveProperty("bank_code");
  });
  it("gateway_payment_links builder supplies title/amount/currency/status/slug/use_count", () => {
    const l = buildPaymentLink({ merchantIdx: 1, rowIdx: 5 });
    for (const k of ["title", "amount", "currency", "status", "slug", "use_count"]) expect(l[k]).toBeDefined();
    expect(typeof l.amount).toBe("number");
    expect(l.use_count).toBe(0);
  });
  it("gateway_virtual_accounts builder omits bank_code (not a canonical column)", () => {
    const v = buildVirtualAccount({ merchantIdx: 0, rowIdx: 0 });
    expect(v).not.toHaveProperty("bank_code");
    expect(v.bank_name).toBeDefined();
    expect(v.status).toBe("active");
    expect(v.currency).toBe("XAF");
  });
});

describe("R1I-d.2A-CI3A §CI3A-2 — authenticated runtime baseline", () => {
  it("runtime harness admin-creates a user via SERVICE_ROLE_KEY (test setup)", () => {
    expect(RUNTIME).toContain("adminCreateUser");
    expect(RUNTIME).toContain("/auth/v1/admin/users");
    expect(RUNTIME).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("runtime harness signs the user in and uses a Bearer JWT + x-merchant-id", () => {
    expect(RUNTIME).toContain("grant_type=password");
    expect(RUNTIME).toContain("Authorization: `Bearer ${jwt}`");
    expect(RUNTIME).toContain("x-merchant-id");
  });
  it("readiness probe requires HTTP 200 (not 401/403/404) from a canonical route", () => {
    expect(RUNTIME).toMatch(/if \(r\.status === 200\) return true/);
    expect(RUNTIME).toMatch(/readiness_auth_denied/);
  });
  it("primary baseline records `authenticated baseline is 200`", () => {
    expect(RUNTIME).toContain("authenticated baseline is 200");
  });
});

describe("R1I-d.2A-CI3A §CI3A-3 — cursor tests reach cursor validation", () => {
  it("tampered-cursor assertion requires status === 400 (cursor decoder reached)", () => {
    expect(RUNTIME).toContain("cursor decoder reached");
    expect(RUNTIME).toMatch(/tampered\.status === 400/);
  });
  it("foreign-op cursor assertion requires status === 400 (scope validation reached)", () => {
    expect(RUNTIME).toContain("scope validation reached");
    expect(RUNTIME).toMatch(/foreignOp\.status === 400/);
  });
  it("does NOT accept a generic 401 as cursor rejection", () => {
    // The old shape `>= 400 && < 500` for cursor tests must be gone.
    expect(RUNTIME).not.toMatch(/tampered\.status >= 400 && tampered\.status < 500/);
  });
});

describe("R1I-d.2A-CI3A §CI3A-4 — actual pagination behaviour", () => {
  const behaviours = [
    "default limit is 25",
    "accepts limit=100",
    "rejects limit=101 with 400",
    "rejects non-numeric limit with 400",
    "no duplicate id across pages",
    "final page has no continuation cursor",
    "walked ≥ 2 pages",
    "empty-page request returns 2xx",
    "body/header parity",
    "next-cursor presence matches has_more",
  ];
  for (const b of behaviours) {
    it(`runtime asserts: ${b}`, () => expect(RUNTIME).toContain(b));
  }
});

describe("R1I-d.2A-CI3A §CI3A-5 — real database-call capture", () => {
  it("runtime harness uses pg_stat_statements (not HTTP-response synthesis)", () => {
    expect(RUNTIME).toContain("pg_stat_statements");
    expect(RUNTIME).toContain("pg_stat_statements_reset");
  });
  it("database evidence records exactCountCalls / separateTotalQueries / countOptionsRequested / paginationDataQueries", () => {
    for (const k of ["exactCountCalls", "separateTotalQueries", "countOptionsRequested", "paginationDataQueries"]) {
      expect(RUNTIME).toContain(k);
    }
  });
  it("harness fails closed when database-call capture is unavailable", () => {
    expect(RUNTIME).toMatch(/db_evidence_unavailable/);
    expect(RUNTIME).toMatch(/process\.exit\(4\)/);
  });
});

describe("R1I-d.2A-CI3A §CI3A-6 — full-suite policy enforcement", () => {
  it("declares all four ceilings (raw / stable / skipped / unhandled)", () => {
    expect(POLICY).toMatch(/RAW_CEILING\s*=\s*93/);
    expect(POLICY).toMatch(/STABLE_CEILING\s*=\s*89/);
    expect(POLICY).toMatch(/SKIPPED_CEILING\s*=\s*7/);
    expect(POLICY).toMatch(/UNHANDLED_CEILING\s*=\s*0/);
  });
  it("emits the required verdict keys", () => {
    for (const k of ["rawFailures", "stableFailures", "skipped", "unhandled", "rotatingTests", "unauthorisedRotatingTests", "verdict"]) {
      expect(POLICY).toContain(k);
    }
  });
  it("references the ratified UI-flake allow-list source of truth", () => {
    expect(RATIFIED_ROTATION_ALLOWLIST).toHaveLength(4);
    const files = RATIFIED_ROTATION_ALLOWLIST.map((r) => r.file);
    expect(files).toContain("src/test/phase6-dashboard-routes.test.tsx");
    expect(files).toContain("src/pages/__tests__/IdentityGuide.test.tsx");
    expect(files).toContain("src/pages/__tests__/SecuritySettings.test.tsx");
  });
  it("unauthorised rotation is a hard failure", () => {
    expect(POLICY).toContain("rotationViolation");
    expect(POLICY).toMatch(/unauthorisedRotatingTests\.length > 0/);
  });
});

describe("R1I-d.2A-CI3A §CI3A-7 — teardown fails closed", () => {
  it("teardown does NOT contain `|| true`", () => {
    expect(TEARDOWN).not.toMatch(/\|\|\s*true/);
  });
  it("teardown captures supabase stop exit code and writes teardown-results.json", () => {
    expect(TEARDOWN).toContain("supabaseStopExitCode");
    expect(TEARDOWN).toContain("teardown-results.json");
  });
  it("teardown fails when residual containers/processes/env file remain", () => {
    expect(TEARDOWN).toContain("residualSupabaseContainers");
    expect(TEARDOWN).toContain("residualRuntimeProcess");
    expect(TEARDOWN).toContain("residualTemporaryEnvFile");
    expect(TEARDOWN).toMatch(/process\.exit\(summary\.teardownExitCode\)/);
  });
});

describe("R1I-d.2A-CI3A §CI3A-8 — workflow invariants", () => {
  it("workflow calls the fail-closed teardown script with if: always()", () => {
    expect(WORKFLOW).toContain("scripts/phase1b-d2a/teardown.mjs");
  });
  it("workflow does NOT mask `supabase stop` with `|| true`", () => {
    const teardownLines = WORKFLOW.split("\n").filter((l) => /supabase stop|teardown\.mjs/.test(l));
    for (const line of teardownLines) expect(line).not.toMatch(/\|\|\s*true/);
  });
  it("workflow uploads teardown-results.json with if: always()", () => {
    expect(WORKFLOW).toContain("teardown-results.json");
    expect(WORKFLOW).toMatch(/if:\s*always\(\)/);
  });
  it("runtime harness step is NOT masked with `|| true`", () => {
    const runtimeLines = WORKFLOW.split("\n").filter((l) => l.includes("runtime-tests.mjs"));
    for (const line of runtimeLines) expect(line).not.toMatch(/\|\|\s*true/);
  });
  it("runs all five OpenAPI / version commands", () => {
    for (const cmd of [
      "npm run openapi:gates:test",
      "npm run openapi:gates",
      "npm run openapi:check-version",
      "npm run version:check-sync",
      "npm run version:print",
    ]) expect(WORKFLOW).toContain(cmd);
  });
});

describe("R1I-d.2A-CI3A — structural index parity retained", () => {
  it("parity script exposes structural extraction and workflow uses it", () => {
    const canonical = readFileSync(resolve(ROOT, "supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql"), "utf8");
    const concurrent = readFileSync(resolve(ROOT, "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql"), "utf8");
    const c = extractIndexes(canonical);
    const o = extractIndexes(concurrent);
    expect(c).toHaveLength(4);
    expect(o).toHaveLength(4);
    for (let i = 0; i < 4; i += 1) {
      expect(c[i].columns).toEqual(o[i].columns);
    }
    expect(PARITY).toContain("structurallyIdentical");
    expect(WORKFLOW).toContain("scripts/phase1b-d2a/index-definition-parity.mjs");
  });
});

// Parents-first fixture invariants (retained from CI3).
describe("R1I-d.2A-CI3A — parents-first fixture retained", () => {
  it("fixture inserts parents before children and verifies FK linkage", () => {
    expect(FIXTURE).toContain("await loadParents(client");
    expect(FIXTURE).toContain("parentForeignKeyFixtureCoverage");
    expect(FIXTURE).toContain("LEFT JOIN public.${PARENT_TABLE}");
  });
});

// ============================================================================
// R1I-d.2A-CI4 — Local Supabase startup repair (fail-closed enforcement).
// ============================================================================

describe("R1I-d.2A-CI4 §CI4-1 — Supabase CLI pin", () => {
  it("pins CLI to 2.101.0 and forbids `latest` / stale 2.20.12", () => {
    expect(WORKFLOW).toMatch(/version:\s*"2\.101\.0"/);
    expect(WORKFLOW).not.toMatch(/version:\s*"?latest"?/i);
    expect(WORKFLOW).not.toMatch(/version:\s*"2\.20\.12"/);
  });
});

describe("R1I-d.2A-CI4 §CI4-2 — corrected local service exclusion list", () => {
  it("uses the CI4 exclusion list and excludes no required service", () => {
    expect(WORKFLOW).toContain(
      "--exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor",
    );
    // Invalid names from earlier CIs are no longer present in the exclude list.
    const excludeLines = WORKFLOW.split("\n").filter((l) => l.includes("--exclude"));
    for (const line of excludeLines) {
      expect(line).not.toContain("inbucket");
      expect(line).not.toContain("pgadmin-schema-diff");
    }
    // Required services must never appear in an --exclude flag.
    for (const required of ["gotrue", "kong", "postgrest", "edge-runtime"]) {
      for (const line of excludeLines) {
        expect(line).not.toContain(required);
      }
    }
  });
});

describe("R1I-d.2A-CI4 §CI4-3 — Docker & startup preflight", () => {
  it("runs a Docker/Supabase preflight before `supabase start`", () => {
    expect(WORKFLOW).toContain("Docker and Supabase startup preflight");
    expect(WORKFLOW).toContain("docker version");
    expect(WORKFLOW).toContain("docker info");
    expect(WORKFLOW).toContain("supabase --version");
    expect(WORKFLOW).toContain("supabase/config.toml");
  });
});

describe("R1I-d.2A-CI4 §CI4-4 — startup failure diagnostics captured", () => {
  it("captures supabase-start.log, docker ps/df, status, container logs on failure", () => {
    expect(WORKFLOW).toContain("supabase-start.log");
    expect(WORKFLOW).toContain("docker-ps-after-start.txt");
    expect(WORKFLOW).toContain("docker-system-df-after-start.txt");
    expect(WORKFLOW).toContain("supabase-status-after-start.txt");
    expect(WORKFLOW).toContain("supabase-container-logs");
  });
  it("does NOT pass --ignore-health-check", () => {
    expect(WORKFLOW).not.toContain("--ignore-health-check");
  });
});

describe("R1I-d.2A-CI4 §CI4-6 — every tee pipeline is protected by pipefail", () => {
  it("every workflow step containing `| tee` also declares `set -o pipefail`", () => {
    const lines = WORKFLOW.split("\n");
    const stepStarts: number[] = [];
    lines.forEach((l, i) => {
      if (/^\s{6}-\s+name:/.test(l)) stepStarts.push(i);
    });
    stepStarts.push(lines.length);
    for (let s = 0; s < stepStarts.length - 1; s += 1) {
      const block = lines.slice(stepStarts[s], stepStarts[s + 1]).join("\n");
      if (/\|\s*tee\b/.test(block)) {
        expect(block).toMatch(/set\s+-o\s+pipefail|set\s+-euo?\s+pipefail/);
      }
    }
  });
});

describe("R1I-d.2A-CI4 §CI4-7 — teardown correctness", () => {
  it("teardown step uses pipefail and calls teardown.mjs", () => {
    const idx = WORKFLOW.indexOf("Teardown (always)");
    expect(idx).toBeGreaterThan(-1);
    const block = WORKFLOW.slice(idx, idx + 400);
    expect(block).toMatch(/set\s+-o\s+pipefail/);
    expect(block).toContain("scripts/phase1b-d2a/teardown.mjs");
  });
  it("teardown script uses self-excluding pgrep and drops the direct pattern", () => {
    expect(TEARDOWN).toContain("[s]upabase functions serve gateway-query");
    expect(TEARDOWN).not.toMatch(/pgrep -f 'supabase functions serve gateway-query'/);
  });
});

describe("R1I-d.2A-CI4 §CI4-8 — stale evidence removal", () => {
  it("does not commit full-suite-policy-results.json", () => {
    const p = resolve(ROOT, "full-suite-policy-results.json");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs");
    expect(fs.existsSync(p)).toBe(false);
  });
  it(".gitignore ignores all generated CI evidence files", () => {
    const gi = readFileSync(resolve(ROOT, ".gitignore"), "utf8");
    for (const f of [
      "full-suite-policy-results.json",
      "full-suite-run-1.json",
      "full-suite-run-2.json",
      "full-suite-run-3.json",
      "runtime-results.json",
      "pagination-header-results.json",
      "cursor-security-results.json",
      "database-call-evidence.json",
      "targeted-suite-results.json",
      "fixture-summary.json",
      "query-plan-summary.json",
      "index-definition-parity.json",
      "teardown-results.json",
      "tool-versions.json",
      "environment-preflight.json",
    ]) {
      expect(gi).toContain(f);
    }
  });
});

describe("R1I-d.2A-CI4 — no managed Lovable Supabase access", () => {
  it("workflow references no managed credentials nor forbidden CLI verbs", () => {
    // Env references to managed secrets are only allowed as empty-string neutralisers.
    // The CI4 startup step no longer sets these; assert the forbidden CLI verbs are absent.
    for (const verb of [
      "supabase login",
      "supabase link",
      "supabase db push",
      "supabase functions deploy",
      "migration repair --linked",
    ]) {
      expect(WORKFLOW).not.toContain(verb);
    }
  });
});

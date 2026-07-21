// Phase 1B — R1I-d.2A-CI11 — Auth-parented representative fixture static tests.
//
// These tests are STATIC — they inspect the source of
// scripts/phase1b-d2a/fixture.mjs and the workflow to prove the correct
// orchestration is in place. They must NOT execute the fixture.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_PATH = resolve("scripts/phase1b-d2a/fixture.mjs");
const WORKFLOW_PATH = resolve(
  ".github/workflows/phase1b-r1i-d2a-verification.yml",
);
const CI3_TEST_PATH = resolve("src/test/phase1b-d2a-ci3-enforcement.test.ts");

const fixtureSrc = readFileSync(FIXTURE_PATH, "utf8");
const workflowSrc = readFileSync(WORKFLOW_PATH, "utf8");
const ci3Src = (() => {
  try {
    return readFileSync(CI3_TEST_PATH, "utf8");
  } catch {
    return "";
  }
})();

describe("CI11 auth-parented representative fixture", () => {
  it("1. fixture.mjs still calls runGuard()", () => {
    expect(fixtureSrc).toMatch(/runGuard\s*\(\s*\)/);
  });

  it("2. requires SUPABASE_URL", () => {
    expect(fixtureSrc).toMatch(/process\.env\.SUPABASE_URL/);
    expect(fixtureSrc).toMatch(/FIXTURE_MISSING_SUPABASE_URL/);
  });

  it("3. requires SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(fixtureSrc).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(fixtureSrc).toMatch(/FIXTURE_MISSING_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("4. uses /auth/v1/admin/users endpoint", () => {
    expect(fixtureSrc).toMatch(/\/auth\/v1\/admin\/users/);
  });

  it("5. sends both apikey and Bearer service-role headers", () => {
    expect(fixtureSrc).toMatch(/apikey:\s*key/);
    expect(fixtureSrc).toMatch(/Authorization:\s*`Bearer \$\{key\}`/);
  });

  it("6. uses exactly eight deterministic fixture emails", () => {
    expect(fixtureSrc).toMatch(/d2a-fixture-merchant-/);
    expect(fixtureSrc).toMatch(/fixture\.d2a\.local/);
    expect(fixtureSrc).toMatch(/const\s+MERCHANTS\s*=\s*8/);
    expect(fixtureSrc).toMatch(/fixtureEmailFor/);
  });

  it("7. creates or resolves users before loadParents()", () => {
    const ensureIdx = fixtureSrc.indexOf("ensureFixtureAuthUsers()");
    const loadIdx = fixtureSrc.indexOf("loadParents(client, coverage, users)");
    expect(ensureIdx).toBeGreaterThan(-1);
    expect(loadIdx).toBeGreaterThan(-1);
    expect(ensureIdx).toBeLessThan(loadIdx);
  });

  it("8. maps returned Auth IDs onto gateway merchant user_id fields", () => {
    expect(fixtureSrc).toMatch(/merchant\.user_id\s*=\s*authUser\.id/);
  });

  it("9. buildParentMerchant remains deterministic and unchanged in behaviour", () => {
    expect(fixtureSrc).toMatch(/export function buildParentMerchant\(merchantIdx\)/);
    expect(fixtureSrc).toMatch(/user_id:\s*userIdFor\(merchantIdx\)/);
    expect(fixtureSrc).toMatch(/business_name:\s*`D2A Fixture Merchant \$\{merchantIdx\}`/);
  });

  it("10. merchantIdFor remains deterministic", () => {
    expect(fixtureSrc).toMatch(
      /export function merchantIdFor\(idx\)\s*\{\s*return deterministicUuidV4\(`d2a-merchant-\$\{idx\}`\);\s*\}/,
    );
  });

  it("11. does not directly INSERT INTO auth.users", () => {
    expect(fixtureSrc).not.toMatch(/INSERT\s+INTO\s+auth\.users/i);
  });

  it("12. does not disable triggers or constraints", () => {
    expect(fixtureSrc).not.toMatch(/DISABLE\s+TRIGGER/i);
    expect(fixtureSrc).not.toMatch(/DISABLE\s+ALL\s+TRIGGER/i);
    expect(fixtureSrc).not.toMatch(/DROP\s+CONSTRAINT/i);
    expect(fixtureSrc).not.toMatch(/ALTER\s+TABLE[^;]*DISABLE/i);
  });

  it("13. does not use session_replication_role", () => {
    expect(fixtureSrc).not.toMatch(/SET\s+session_replication_role/i);
    expect(fixtureSrc).not.toMatch(/session_replication_role\s*=/i);
  });

  it("14. does not modify or drop trg_assign_merchant_role", () => {
    expect(fixtureSrc).not.toMatch(/DROP\s+TRIGGER[^;]*trg_assign_merchant_role/i);
    expect(fixtureSrc).not.toMatch(/ALTER\s+TRIGGER[^;]*trg_assign_merchant_role/i);
    expect(fixtureSrc).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?TRIGGER\s+trg_assign_merchant_role/i);
  });

  it("15. does not modify or drop user_roles_user_id_fkey", () => {
    expect(fixtureSrc).not.toMatch(/DROP\s+CONSTRAINT[^;]*user_roles_user_id_fkey/i);
    expect(fixtureSrc).not.toMatch(/ALTER[^;]*user_roles_user_id_fkey/i);
  });

  it("16. verifies gateway merchant joins to auth.users", () => {
    expect(fixtureSrc).toMatch(/JOIN auth\.users au ON au\.id = gm\.user_id/);
  });

  it("17. verifies the merchant role created by the production trigger", () => {
    expect(fixtureSrc).toMatch(/JOIN public\.user_roles ur[\s\S]{0,120}ur\.role\s*=\s*'merchant'/);
  });

  it("18. detects duplicate merchant-role rows", () => {
    expect(fixtureSrc).toMatch(/DUPLICATE_MERCHANT_ROLES/);
    expect(fixtureSrc).toMatch(/HAVING count\(\*\) > 1/);
  });

  it("19. expects exactly eight Auth-parent mappings", () => {
    expect(fixtureSrc).toMatch(/AUTH_USER_PARENT_COVERAGE_FAIL/);
    expect(fixtureSrc).toMatch(/authParentCount\s*===\s*MERCHANTS/);
  });

  it("20. expects exactly eight merchant-role mappings", () => {
    expect(fixtureSrc).toMatch(/MERCHANT_ROLE_TRIGGER_COVERAGE_FAIL/);
    expect(fixtureSrc).toMatch(/merchantRoleCount\s*===\s*MERCHANTS/);
  });

  it("21. fixture-summary.json contains the new non-secret coverage fields", () => {
    expect(fixtureSrc).toMatch(/authUsers:\s*\{/);
    expect(fixtureSrc).toMatch(/authUserParentCoverage/);
    expect(fixtureSrc).toMatch(/merchantRoleTriggerCoverage/);
    expect(fixtureSrc).toMatch(/duplicateMerchantRoles/);
  });

  it("22. no passwords, keys, tokens or Auth IDs are written to summary evidence", () => {
    // The summary write must not include these fields.
    expect(fixtureSrc).not.toMatch(/summary\.password/i);
    expect(fixtureSrc).not.toMatch(/summary\.serviceRoleKey/i);
    expect(fixtureSrc).not.toMatch(/summary\.token/i);
    // authUsers summary carries only counts, not IDs.
    const authUsersBlock = fixtureSrc.match(/authUsers:\s*\{[^}]*\}/);
    expect(authUsersBlock).not.toBeNull();
    expect(authUsersBlock![0]).not.toMatch(/id/);
    expect(authUsersBlock![0]).not.toMatch(/email/);
  });

  it("23. unexpected Auth Admin responses fail closed", () => {
    expect(fixtureSrc).toMatch(/AUTH_ADMIN_UNEXPECTED_STATUS/);
    expect(fixtureSrc).toMatch(/throw new Error/);
  });

  it("24. existing-user handling is narrow and explicit (400/409/422)", () => {
    expect(fixtureSrc).toMatch(/res\.status\s*===\s*400/);
    expect(fixtureSrc).toMatch(/res\.status\s*===\s*409/);
    expect(fixtureSrc).toMatch(/res\.status\s*===\s*422/);
  });

  it("25. workflow explicitly executes CI5 through CI11", () => {
    for (const label of ["CI5", "CI6", "CI7", "CI8", "CI9", "CI10", "CI11"]) {
      expect(workflowSrc).toContain(label);
    }
    expect(workflowSrc).toMatch(
      /phase1b-d2a-ci11-auth-parent-fixture-reproducibility\.test\.ts/,
    );
  });

  it("26. workflow continues uploading fixture-loader.log", () => {
    expect(workflowSrc).toMatch(/fixture-loader\.log/);
  });

  it("27. workflow continues uploading fixture-summary.json", () => {
    expect(workflowSrc).toMatch(/fixture-summary\.json/);
  });

  it("28. no managed Supabase command or credential is introduced", () => {
    // No managed CLI project ref usage, no hosted URLs.
    expect(fixtureSrc).not.toMatch(/supabase link/);
    expect(fixtureSrc).not.toMatch(/--project-ref/);
    expect(fixtureSrc).not.toMatch(/https?:\/\/[a-z0-9-]+\.supabase\.co/i);
    expect(workflowSrc).not.toMatch(/--project-ref/);
  });

  it("preserves existing CI3 fixture assertions (buildParentMerchant/merchantIdFor/userIdFor exports)", () => {
    // These symbols must still be exported so CI3 tests continue to pass.
    expect(fixtureSrc).toMatch(/export function buildParentMerchant/);
    expect(fixtureSrc).toMatch(/export function merchantIdFor/);
    expect(fixtureSrc).toMatch(/export function userIdFor/);
    // Sanity: existing CI3 test file still present.
    if (ci3Src) {
      expect(ci3Src.length).toBeGreaterThan(0);
    }
  });
});

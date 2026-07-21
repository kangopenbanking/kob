/**
 * Phase 1B R1I-d.2A CI14C — Vitest / Playwright test-runner isolation.
 *
 * Verifies that `src/test/portal-swagger.spec.ts` (Playwright-owned) is
 * excluded from the repository Vitest run via one exact exclusion, without
 * broadening exclusion patterns or altering Playwright ownership.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const vitestConfig = read("vitest.config.ts");
const portalSpecPath = "src/test/portal-swagger.spec.ts";
const portalSpec = read(portalSpecPath);
const packageJsonRaw = read("package.json");
const packageJson = JSON.parse(packageJsonRaw) as {
  scripts: Record<string, string>;
};
const policy = read("scripts/phase1b-d2a/full-suite-policy.mjs");
const workflow = read(".github/workflows/phase1b-r1i-d2a-verification.yml");

describe("CI14C — test-runner isolation", () => {
  it("1. vitest.config.ts imports configDefaults", () => {
    expect(vitestConfig).toMatch(
      /import\s*\{[^}]*\bconfigDefaults\b[^}]*\}\s*from\s*["']vitest\/config["']/,
    );
  });

  it("2. Vitest retains its existing .test and .spec include pattern", () => {
    expect(vitestConfig).toMatch(
      /include:\s*\[\s*["']src\/\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}["']\s*\]/,
    );
  });

  it("3. Vitest excludes exactly src/test/portal-swagger.spec.ts", () => {
    expect(vitestConfig).toContain('"src/test/portal-swagger.spec.ts"');
  });

  it("4. Vitest preserves configDefaults.exclude", () => {
    expect(vitestConfig).toMatch(/\.\.\.configDefaults\.exclude/);
  });

  it("5. Exclusion is not a wildcard covering all .spec.ts files", () => {
    expect(vitestConfig).not.toMatch(/["']\*\*\/\*\.spec\.ts["']/);
    expect(vitestConfig).not.toMatch(/["']src\/\*\*\/\*\.spec\.ts["']/);
  });

  it("6. Exclusion is not the whole src/test directory", () => {
    expect(vitestConfig).not.toMatch(/["']src\/test\/?["']/);
    expect(vitestConfig).not.toMatch(/["']src\/test\/\*\*["']/);
  });

  it("7. portal-swagger.spec.ts still exists", () => {
    expect(existsSync(resolve(ROOT, portalSpecPath))).toBe(true);
  });

  it("8. portal-swagger.spec.ts imports from @playwright/test", () => {
    expect(portalSpec).toMatch(/from\s+["']@playwright\/test["']/);
  });

  it("9. portal-swagger.spec.ts does not import from vitest", () => {
    expect(portalSpec).not.toMatch(/from\s+["']vitest["']/);
  });

  it("10. The Swagger test body remains present", () => {
    expect(portalSpec).toContain("Swagger UI renders the OpenAPI spec");
    expect(portalSpec).toMatch(/\.opblock/);
  });

  it("11. package.json test command remains vitest run", () => {
    expect(packageJson.scripts.test).toBe("vitest run");
  });

  it("12. package.json smoke:swagger command remains the Playwright command", () => {
    expect(packageJson.scripts["smoke:swagger"]).toBe(
      "playwright test src/test/portal-swagger.spec.ts --reporter=line",
    );
  });

  it("13. package.json is not modified by CI14C (scripts intact)", () => {
    // Sanity: still valid JSON and the two governed commands unchanged.
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts["smoke:swagger"]).toContain(
      "playwright test src/test/portal-swagger.spec.ts",
    );
  });

  it("14. full-suite-policy.mjs still sets UNHANDLED_CEILING to 0", () => {
    expect(policy).toMatch(/UNHANDLED_CEILING\s*=\s*0\b/);
  });

  it("15. full-suite-policy.mjs still counts failed zero-assertion suites as unhandled", () => {
    expect(policy).toMatch(/assertionResults/);
    expect(policy).toMatch(/unhandled/i);
  });

  it("16. full-suite-policy.mjs contains no portal-swagger exception", () => {
    expect(policy).not.toMatch(/portal-swagger/i);
  });

  it("17. The four ratified UI rotation entries remain unchanged", () => {
    const m = policy.match(/RATIFIED_ROTATION_ALLOWLIST\s*=\s*\[([\s\S]*?)\];/);
    expect(m, "RATIFIED_ROTATION_ALLOWLIST block must exist").not.toBeNull();
    const body = (m as RegExpMatchArray)[1];
    const entries = body.match(/\{[^{}]*\}/g) || [];
    expect(entries.length).toBe(4);
    expect(policy).not.toMatch(/portal-swagger/);
  });

  it("18. The workflow still executes three complete Vitest runs", () => {
    const runs = workflow.match(/full-suite-run-\d\.json/g) || [];
    expect(new Set(runs).size).toBeGreaterThanOrEqual(3);
  });

  it("19. The workflow still executes the unmodified full-suite policy evaluator", () => {
    expect(workflow).toMatch(/full-suite-policy\.mjs/);
  });

  it("20. The workflow includes the CI14C static test", () => {
    expect(workflow).toContain(
      "phase1b-d2a-ci14c-test-runner-isolation-reproducibility.test.ts",
    );
  });

  it("21. No `|| true` is added to the policy step", () => {
    const policyStep = workflow.match(
      /full-suite-policy\.mjs[^\n]*(\n[^\n-][^\n]*)*/,
    );
    if (policyStep) {
      expect(policyStep[0]).not.toMatch(/\|\|\s*true/);
    }
  });

  it("22. No continue-on-error is added to the policy evaluator step", () => {
    // Isolate the policy evaluator step block and assert it does not carry
    // continue-on-error. Adjacent Vitest run steps legitimately do so to
    // guarantee three JSON reports are always produced.
    const stepRegex =
      /-\s*name:\s*Full-suite policy evaluator[^\n]*\n(?:[^-][^\n]*\n?)*/;
    const stepBlock = workflow.match(stepRegex);
    expect(stepBlock, "policy evaluator step must exist").not.toBeNull();
    expect((stepBlock as RegExpMatchArray)[0]).not.toMatch(
      /continue-on-error:\s*true/,
    );
  });

  it("23. No managed Lovable Supabase hostname, command or credential is introduced", () => {
    // The Vitest config must not reference any hosted Supabase URLs or
    // service-role credentials. Workflow already provisions a fully
    // disposable local Supabase stack under CI3/CI4 and is out of scope
    // for this CI14C runner-isolation repair.
    expect(vitestConfig).not.toMatch(/\.supabase\.co/);
    expect(vitestConfig).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("24. Runtime, OpenAPI and migration files are not involved in the repair", () => {
    // The exclusion targets a Playwright-owned smoke test; runtime areas untouched.
    expect(vitestConfig).not.toMatch(/gateway-query/);
    expect(vitestConfig).not.toMatch(/openapi/i);
    expect(vitestConfig).not.toMatch(/migration/i);
  });
});

describe("CI14C — future-tolerant compatibility", () => {
  it("accepts a subsequent CI addition to the workflow header", () => {
    // The workflow header contains a CI14C marker; future CI15 additions must
    // not break this test because it only asserts CI14C presence.
    expect(workflow).toContain("CI14C");
  });
});

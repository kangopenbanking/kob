import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(
  resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml"),
  "utf8",
);
const TEARDOWN = readFileSync(
  resolve(ROOT, "scripts/phase1b-d2a/teardown.mjs"),
  "utf8",
);
const PAGINATION = readFileSync(
  resolve(ROOT, "supabase/functions/_shared/pagination.ts"),
  "utf8",
);

describe("Phase 1B R1I-d.2A CI12 — Edge Runtime cursor-secret propagation", () => {
  it("1. mints a fresh 32-byte hexadecimal cursor secret", () => {
    expect(WORKFLOW).toMatch(/KOB_CURSOR_HMAC_SECRET=\$\(openssl\s+rand\s+-hex\s+32\)/);
  });

  it("2. does not hard-code a cursor secret", () => {
    expect(WORKFLOW).not.toMatch(/KOB_CURSOR_HMAC_SECRET=[a-f0-9]{32,}/);
  });

  it("3. is not sourced from a managed or production project", () => {
    expect(WORKFLOW).not.toMatch(/secrets\.KOB_CURSOR_HMAC_SECRET/);
    expect(WORKFLOW).not.toMatch(/vars\.KOB_CURSOR_HMAC_SECRET/);
  });

  it("4. creates a temporary Edge Function environment file under RUNNER_TEMP", () => {
    expect(WORKFLOW).toMatch(/FUNCTION_ENV_FILE="\$RUNNER_TEMP\/kob-d2a-edge-runtime\.env"/);
  });

  it("5. env file contains only KOB_CURSOR_HMAC_SECRET (single line, single key)", () => {
    expect(WORKFLOW).toMatch(/printf 'KOB_CURSOR_HMAC_SECRET=%s\\n'/);
    expect(WORKFLOW).toMatch(/wc -l < "\$FUNCTION_ENV_FILE".*= "1"/);
    expect(WORKFLOW).toMatch(/grep -c '\^KOB_CURSOR_HMAC_SECRET='.*= "1"/);
  });

  it("6. file is created with restrictive permissions (600)", () => {
    expect(WORKFLOW).toMatch(/umask 077/);
    expect(WORKFLOW).toMatch(/chmod 600 "\$FUNCTION_ENV_FILE"/);
    expect(WORKFLOW).toMatch(/stat -c '%a' "\$FUNCTION_ENV_FILE".*= "600"/);
  });

  it("7. env file is never printed via cat/echo/sed/grep of contents", () => {
    expect(WORKFLOW).not.toMatch(/cat\s+"?\$FUNCTION_ENV_FILE/);
    expect(WORKFLOW).not.toMatch(/cat\s+"?\$D2A_FUNCTION_ENV_FILE/);
    expect(WORKFLOW).not.toMatch(/cat\s+.*kob-d2a-edge-runtime\.env/);
    expect(WORKFLOW).not.toMatch(/echo\s+"?\$KOB_CURSOR_HMAC_SECRET/);
    expect(WORKFLOW).not.toMatch(/sed\s+.*kob-d2a-edge-runtime\.env/);
  });

  it("8. serve command includes --env-file", () => {
    expect(WORKFLOW).toMatch(/supabase functions serve gateway-query[\s\S]*--env-file/);
  });

  it("9. serve command references D2A_FUNCTION_ENV_FILE", () => {
    expect(WORKFLOW).toMatch(/--env-file "\$D2A_FUNCTION_ENV_FILE"/);
  });

  it("10. serve command still targets only gateway-query", () => {
    const serveMatches = WORKFLOW.match(/supabase functions serve \S+/g) || [];
    expect(serveMatches.length).toBeGreaterThan(0);
    for (const m of serveMatches) {
      expect(m).toBe("supabase functions serve gateway-query");
    }
  });

  it("11. serve command remains --no-verify-jwt", () => {
    expect(WORKFLOW).toMatch(/supabase functions serve gateway-query[\s\S]*--no-verify-jwt/);
  });

  it("12. no default cursor secret is added to pagination.ts", () => {
    expect(PAGINATION).not.toMatch(/KOB_CURSOR_HMAC_SECRET\s*\|\|\s*['"`]/);
    expect(PAGINATION).not.toMatch(/default.*cursor.*secret/i);
  });

  it("13. no unsigned cursor fallback is introduced", () => {
    expect(PAGINATION).not.toMatch(/unsigned\s*cursor/i);
    expect(PAGINATION).not.toMatch(/skipSignature|allowUnsigned/);
  });

  it("14. no `supabase secrets set` command is introduced", () => {
    expect(WORKFLOW).not.toMatch(/supabase\s+secrets\s+set/);
  });

  it("15. no supabase login/link/db pull/db push commands are introduced", () => {
    expect(WORKFLOW).not.toMatch(/supabase\s+login/);
    expect(WORKFLOW).not.toMatch(/supabase\s+link/);
    expect(WORKFLOW).not.toMatch(/supabase\s+db\s+pull/);
    expect(WORKFLOW).not.toMatch(/supabase\s+db\s+push/);
  });

  it("16. no repository .env file is introduced for the runtime secret", () => {
    const repoEnv = resolve(ROOT, ".env.d2a");
    expect(existsSync(repoEnv)).toBe(false);
    expect(WORKFLOW).not.toMatch(/echo.*KOB_CURSOR_HMAC_SECRET.*>>?\s*\.env/);
  });

  it("17. edge-runtime-env-attestation.json records no secret value", () => {
    expect(WORKFLOW).toMatch(/cursorSecretValueRecorded:\s*false/);
    expect(WORKFLOW).not.toMatch(/cursorSecretValueRecorded:\s*true/);
    // The attestation node script must not read the secret value into JSON.
    expect(WORKFLOW).not.toMatch(/cursorSecretValue:\s*process\.env\.KOB_CURSOR_HMAC_SECRET/);
  });

  it("18. attestation records permissions, line count and key presence", () => {
    expect(WORKFLOW).toMatch(/permissions:\s*mode/);
    expect(WORKFLOW).toMatch(/lineCount:\s*lines\.length/);
    expect(WORKFLOW).toMatch(/cursorSecretKeyPresent:/);
  });

  it("19. the temporary function environment file is NOT uploaded as an artifact", () => {
    expect(WORKFLOW).not.toMatch(/kob-d2a-edge-runtime\.env\s*$/m);
    expect(WORKFLOW).not.toMatch(/D2A_FUNCTION_ENV_FILE[\s\S]{0,200}upload-artifact/);
  });

  it("20. the attestation JSON is uploaded", () => {
    expect(WORKFLOW).toMatch(/edge-runtime-env-attestation\.json/);
  });

  it("21. the server-stop step removes the temporary function environment file", () => {
    const stopBlock = WORKFLOW.match(/Stop Edge Function server[\s\S]*?(?=\n\s+- name:)/);
    expect(stopBlock).not.toBeNull();
    expect(stopBlock![0]).toMatch(/rm -f "\$D2A_FUNCTION_ENV_FILE"/);
    expect(stopBlock![0]).toMatch(/if:\s*always\(\)/);
  });

  it("22. teardown.mjs removes both .d2a.env and the function environment file", () => {
    expect(TEARDOWN).toMatch(/\.d2a\.env/);
    expect(TEARDOWN).toMatch(/D2A_FUNCTION_ENV_FILE/);
    expect(TEARDOWN).toMatch(/kob-d2a-edge-runtime\.env/);
    expect(TEARDOWN).toMatch(/RUNNER_TEMP/);
  });

  it("23. teardown fails when either temporary file remains", () => {
    expect(TEARDOWN).toMatch(/residualTemporaryEnvFiles\s*>\s*0[\s\S]*teardownExitCode\s*=\s*12/);
  });

  it("24. residualTemporaryEnvFile remains present for backward compatibility", () => {
    expect(TEARDOWN).toContain("residualTemporaryEnvFile");
  });

  it("25. residualTemporaryEnvFiles is zero on successful teardown (by construction)", () => {
    expect(TEARDOWN).toMatch(/residualTemporaryEnvFiles:\s*null/);
    expect(TEARDOWN).toMatch(/summary\.residualTemporaryEnvFiles\s*=\s*residualCount/);
  });

  it("26. workflow explicitly executes CI5 through CI12 static tests", () => {
    for (const f of [
      "phase1b-d2a-ci5-migration-reproducibility.test.ts",
      "phase1b-d2a-ci6-extension-reproducibility.test.ts",
      "phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts",
      "phase1b-d2a-ci8-translation-fk-reproducibility.test.ts",
      "phase1b-d2a-ci9-extension-sweep-reproducibility.test.ts",
      "phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts",
      "phase1b-d2a-ci11-auth-parent-fixture-reproducibility.test.ts",
      "phase1b-d2a-ci12-edge-runtime-secret-propagation.test.ts",
    ]) {
      expect(WORKFLOW).toContain(f);
    }
  });

  it("27. runtime result files remain uploaded", () => {
    for (const f of [
      "runtime-results.json",
      "runtime-results.log",
      "runtime-serve.log",
      "pagination-header-results.json",
      "cursor-security-results.json",
      "database-call-evidence.json",
      "teardown-results.json",
      "teardown-results.log",
    ]) {
      expect(WORKFLOW).toContain(f);
    }
  });

  it("28. no managed Lovable Supabase credential or command is introduced", () => {
    expect(WORKFLOW).not.toMatch(/wdzkzeahdtxlynetndqw/);
    expect(WORKFLOW).not.toMatch(/supabase\.co/);
    expect(WORKFLOW).not.toMatch(/SUPABASE_ACCESS_TOKEN/);
  });
});

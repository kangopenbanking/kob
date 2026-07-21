import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeTemporaryEnvAccounting,
  removeKnownTemporaryPath,
  sanitizeRemovalErrorCode,
} from "../../scripts/phase1b-d2a/teardown.mjs";


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
    expect(TEARDOWN).toMatch(/residualKnownTemporaryEnvFiles[\s\S]*teardownExitCode\s*=\s*12/);
  });

  it("24. residualTemporaryEnvFile remains present for backward compatibility", () => {
    expect(TEARDOWN).toContain("residualTemporaryEnvFile");
  });

  it("25. residualTemporaryEnvFiles is initialised to null and later assigned", () => {
    expect(TEARDOWN).toMatch(/residualTemporaryEnvFiles:\s*null/);
    expect(TEARDOWN).toMatch(/summary\.residualTemporaryEnvFiles\s*=\s*summary\.residualKnownTemporaryEnvFiles/);
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

describe("Phase 1B R1I-d.2A CI12A — cross-step temporary environment cleanup accounting", () => {
  it("A1. D2A_BASE_ENV_PREPARED is set only after .d2a.env creation and is verified", () => {
    // The marker line must appear AFTER the `supabase status -o env > .d2a.env` line.
    const idxCreate = WORKFLOW.indexOf("supabase status -o env > .d2a.env");
    const idxMarker = WORKFLOW.indexOf('D2A_BASE_ENV_PREPARED=true');
    expect(idxCreate).toBeGreaterThan(-1);
    expect(idxMarker).toBeGreaterThan(idxCreate);
    // Existence of the file is verified before the marker is written.
    const between = WORKFLOW.slice(idxCreate, idxMarker);
    expect(between).toMatch(/test -s \.d2a\.env/);
  });

  it("A2. D2A_FUNCTION_ENV_PREPARED is set only after function env creation and attestation", () => {
    const idxAttest = WORKFLOW.indexOf("edge-runtime-env-attestation.json");
    const idxMarker = WORKFLOW.indexOf('D2A_FUNCTION_ENV_PREPARED=true');
    expect(idxAttest).toBeGreaterThan(-1);
    expect(idxMarker).toBeGreaterThan(idxAttest);
    // The attestation write is verified with `test -s` immediately prior.
    expect(WORKFLOW).toMatch(/test -s edge-runtime-env-attestation\.json\s*\n\s*# CI12A/);
  });

  it("A3. stop step initializes FUNCTION_ENV_REMOVED_BY_STOP to zero", () => {
    const stopBlock = WORKFLOW.match(/Stop Edge Function server[\s\S]*?(?=\n\s+- name:)/)![0];
    expect(stopBlock).toMatch(/FUNCTION_ENV_REMOVED_BY_STOP=0/);
  });

  it("A4. stop step sets the marker to one only after verified removal", () => {
    const stopBlock = WORKFLOW.match(/Stop Edge Function server[\s\S]*?(?=\n\s+- name:)/)![0];
    // rm -> verify absent -> set marker to 1, in that order.
    const idxRm = stopBlock.indexOf('rm -f "$D2A_FUNCTION_ENV_FILE"');
    const idxVerify = stopBlock.indexOf('test ! -e "$D2A_FUNCTION_ENV_FILE"');
    const idxSet = stopBlock.indexOf('FUNCTION_ENV_REMOVED_BY_STOP=1');
    expect(idxRm).toBeGreaterThan(-1);
    expect(idxVerify).toBeGreaterThan(idxRm);
    expect(idxSet).toBeGreaterThan(idxVerify);
  });

  it("A5. FUNCTION_ENV_REMOVED_BY_STOP is written to GITHUB_ENV", () => {
    const stopBlock = WORKFLOW.match(/Stop Edge Function server[\s\S]*?(?=\n\s+- name:)/)![0];
    expect(stopBlock).toMatch(/D2A_FUNCTION_ENV_REMOVED_BY_STOP=\$FUNCTION_ENV_REMOVED_BY_STOP[\s\S]*>>\s*"\$GITHUB_ENV"/);
  });

  it("A6. teardown calculates expected files dynamically from preparation markers", () => {
    expect(TEARDOWN).toMatch(/D2A_BASE_ENV_PREPARED/);
    expect(TEARDOWN).toMatch(/D2A_FUNCTION_ENV_PREPARED/);
    expect(TEARDOWN).toMatch(/temporaryEnvFilesExpected\s*=\s*[\s\S]*baseEnvPrepared[\s\S]*functionEnvPrepared/);
    // No hard-coded expected: 2 for runs that might fail early.
    expect(TEARDOWN).not.toMatch(/temporaryEnvFilesExpected:\s*2\b/);
  });

  it("A7. teardown records removal by server stop separately", () => {
    expect(TEARDOWN).toMatch(/temporaryEnvFilesRemovedByServerStop/);
    expect(TEARDOWN).toMatch(/D2A_FUNCTION_ENV_REMOVED_BY_STOP/);
  });

  it("A8. teardown records removal by final teardown separately", () => {
    expect(TEARDOWN).toMatch(/temporaryEnvFilesRemovedByTeardown/);
  });

  it("A9. total temporaryEnvFilesRemoved is the sum of both stages", () => {
    expect(TEARDOWN).toMatch(
      /temporaryEnvFilesRemoved\s*=\s*[\s\S]*temporaryEnvFilesRemovedByServerStop[\s\S]*\+\s*[\s\S]*temporaryEnvFilesRemovedByTeardown/,
    );
  });

  it("A10. teardown fails closed when removed count differs from expected count", () => {
    expect(TEARDOWN).toMatch(
      /temporaryEnvFilesRemoved\s*!==\s*summary\.temporaryEnvFilesExpected[\s\S]*teardownExitCode\s*=\s*12/,
    );
  });

  it("A11. teardown still fails closed when residual files remain", () => {
    expect(TEARDOWN).toMatch(/residualKnownTemporaryEnvFiles[\s\S]*teardownExitCode\s*=\s*12/);
  });

  it("A12. helper: full successful lifecycle → expected=2 removed=2 residual=0", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(2);
    expect(r.temporaryEnvFilesRemovedByServerStop).toBe(1);
    expect(r.temporaryEnvFilesRemovedByTeardown).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(2);
    expect(r.residualTemporaryEnvFiles).toBe(0);
    expect(r.accountingComplete).toBe(true);
  });

  it("A13. helper: neither file prepared → expected=0, complete", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: false,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(0);
    expect(r.temporaryEnvFilesRemoved).toBe(0);
    expect(r.accountingComplete).toBe(true);
  });

  it("A14. helper: only base env prepared → expected=1", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(1);
    expect(r.temporaryEnvFilesRemovedByTeardown).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(1);
    expect(r.residualTemporaryEnvFiles).toBe(0);
    expect(r.accountingComplete).toBe(true);
  });

  it("A15. helper: function file absent at teardown and no stop-removal record → fail closed", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(2);
    expect(r.temporaryEnvFilesRemoved).toBeLessThan(r.temporaryEnvFilesExpected);
    expect(r.accountingComplete).toBe(false);
  });

  it("A16. helper: expected file remains present → residual>0, fail closed", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
      baseEnvPresentAfterCleanup: true,
    });
    expect(r.residualKnownTemporaryEnvFiles).toBeGreaterThan(0);
    expect(r.accountingComplete).toBe(false);
  });

  it("A17. no secret value or temporary env file is uploaded as an artifact", () => {
    expect(WORKFLOW).not.toMatch(/D2A_FUNCTION_ENV_FILE[\s\S]{0,200}upload-artifact/);
    expect(WORKFLOW).not.toMatch(/KOB_CURSOR_HMAC_SECRET[\s\S]{0,200}upload-artifact/);
    expect(WORKFLOW).not.toMatch(/kob-d2a-edge-runtime\.env\s*$/m);
  });

  it("A18. workflow header records CI12A", () => {
    expect(WORKFLOW).toMatch(/# CI12A cross-step temporary environment cleanup accounting/);
  });
});

describe("Phase 1B R1I-d.2A CI12B — partial-preparation temporary secret-file cleanup", () => {
  it("B1. workflow header records CI12B without changing env-file propagation", () => {
    expect(WORKFLOW).toMatch(/# CI12B partial-preparation temporary secret-file cleanup/);
    expect(WORKFLOW).toMatch(/FUNCTION_ENV_FILE="\$RUNNER_TEMP\/kob-d2a-edge-runtime\.env"/);
    expect(WORKFLOW).toMatch(/chmod 600 "\$FUNCTION_ENV_FILE"/);
    expect(WORKFLOW).toMatch(/--env-file "\$D2A_FUNCTION_ENV_FILE"/);
  });

  it("B2. known paths are checked regardless of preparation markers", () => {
    expect(TEARDOWN).toMatch(/const baseEnvPath\s*=\s*resolve\(ROOT, "\.d2a\.env"\)/);
    expect(TEARDOWN).toMatch(/process\.env\.D2A_FUNCTION_ENV_FILE[\s\S]*kob-d2a-edge-runtime\.env/);
    expect(TEARDOWN).toMatch(/if \(baseEnvPresentAtTeardown\)/);
    expect(TEARDOWN).toMatch(/if \(functionEnvPresentAtTeardown\)/);
  });

  it("B3. final residual scan covers both known paths without marker conditions", () => {
    const residualBlock = TEARDOWN.match(/const residualPaths = \[\];[\s\S]*?summary\.residualTemporaryEnvFile/)![0];
    expect(residualBlock).toMatch(/existsSync\(baseEnvPath\)/);
    expect(residualBlock).toMatch(/existsSync\(functionEnvPath\)/);
    expect(residualBlock).not.toMatch(/baseEnvPrepared/);
    expect(residualBlock).not.toMatch(/functionEnvPrepared/);
  });

  it("B4. helper: full successful lifecycle still reports expected=2 removed=2 unexpected=0 residual=0", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(2);
    expect(r.temporaryEnvFilesRemovedByServerStop).toBe(1);
    expect(r.temporaryEnvFilesRemovedByTeardown).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(2);
    expect(r.unexpectedTemporaryEnvFilesDiscovered).toBe(0);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(0);
    expect(r.residualKnownTemporaryEnvFiles).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(true);
    expect(r.teardownExitCode).toBe(0);
  });

  it("B5. helper: neither prepared and neither present remains a valid expected-0 lifecycle", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: false,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(0);
    expect(r.temporaryEnvFilesRemoved).toBe(0);
    expect(r.unexpectedTemporaryEnvFilesDiscovered).toBe(0);
    expect(r.residualKnownTemporaryEnvFiles).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(true);
  });

  it("B6. helper: .d2a.env present with no base-prepared marker is removed and classified unexpected", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(0);
    expect(r.unexpectedTemporaryEnvFilesDiscovered).toBe(1);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(0);
    expect(r.residualKnownTemporaryEnvFiles).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
    expect(r.teardownExitCode).toBe(12);
  });

  it("B7. helper: function env present with no function-prepared marker is removed and classified unexpected", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: false,
      functionEnvPresentAtTeardown: true,
    });
    expect(r.unexpectedTemporaryEnvFilesDiscovered).toBe(1);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
  });

  it("B8. helper: both unprepared but present produces unexpected=2 and incomplete status", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: true,
    });
    expect(r.unexpectedTemporaryEnvFilesDiscovered).toBe(2);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(2);
    expect(r.temporaryEnvFilesRemoved).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
    expect(r.teardownExitCode).toBe(12);
  });

  it("B9. helper: unexpected removals do not count toward expected removals", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(1);
    expect(r.temporaryEnvFilesRemoved).toBe(1);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(1);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
  });

  it("B10. helper: unexpected discovery causes fail-closed status even after successful removal", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: true,
    });
    expect(r.temporaryEnvFilesRemoved).toBe(1);
    expect(r.unexpectedTemporaryEnvFilesRemoved).toBe(1);
    expect(r.residualKnownTemporaryEnvFiles).toBe(0);
    expect(r.teardownExitCode).toBe(12);
  });

  it("B11. helper: server-stop removal marker without function-prepared marker fails closed", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: false,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.serverStopRemovalMarkerWithoutPreparation).toBe(true);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
    expect(r.teardownExitCode).toBe(12);
  });

  it("B12. helper: any removal verification failure produces residual > 0", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: false,
      functionEnvPrepared: false,
      functionEnvRemovedByStop: false,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
      baseEnvPresentAfterCleanup: true,
    });
    expect(r.removalVerificationFailures).toBe(1);
    expect(r.residualKnownTemporaryEnvFiles).toBe(1);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
  });

  it("B13. helper: prepared function env present after verified server-stop marker is inconsistent", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: true,
    });
    expect(r.serverStopRemovalMarkerContradicted).toBe(true);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(false);
    expect(r.teardownExitCode).toBe(12);
  });

  it("B14. teardown exposes separated expected, unexpected and residual summary fields", () => {
    for (const field of [
      "unexpectedTemporaryEnvFilesDiscovered",
      "unexpectedTemporaryEnvFilesRemoved",
      "residualKnownTemporaryEnvFiles",
      "temporaryEnvCleanupAccountingComplete",
      "temporaryEnvFilesRemovedByServerStop",
      "temporaryEnvFilesRemovedByTeardown",
    ]) {
      expect(TEARDOWN).toContain(field);
    }
  });

  it("B15. teardown fail-closed status covers unexpected, residual, inconsistent and verification-failure states", () => {
    expect(TEARDOWN).toMatch(/unexpectedTemporaryEnvFilesDiscovered\s*===\s*0/);
    expect(TEARDOWN).toMatch(/residualKnownTemporaryEnvFiles\s*===\s*0/);
    expect(TEARDOWN).toMatch(/temporaryEnvRemovalVerificationFailures\s*===\s*0/);
    expect(TEARDOWN).toMatch(/serverStopRemovalMarkerWithoutPreparation/);
    expect(TEARDOWN).toMatch(/serverStopRemovalMarkerContradicted/);
    expect(TEARDOWN).toMatch(/!summary\.temporaryEnvCleanupAccountingComplete[\s\S]*teardownExitCode\s*=\s*12/);
  });

  it("B16. workflow explicitly executes CI5 through CI12", () => {
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
});

describe("Phase 1B R1I-d.2A CI12C — removal-exception evidence preservation", () => {
  it("C1. workflow header records CI12C without changing env-file propagation", () => {
    expect(WORKFLOW).toMatch(
      /# CI12C temporary environment removal-exception evidence preservation/,
    );
    expect(WORKFLOW).toMatch(/--env-file "\$D2A_FUNCTION_ENV_FILE"/);
    expect(WORKFLOW).toMatch(/chmod 600 "\$FUNCTION_ENV_FILE"/);
  });

  it("C2. removeKnownTemporaryPath: missing file reports no attempt and verifiedAbsent", () => {
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c2-missing", {
      remove: () => {
        throw new Error("should not be called");
      },
      exists: () => false,
    });
    expect(r.existedBefore).toBe(false);
    expect(r.removalAttempted).toBe(false);
    expect(r.verifiedAbsent).toBe(true);
    expect(r.errorCode).toBeNull();
  });

  it("C3. removeKnownTemporaryPath: successful removal is verified", () => {
    let present = true;
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c3", {
      remove: () => {
        present = false;
      },
      exists: () => present,
    });
    expect(r.removalAttempted).toBe(true);
    expect(r.removalSucceeded).toBe(true);
    expect(r.verifiedAbsent).toBe(true);
    expect(r.errorCode).toBeNull();
  });

  it("C4. removeKnownTemporaryPath: EACCES exception is caught and reported", () => {
    const err: NodeJS.ErrnoException = new Error("permission denied");
    err.code = "EACCES";
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c4", {
      remove: () => {
        throw err;
      },
      exists: () => true,
    });
    expect(r.removalSucceeded).toBe(false);
    expect(r.verifiedAbsent).toBe(false);
    expect(r.errorCode).toBe("EACCES");
  });

  it("C5. removeKnownTemporaryPath: remove returns but file still exists", () => {
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c5", {
      remove: () => {},
      exists: () => true,
    });
    expect(r.verifiedAbsent).toBe(false);
    expect(r.errorCode).toBe("REMOVAL_NOT_VERIFIED");
  });

  it("C6. removeKnownTemporaryPath: evidence never contains path, secret, stack or raw message", () => {
    const err: NodeJS.ErrnoException = new Error(
      "raw message with SECRET=deadbeef and /tmp/kob-d2a-c6",
    );
    err.code = "EPERM";
    err.stack = "Error: raw stack line one\n    at frame";
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c6-secret-path", {
      remove: () => {
        throw err;
      },
      exists: () => true,
    });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("/tmp/kob-d2a-c6");
    expect(serialized).not.toContain("SECRET=deadbeef");
    expect(serialized).not.toContain("raw message");
    expect(serialized).not.toContain("raw stack");
    expect(r.errorCode).toBe("EPERM");
  });

  it("C7. removeKnownTemporaryPath: bogus error code is bounded to 40 chars", () => {
    const err: NodeJS.ErrnoException = new Error("boom");
    err.code = "X".repeat(200);
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-c7", {
      remove: () => {
        throw err;
      },
      exists: () => true,
    });
    expect(r.errorCode!.length).toBeLessThanOrEqual(40);
  });

  it("C8. teardown source uses removeKnownTemporaryPath for both known paths", () => {
    expect(TEARDOWN).toMatch(/export function removeKnownTemporaryPath/);
    const uses = TEARDOWN.match(/removeKnownTemporaryPath\(/g) || [];
    // one declaration + at least one call inside tryRemove
    expect(uses.length).toBeGreaterThanOrEqual(2);
    expect(TEARDOWN).toMatch(/tryRemove\(baseEnvPath, "base"\)/);
    expect(TEARDOWN).toMatch(/tryRemove\(functionEnvPath, "function"\)/);
  });

  it("C9. teardown source no longer contains an unguarded rmSync of a temp env path", () => {
    // rmSync is still used for the tmp fixture directory only; env-path removal
    // goes through removeKnownTemporaryPath.
    expect(TEARDOWN).not.toMatch(/rmSync\(baseEnvPath/);
    expect(TEARDOWN).not.toMatch(/rmSync\(functionEnvPath/);
  });

  it("C10. teardown increments temporaryEnvRemovalVerificationFailures on failure", () => {
    expect(TEARDOWN).toMatch(
      /!evidence\.verifiedAbsent[\s\S]{0,200}temporaryEnvRemovalVerificationFailures\s*\+=\s*1/,
    );
  });

  it("C11. teardown emits bounded TEMP_ENV_REMOVAL_FAILED evidence with label and code only", () => {
    expect(TEARDOWN).toMatch(
      /TEMP_ENV_REMOVAL_FAILED label=\$\{label\} code=\$\{evidence\.errorCode/,
    );
    // Absolute paths, secrets and stacks are never appended to errors.
    expect(TEARDOWN).not.toMatch(/errors\.push\([^)]*error\.stack/);
    expect(TEARDOWN).not.toMatch(/errors\.push\([^)]*error\.message/);
    expect(TEARDOWN).not.toMatch(/errors\.push\([^)]*KOB_CURSOR_HMAC_SECRET/);
  });

  it("C12. teardown does NOT increment removed counters when verification fails", () => {
    // Removed counters are guarded by `if (evidence.verifiedAbsent)`.
    expect(TEARDOWN).toMatch(
      /if \(evidence\.verifiedAbsent\)[\s\S]{0,400}temporaryEnvFilesRemovedByTeardown\s*\+=\s*1/,
    );
    expect(TEARDOWN).toMatch(
      /if \(evidence\.verifiedAbsent\)[\s\S]{0,400}unexpectedTemporaryEnvFilesRemoved\s*\+=\s*1/,
    );
  });

  it("C13. teardown writes teardown-results.json before process.exit", () => {
    const writeIdx = TEARDOWN.indexOf('writeFileSync("teardown-results.json"');
    const exitIdx = TEARDOWN.lastIndexOf("process.exit(summary.teardownExitCode)");
    expect(writeIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(writeIdx);
  });

  it("C14. teardown sets teardownExitCode=12 when removal verification fails", () => {
    // removalVerificationFailures feeds into temporaryEnvCleanupAccountingComplete,
    // which drives teardownExitCode = 12.
    expect(TEARDOWN).toMatch(/temporaryEnvRemovalVerificationFailures\s*===\s*0/);
    expect(TEARDOWN).toMatch(
      /!summary\.temporaryEnvCleanupAccountingComplete[\s\S]*teardownExitCode\s*=\s*12/,
    );
  });

  it("C15. successful lifecycle helper output is unchanged by CI12C", () => {
    const r = computeTemporaryEnvAccounting({
      baseEnvPrepared: true,
      functionEnvPrepared: true,
      functionEnvRemovedByStop: true,
      baseEnvPresentAtTeardown: true,
      functionEnvPresentAtTeardown: false,
    });
    expect(r.temporaryEnvFilesExpected).toBe(2);
    expect(r.temporaryEnvFilesRemoved).toBe(2);
    expect(r.residualKnownTemporaryEnvFiles).toBe(0);
    expect(r.removalVerificationFailures).toBe(0);
    expect(r.temporaryEnvCleanupAccountingComplete).toBe(true);
    expect(r.teardownExitCode).toBe(0);
  });

  it("C16. removeKnownTemporaryPath: default deps do not throw for a non-existent path", () => {
    const r = removeKnownTemporaryPath(
      "/tmp/kob-d2a-nonexistent-" + Math.random().toString(36).slice(2),
    );
    expect(r.existedBefore).toBe(false);
    expect(r.verifiedAbsent).toBe(true);
  });
});

describe("CI12D — filesystem removal error-code allowlist", () => {
  it("D1. EACCES remains EACCES", () => {
    expect(sanitizeRemovalErrorCode("EACCES")).toBe("EACCES");
  });
  it("D2. EPERM remains EPERM", () => {
    expect(sanitizeRemovalErrorCode("EPERM")).toBe("EPERM");
  });
  it("D3. lowercase eacces normalises to EACCES", () => {
    expect(sanitizeRemovalErrorCode("eacces")).toBe("EACCES");
  });
  it("D4. unknown code becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("EWEIRD")).toBe("REMOVE_FAILED");
  });
  it("D5. 200-character code becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("A".repeat(200))).toBe("REMOVE_FAILED");
  });
  it("D6. SECRET=deadbeef becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("SECRET=deadbeef")).toBe("REMOVE_FAILED");
  });
  it("D7. absolute path becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("/tmp/kob-d2a-edge-runtime.env")).toBe(
      "REMOVE_FAILED",
    );
  });
  it("D8. newline-injected code becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("EACCES\nSECRET=value")).toBe(
      "REMOVE_FAILED",
    );
  });
  it("D9. space-injected code becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("EACCES code=/tmp/file")).toBe(
      "REMOVE_FAILED",
    );
  });
  it("D10. empty string becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode("")).toBe("REMOVE_FAILED");
  });
  it("D11. non-string becomes REMOVE_FAILED", () => {
    expect(sanitizeRemovalErrorCode(null)).toBe("REMOVE_FAILED");
    expect(sanitizeRemovalErrorCode(undefined)).toBe("REMOVE_FAILED");
    expect(sanitizeRemovalErrorCode(42)).toBe("REMOVE_FAILED");
    expect(sanitizeRemovalErrorCode({})).toBe("REMOVE_FAILED");
  });
  it("D12. serialised removal evidence contains none of the malicious raw values", () => {
    const malicious = "SECRET=deadbeef\n/tmp/kob-d2a-edge-runtime.env";
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-any", {
      exists: () => true,
      remove: () => {
        const e = new Error("boom");
        // @ts-expect-error attach code
        e.code = malicious;
        throw e;
      },
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain("SECRET=deadbeef");
    expect(serialised).not.toContain("/tmp/kob-d2a-edge-runtime.env");
    expect(serialised).not.toContain("\n");
    expect(r.errorCode).toBe("REMOVE_FAILED");
  });
  it("D13. persisted TEMP_ENV_REMOVAL_FAILED uses only the sanitised code", () => {
    const r = removeKnownTemporaryPath("/tmp/kob-d2a-any", {
      exists: () => true,
      remove: () => {
        const e = new Error("boom");
        // @ts-expect-error attach code
        e.code = "eacces";
        throw e;
      },
    });
    const persisted = `TEMP_ENV_REMOVAL_FAILED label=base code=${r.errorCode || "REMOVE_FAILED"}`;
    expect(persisted).toBe("TEMP_ENV_REMOVAL_FAILED label=base code=EACCES");
  });
  it("D14. removeKnownTemporaryPath no longer contains rawCode.slice()", () => {
    expect(TEARDOWN).not.toMatch(/rawCode\s*\.\s*slice/);
    expect(TEARDOWN).not.toMatch(/\brawCode\b/);
  });
  it("D15. teardown.mjs writes teardown-results.json before process.exit()", () => {
    const writeIdx = TEARDOWN.indexOf("teardown-results.json");
    const exitIdx = TEARDOWN.indexOf("process.exit");
    expect(writeIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeLessThan(exitIdx);
  });
  it("D16. sanitizeRemovalErrorCode is exported and referenced in removeKnownTemporaryPath", () => {
    expect(typeof sanitizeRemovalErrorCode).toBe("function");
    expect(TEARDOWN).toMatch(/export\s+function\s+sanitizeRemovalErrorCode/);
    expect(TEARDOWN).toMatch(/sanitizeRemovalErrorCode\(\s*error\?\.code\s*\)/);
  });
});

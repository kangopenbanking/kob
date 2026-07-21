#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3A §CI3A-7 — Fail-closed teardown.
// CI12A — cross-step temporary environment cleanup accounting.
// CI12B — partial-preparation temporary secret-file cleanup.
//
// Runs after success AND failure. Never touches production. Removes only the
// disposable containers, volumes, temporary fixtures, and ephemeral secrets
// created by the bootstrap script.
//
// CI12A corrections vs CI12:
//   * Dynamic temporaryEnvFilesExpected derived from preparation markers
//     (D2A_BASE_ENV_PREPARED, D2A_FUNCTION_ENV_PREPARED). Earlier failures
//     that never created a file are not counted as expected.
//   * Separate accounting fields for removals performed by the server-stop
//     step versus the final teardown, so that a stop-step removal is not
//     double-counted nor silently discarded.
//   * Fails closed (exit 12) when temporaryEnvFilesRemoved !==
//     temporaryEnvFilesExpected OR any residual expected file remains.
// CI12B corrections vs CI12A:
//   * Always inspect and clean both known temporary secret-file paths even when
//     their preparation marker was never published.
//   * Separate expected removals from unexpected partially prepared files.
//   * Fails closed on unexpected discovery, marker inconsistency, residual known
//     files, or removal verification failure.

import { execSync, spawnSync } from "node:child_process";
import { rmSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function safeCount(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8" }).trim();
    return out ? out.split("\n").filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Pure helper: compute CI12B temporary-env cleanup accounting.
 * Exported for unit testing without invoking Supabase or Docker.
 *
 * @param {{
 *   baseEnvPrepared: boolean,
 *   functionEnvPrepared: boolean,
 *   functionEnvRemovedByStop: boolean,
 *   baseEnvPresentAtTeardown: boolean,
 *   functionEnvPresentAtTeardown: boolean,
 *   baseEnvPresentAfterCleanup?: boolean,
 *   functionEnvPresentAfterCleanup?: boolean
 * }} input
 * @returns {{
 *   temporaryEnvFilesExpected: number,
 *   temporaryEnvFilesRemovedByServerStop: number,
 *   temporaryEnvFilesRemovedByTeardown: number,
 *   temporaryEnvFilesRemoved: number,
 *   unexpectedTemporaryEnvFilesDiscovered: number,
 *   unexpectedTemporaryEnvFilesRemoved: number,
 *   residualKnownTemporaryEnvFiles: number,
 *   residualTemporaryEnvFiles: number,
 *   residualTemporaryEnvFile: number,
 *   serverStopRemovalMarkerWithoutPreparation: boolean,
 *   serverStopRemovalMarkerContradicted: boolean,
 *   removalVerificationFailures: number,
 *   temporaryEnvCleanupAccountingComplete: boolean,
 *   accountingComplete: boolean,
 *   teardownExitCode: number
 * }}
 */
export function computeTemporaryEnvAccounting(input) {
  const expected =
    (input.baseEnvPrepared ? 1 : 0) +
    (input.functionEnvPrepared ? 1 : 0);

  const serverStopRemovalMarkerWithoutPreparation =
    input.functionEnvRemovedByStop && !input.functionEnvPrepared;
  const serverStopRemovalMarkerContradicted =
    input.functionEnvPrepared &&
    input.functionEnvRemovedByStop &&
    input.functionEnvPresentAtTeardown;

  const removedByStop =
    input.functionEnvPrepared && input.functionEnvRemovedByStop ? 1 : 0;

  let removedByTeardown = 0;
  let unexpectedDiscovered = 0;
  let unexpectedRemoved = 0;
  let removalVerificationFailures = 0;

  const basePresentAfterCleanup = Boolean(input.baseEnvPresentAfterCleanup);
  const functionPresentAfterCleanup = Boolean(input.functionEnvPresentAfterCleanup);

  if (input.baseEnvPresentAtTeardown) {
    if (input.baseEnvPrepared) {
      if (basePresentAfterCleanup) removalVerificationFailures += 1;
      else removedByTeardown += 1;
    } else {
      unexpectedDiscovered += 1;
      if (basePresentAfterCleanup) removalVerificationFailures += 1;
      else unexpectedRemoved += 1;
    }
  }

  if (
    input.functionEnvPresentAtTeardown &&
    input.functionEnvPrepared &&
    !input.functionEnvRemovedByStop
  ) {
    if (functionPresentAfterCleanup) removalVerificationFailures += 1;
    else removedByTeardown += 1;
  } else if (input.functionEnvPresentAtTeardown && !input.functionEnvPrepared) {
    unexpectedDiscovered += 1;
    if (functionPresentAfterCleanup) removalVerificationFailures += 1;
    else unexpectedRemoved += 1;
  } else if (
    input.functionEnvPresentAtTeardown &&
    input.functionEnvPrepared &&
    input.functionEnvRemovedByStop
  ) {
    if (functionPresentAfterCleanup) removalVerificationFailures += 1;
  }

  const removed = removedByStop + removedByTeardown;
  const residual =
    (basePresentAfterCleanup ? 1 : 0) +
    (functionPresentAfterCleanup ? 1 : 0);
  const cleanupComplete =
    removed === expected &&
    unexpectedDiscovered === 0 &&
    unexpectedRemoved === unexpectedDiscovered &&
    residual === 0 &&
    !serverStopRemovalMarkerWithoutPreparation &&
    !serverStopRemovalMarkerContradicted &&
    removalVerificationFailures === 0;

  return {
    temporaryEnvFilesExpected: expected,
    temporaryEnvFilesRemovedByServerStop: removedByStop,
    temporaryEnvFilesRemovedByTeardown: removedByTeardown,
    temporaryEnvFilesRemoved: removed,
    unexpectedTemporaryEnvFilesDiscovered: unexpectedDiscovered,
    unexpectedTemporaryEnvFilesRemoved: unexpectedRemoved,
    residualKnownTemporaryEnvFiles: residual,
    residualTemporaryEnvFiles: residual,
    residualTemporaryEnvFile: residual,
    serverStopRemovalMarkerWithoutPreparation,
    serverStopRemovalMarkerContradicted,
    removalVerificationFailures,
    temporaryEnvCleanupAccountingComplete: cleanupComplete,
    accountingComplete: cleanupComplete,
    teardownExitCode: cleanupComplete ? 0 : 12,
  };
}

/**
 * CI12C — bounded, exception-safe removal of a known temporary secret-file
 * path. Returns structured evidence without ever revealing the path itself,
 * the file contents, the cursor secret, or the raw exception message/stack.
 *
 * @param {string} path
 * @param {{ remove?: typeof rmSync, exists?: typeof existsSync }} [deps]
 */
export function removeKnownTemporaryPath(path, deps = {}) {
  const remove = deps.remove || rmSync;
  const exists = deps.exists || existsSync;

  const existedBefore = Boolean(exists(path));
  if (!existedBefore) {
    return {
      existedBefore: false,
      removalAttempted: false,
      removalSucceeded: false,
      verifiedAbsent: true,
      errorCode: null,
    };
  }

  try {
    remove(path, { force: true });
  } catch (error) {
    const rawCode =
      error && typeof error.code === "string" && error.code.length > 0
        ? error.code
        : "REMOVE_FAILED";
    return {
      existedBefore: true,
      removalAttempted: true,
      removalSucceeded: false,
      verifiedAbsent: false,
      errorCode: rawCode.slice(0, 40),
    };
  }

  const verifiedAbsent = !exists(path);
  return {
    existedBefore: true,
    removalAttempted: true,
    removalSucceeded: verifiedAbsent,
    verifiedAbsent,
    errorCode: verifiedAbsent ? null : "REMOVAL_NOT_VERIFIED",
  };
}

// Guard so this file can be imported by tests without executing teardown.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const summary = {
    supabaseStopExitCode: null,
    dockerStopExitCode: null,
    dockerVolumeExitCode: null,
    residualSupabaseContainers: null,
    residualRuntimeProcess: null,
    residualTemporaryEnvFile: null,
    temporaryEnvFilesExpected: 0,
    temporaryEnvFilesRemovedByServerStop: 0,
    temporaryEnvFilesRemovedByTeardown: 0,
    temporaryEnvFilesRemoved: 0,
    unexpectedTemporaryEnvFilesDiscovered: 0,
    unexpectedTemporaryEnvFilesRemoved: 0,
    residualKnownTemporaryEnvFiles: null,
    temporaryEnvCleanupAccountingComplete: null,
    baseTemporaryEnvFilePresentAtTeardown: false,
    functionTemporaryEnvFilePresentAtTeardown: false,
    baseTemporaryEnvFileRemovalVerified: null,
    functionTemporaryEnvFileRemovalVerified: null,
    temporaryEnvRemovalVerificationFailures: 0,
    serverStopRemovalMarkerWithoutPreparation: false,
    serverStopRemovalMarkerContradicted: false,
    residualTemporaryEnvFiles: null,
    teardownExitCode: 0,
    errors: [],
  };

  // 1. Stop local Supabase stack (never masked).
  const supStop = run("supabase", ["stop", "--no-backup"]);
  summary.supabaseStopExitCode = supStop.code;
  if (supStop.code !== 0) summary.errors.push(`supabase stop exit=${supStop.code}: ${(supStop.stderr || supStop.stdout).slice(0, 400)}`);
  log("supabase_stop", { exit: supStop.code });

  // 2. Docker cleanup (kob-d2a labelled resources only).
  const hostedPostgres = process.env.D2A_INFRA_HOSTED_POSTGRES === "true";
  if (!hostedPostgres) {
    const dr = run("bash", ["-lc", "docker ps -q --filter label=kob-d2a | xargs -r docker rm -f"]);
    summary.dockerStopExitCode = dr.code;
    const dv = run("bash", ["-lc", "docker volume ls -q --filter label=kob-d2a | xargs -r docker volume rm -f"]);
    summary.dockerVolumeExitCode = dv.code;
  }

  // 3. Remove temporary fixture directory.
  const tmpFixture = resolve(ROOT, ".tmp/phase1b-d2a-fixture");
  if (existsSync(tmpFixture)) {
    rmSync(tmpFixture, { recursive: true, force: true });
    log("fixture_removed", { path: tmpFixture });
  }

  // 4. CI12B dynamic ephemeral env accounting and known-path cleanup.
  const baseEnvPrepared = process.env.D2A_BASE_ENV_PREPARED === "true";
  const functionEnvPrepared = process.env.D2A_FUNCTION_ENV_PREPARED === "true";
  const functionEnvRemovedByStop = process.env.D2A_FUNCTION_ENV_REMOVED_BY_STOP === "1";

  const baseEnvPath = resolve(ROOT, ".d2a.env");
  const functionEnvPath = process.env.D2A_FUNCTION_ENV_FILE
    ? resolve(process.env.D2A_FUNCTION_ENV_FILE)
    : resolve(process.env.RUNNER_TEMP || ROOT, "kob-d2a-edge-runtime.env");

  const baseEnvPresentAtTeardown = existsSync(baseEnvPath);
  const functionEnvPresentAtTeardown = existsSync(functionEnvPath);
  summary.baseTemporaryEnvFilePresentAtTeardown = baseEnvPresentAtTeardown;
  summary.functionTemporaryEnvFilePresentAtTeardown = functionEnvPresentAtTeardown;

  summary.temporaryEnvFilesExpected =
    (baseEnvPrepared ? 1 : 0) + (functionEnvPrepared ? 1 : 0);

  if (functionEnvRemovedByStop && !functionEnvPrepared) {
    summary.serverStopRemovalMarkerWithoutPreparation = true;
    summary.errors.push("D2A_FUNCTION_ENV_REMOVED_BY_STOP=1 without D2A_FUNCTION_ENV_PREPARED=true");
  }

  if (functionEnvPrepared && functionEnvRemovedByStop) {
    summary.temporaryEnvFilesRemovedByServerStop = 1;
  }

  if (functionEnvPrepared && functionEnvRemovedByStop && functionEnvPresentAtTeardown) {
    summary.serverStopRemovalMarkerContradicted = true;
    summary.errors.push("function env path existed at teardown after verified server-stop removal marker");
  }

  const removeKnownPath = (path, label) => {
    rmSync(path, { force: true });
    const verified = !existsSync(path);
    if (!verified) {
      summary.temporaryEnvRemovalVerificationFailures += 1;
      summary.errors.push(`${label} temporary env file removal could not be verified`);
    }
    return verified;
  };

  if (baseEnvPresentAtTeardown) {
    const verified = removeKnownPath(baseEnvPath, "base");
    summary.baseTemporaryEnvFileRemovalVerified = verified;
    if (baseEnvPrepared) {
      if (verified) summary.temporaryEnvFilesRemovedByTeardown += 1;
    } else {
      summary.unexpectedTemporaryEnvFilesDiscovered += 1;
      if (verified) summary.unexpectedTemporaryEnvFilesRemoved += 1;
    }
  } else {
    summary.baseTemporaryEnvFileRemovalVerified = true;
  }

  if (functionEnvPresentAtTeardown) {
    const verified = removeKnownPath(functionEnvPath, "function");
    summary.functionTemporaryEnvFileRemovalVerified = verified;
    if (!functionEnvPrepared) {
      summary.unexpectedTemporaryEnvFilesDiscovered += 1;
      if (verified) summary.unexpectedTemporaryEnvFilesRemoved += 1;
    } else if (!functionEnvRemovedByStop && verified) {
      summary.temporaryEnvFilesRemovedByTeardown += 1;
    }
  } else {
    summary.functionTemporaryEnvFileRemovalVerified = true;
  }

  summary.temporaryEnvFilesRemoved =
    summary.temporaryEnvFilesRemovedByServerStop +
    summary.temporaryEnvFilesRemovedByTeardown;

  // Residual = known temporary paths still present after all cleanup attempts.
  const residualPaths = [];
  if (existsSync(baseEnvPath)) residualPaths.push(baseEnvPath);
  if (existsSync(functionEnvPath)) residualPaths.push(functionEnvPath);
  summary.residualKnownTemporaryEnvFiles = residualPaths.length;
  summary.residualTemporaryEnvFiles = summary.residualKnownTemporaryEnvFiles;
  summary.residualTemporaryEnvFile = summary.residualKnownTemporaryEnvFiles;

  summary.temporaryEnvCleanupAccountingComplete =
    summary.temporaryEnvFilesRemoved === summary.temporaryEnvFilesExpected &&
    summary.unexpectedTemporaryEnvFilesDiscovered === 0 &&
    summary.unexpectedTemporaryEnvFilesRemoved === summary.unexpectedTemporaryEnvFilesDiscovered &&
    summary.residualKnownTemporaryEnvFiles === 0 &&
    summary.temporaryEnvRemovalVerificationFailures === 0 &&
    !summary.serverStopRemovalMarkerWithoutPreparation &&
    !summary.serverStopRemovalMarkerContradicted;

  // 5. Clear the process-scoped cursor secret (never on disk).
  if (process.env.KOB_CURSOR_HMAC_SECRET) delete process.env.KOB_CURSOR_HMAC_SECRET;

  // 6. Residual counts.
  summary.residualSupabaseContainers = safeCount(
    "docker ps -q --filter name=supabase_ --filter name=supabase-db",
  );
  // Self-excluding pattern (§CI4-7): the bracket class prevents pgrep from matching its own argv.
  summary.residualRuntimeProcess = safeCount("pgrep -f '[s]upabase functions serve gateway-query'");

  // 7. Verdict — fail closed on any incomplete accounting.
  if (summary.supabaseStopExitCode !== 0) summary.teardownExitCode = summary.supabaseStopExitCode;
  if (summary.residualSupabaseContainers > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 10;
  if (summary.residualRuntimeProcess > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 11;
  if (
    summary.temporaryEnvFilesRemoved !== summary.temporaryEnvFilesExpected &&
    summary.teardownExitCode === 0
  ) {
    summary.teardownExitCode = 12;
  }
  if (
    !summary.temporaryEnvCleanupAccountingComplete &&
    summary.teardownExitCode === 0
  ) {
    summary.teardownExitCode = 12;
  }

  writeFileSync("teardown-results.json", JSON.stringify(summary, null, 2));
  log("teardown_done", {
    teardownExitCode: summary.teardownExitCode,
    residualSupabaseContainers: summary.residualSupabaseContainers,
    residualRuntimeProcess: summary.residualRuntimeProcess,
    residualTemporaryEnvFile: summary.residualTemporaryEnvFile,
    residualTemporaryEnvFiles: summary.residualTemporaryEnvFiles,
    residualKnownTemporaryEnvFiles: summary.residualKnownTemporaryEnvFiles,
    temporaryEnvFilesExpected: summary.temporaryEnvFilesExpected,
    temporaryEnvFilesRemoved: summary.temporaryEnvFilesRemoved,
    temporaryEnvFilesRemovedByServerStop: summary.temporaryEnvFilesRemovedByServerStop,
    temporaryEnvFilesRemovedByTeardown: summary.temporaryEnvFilesRemovedByTeardown,
    unexpectedTemporaryEnvFilesDiscovered: summary.unexpectedTemporaryEnvFilesDiscovered,
    unexpectedTemporaryEnvFilesRemoved: summary.unexpectedTemporaryEnvFilesRemoved,
    temporaryEnvCleanupAccountingComplete: summary.temporaryEnvCleanupAccountingComplete,
  });
  if (summary.teardownExitCode !== 0) process.exit(summary.teardownExitCode);
}

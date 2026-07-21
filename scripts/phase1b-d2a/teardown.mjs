#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3A §CI3A-7 — Fail-closed teardown.
// CI12A — cross-step temporary environment cleanup accounting.
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
 * Pure helper: compute CI12A temporary-env cleanup accounting.
 * Exported for unit testing without invoking Supabase or Docker.
 *
 * @param {{
 *   baseEnvPrepared: boolean,
 *   functionEnvPrepared: boolean,
 *   functionEnvRemovedByStop: boolean,
 *   baseEnvPresentAtTeardown: boolean,
 *   functionEnvPresentAtTeardown: boolean
 * }} input
 * @returns {{
 *   temporaryEnvFilesExpected: number,
 *   temporaryEnvFilesRemovedByServerStop: number,
 *   temporaryEnvFilesRemovedByTeardown: number,
 *   temporaryEnvFilesRemoved: number,
 *   residualTemporaryEnvFiles: number,
 *   accountingComplete: boolean
 * }}
 */
export function computeTemporaryEnvAccounting(input) {
  const expected =
    (input.baseEnvPrepared ? 1 : 0) +
    (input.functionEnvPrepared ? 1 : 0);

  const removedByStop =
    input.functionEnvPrepared && input.functionEnvRemovedByStop ? 1 : 0;

  // Teardown removes any expected file still present.
  let removedByTeardown = 0;
  if (input.baseEnvPrepared && input.baseEnvPresentAtTeardown) removedByTeardown += 1;
  if (
    input.functionEnvPrepared &&
    !input.functionEnvRemovedByStop &&
    input.functionEnvPresentAtTeardown
  ) {
    removedByTeardown += 1;
  }

  const removed = removedByStop + removedByTeardown;

  // Residual = expected files that remain unaccounted for.
  let residual = 0;
  if (input.baseEnvPrepared && input.baseEnvPresentAtTeardown === false && removedByTeardown < 1 && expected > 0) {
    // base was prepared but neither present at teardown nor removed → treat as
    // residual only if we have no evidence it was cleaned. Missing-but-not-
    // removed counts as residual accounting failure.
    if (!(input.baseEnvPrepared && input.baseEnvPresentAtTeardown)) {
      // If prepared and absent and not removed here → accounting incomplete.
      // But absence at teardown without a removal record means we cannot
      // attribute the removal → residual accounting failure signalled via
      // removed !== expected.
    }
  }

  // Actual residual: files that STILL exist after teardown attempts.
  // Since this helper is called BEFORE any physical removal, residual is
  // computed as "expected files that are still present and were not removed
  // by stop and not removed by teardown".
  // (In practice removedByTeardown already includes files present at teardown;
  // so after removal, none remain. Residual therefore reflects expected files
  // that we could not account for.)
  const accounted = removedByStop + removedByTeardown;
  residual = Math.max(0, expected - accounted);

  return {
    temporaryEnvFilesExpected: expected,
    temporaryEnvFilesRemovedByServerStop: removedByStop,
    temporaryEnvFilesRemovedByTeardown: removedByTeardown,
    temporaryEnvFilesRemoved: removed,
    residualTemporaryEnvFiles: residual,
    accountingComplete: removed === expected && residual === 0,
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

  // 4. CI12A dynamic ephemeral env accounting.
  const baseEnvPrepared = process.env.D2A_BASE_ENV_PREPARED === "true";
  const functionEnvPrepared = process.env.D2A_FUNCTION_ENV_PREPARED === "true";
  const functionEnvRemovedByStop = process.env.D2A_FUNCTION_ENV_REMOVED_BY_STOP === "1";

  const baseEnvPath = resolve(ROOT, ".d2a.env");
  const functionEnvPath = process.env.D2A_FUNCTION_ENV_FILE
    ? resolve(process.env.D2A_FUNCTION_ENV_FILE)
    : resolve(process.env.RUNNER_TEMP || ROOT, "kob-d2a-edge-runtime.env");

  const baseEnvPresentAtTeardown = existsSync(baseEnvPath);
  const functionEnvPresentAtTeardown = existsSync(functionEnvPath);

  summary.temporaryEnvFilesExpected =
    (baseEnvPrepared ? 1 : 0) + (functionEnvPrepared ? 1 : 0);

  if (functionEnvPrepared && functionEnvRemovedByStop) {
    summary.temporaryEnvFilesRemovedByServerStop = 1;
  }

  // Independent second-layer removal by teardown.
  if (baseEnvPrepared && baseEnvPresentAtTeardown) {
    rmSync(baseEnvPath, { force: true });
    if (!existsSync(baseEnvPath)) summary.temporaryEnvFilesRemovedByTeardown += 1;
  }
  if (
    functionEnvPrepared &&
    !functionEnvRemovedByStop &&
    functionEnvPresentAtTeardown
  ) {
    rmSync(functionEnvPath, { force: true });
    if (!existsSync(functionEnvPath)) summary.temporaryEnvFilesRemovedByTeardown += 1;
  } else if (functionEnvPrepared && !functionEnvRemovedByStop && functionEnvPresentAtTeardown === false) {
    // Prepared, not removed by stop, absent at teardown → cannot attribute.
    // Leave counts as-is; the removed!==expected check will fail closed below.
  }

  summary.temporaryEnvFilesRemoved =
    summary.temporaryEnvFilesRemovedByServerStop +
    summary.temporaryEnvFilesRemovedByTeardown;

  // Residual = expected files still present after all cleanup attempts.
  const residualPaths = [];
  if (baseEnvPrepared && existsSync(baseEnvPath)) residualPaths.push(baseEnvPath);
  if (functionEnvPrepared && existsSync(functionEnvPath)) residualPaths.push(functionEnvPath);
  summary.residualTemporaryEnvFiles = residualPaths.length;
  summary.residualTemporaryEnvFile = residualPaths.length;

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
  if (summary.residualTemporaryEnvFiles > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 12;
  if (
    summary.temporaryEnvFilesRemoved !== summary.temporaryEnvFilesExpected &&
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
    temporaryEnvFilesExpected: summary.temporaryEnvFilesExpected,
    temporaryEnvFilesRemoved: summary.temporaryEnvFilesRemoved,
    temporaryEnvFilesRemovedByServerStop: summary.temporaryEnvFilesRemovedByServerStop,
    temporaryEnvFilesRemovedByTeardown: summary.temporaryEnvFilesRemovedByTeardown,
  });
  if (summary.teardownExitCode !== 0) process.exit(summary.teardownExitCode);
}

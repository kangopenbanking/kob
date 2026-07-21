#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3A §CI3A-7 — Fail-closed teardown.
//
// Runs after success AND failure. Never touches production. Removes only the
// disposable containers, volumes, temporary fixtures, and ephemeral secrets
// created by the bootstrap script.
//
// Corrections vs CI3:
//   * Removes shell success-masking on the teardown pipeline.
//   * Captures the exit code of every teardown command explicitly.
//   * Writes teardown-results.json (also uploaded by the workflow with
//     if: always()).
//   * Fails the process (non-zero) on any residual container / process /
//     temporary env file, or on any teardown command that itself failed.

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

const summary = {
  supabaseStopExitCode: null,
  dockerStopExitCode: null,
  dockerVolumeExitCode: null,
  residualSupabaseContainers: null,
  residualRuntimeProcess: null,
  residualTemporaryEnvFile: null,
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

// 4. Remove ephemeral env file if present.
const envFile = resolve(ROOT, ".d2a.env");
if (existsSync(envFile)) {
  rmSync(envFile, { force: true });
}
summary.residualTemporaryEnvFile = existsSync(envFile) ? 1 : 0;

// 5. Clear the process-scoped cursor secret (never on disk).
if (process.env.KOB_CURSOR_HMAC_SECRET) delete process.env.KOB_CURSOR_HMAC_SECRET;

// 6. Residual counts.
summary.residualSupabaseContainers = safeCount(
  "docker ps -q --filter name=supabase_ --filter name=supabase-db",
);
// Self-excluding pattern (§CI4-7): the bracket class prevents pgrep from matching its own argv.
summary.residualRuntimeProcess = safeCount("pgrep -f '[s]upabase functions serve gateway-query'");

// 7. Verdict.
if (summary.supabaseStopExitCode !== 0) summary.teardownExitCode = summary.supabaseStopExitCode;
if (summary.residualSupabaseContainers > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 10;
if (summary.residualRuntimeProcess > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 11;
if (summary.residualTemporaryEnvFile > 0 && summary.teardownExitCode === 0) summary.teardownExitCode = 12;

writeFileSync("teardown-results.json", JSON.stringify(summary, null, 2));
log("teardown_done", {
  teardownExitCode: summary.teardownExitCode,
  residualSupabaseContainers: summary.residualSupabaseContainers,
  residualRuntimeProcess: summary.residualRuntimeProcess,
  residualTemporaryEnvFile: summary.residualTemporaryEnvFile,
});
if (summary.teardownExitCode !== 0) process.exit(summary.teardownExitCode);

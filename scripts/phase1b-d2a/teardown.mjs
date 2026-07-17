#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — Disposable-environment teardown.
//
// Runs after success AND failure. Never touches production. Removes only the
// disposable containers, volumes, temporary fixtures, and ephemeral secrets
// created by the bootstrap script. Retains only the authorised evidence
// artifacts under docs/audits/phase-1/.

import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

function safeRun(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hostedPostgres = process.env.D2A_INFRA_HOSTED_POSTGRES === "true";

if (!hostedPostgres) {
  log("docker_stop", { ok: safeRun("docker ps -q --filter label=kob-d2a | xargs -r docker rm -f") });
  log("docker_volumes", { ok: safeRun("docker volume ls -q --filter label=kob-d2a | xargs -r docker volume rm -f") });
}

const tmpFixture = resolve(ROOT, ".tmp/phase1b-d2a-fixture");
if (existsSync(tmpFixture)) {
  rmSync(tmpFixture, { recursive: true, force: true });
  log("fixture_removed", { path: tmpFixture });
}

// Ephemeral secret cleanup — only clears the process-scoped env var; there is
// nothing to remove from disk because the workflow never writes it there.
if (process.env.KOB_CURSOR_HMAC_SECRET) {
  delete process.env.KOB_CURSOR_HMAC_SECRET;
  log("cursor_secret_cleared", { ok: true });
}

// Post-teardown reachability check — if the disposable database is still
// reachable AFTER teardown in local Docker mode, fail so the operator knows.
if (!hostedPostgres) {
  const still = safeRun("docker ps -q --filter label=kob-d2a | grep -q .");
  log("post_teardown_still_running", { present: still });
  if (still) process.exit(1);
}

log("teardown_ok", {});

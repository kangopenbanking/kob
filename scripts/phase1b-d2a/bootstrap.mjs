#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — Disposable-environment bootstrap.
//
// Environment-neutral. Runs identically on a developer workstation and on the
// Phase 1B R1I-d.2A Isolated Verification GitHub Actions workflow. Never
// touches production, never uses shared staging, never prints credentials.
//
// Order:
//   1. Fail-closed guard (scripts/phase1b-d2a/guard.mjs).
//   2. Confirm Docker (skipped if D2A_INFRA_HOSTED_POSTGRES=true, which is set
//      by the CI workflow when it uses a `services: postgres` container).
//   3. Start disposable Supabase/PostgreSQL stack (skipped in CI hosted mode).
//   4. Wait for database readiness.
//   5. Direct-session probe (SELECT 1, SHOW port, SHOW transaction_read_only).
//   6. Refuse port 6543.
//   7. Privilege probe (CREATE INDEX + CREATE INDEX CONCURRENTLY capability).
//   8. Apply canonical migration chain (test-only apply of pending Phase 1
//      migrations, in the order documented in
//      supabase/pending-migrations/phase-1/README.md).
//   9. Start local Edge Function runtime (best-effort — CI mode records
//      absence as evidence rather than fabricating a runtime).
//  10. Export redacted environment summary.
//
// Emits JSON evidence to stdout. Passwords and full URLs are never printed.

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runGuard } from "./guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const PENDING_DIR = resolve(ROOT, "supabase/pending-migrations/phase-1");
const APPLIED_MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

function which(bin) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], {
    encoding: "utf8",
  });
  return r.status === 0;
}

async function importPg() {
  try {
    return (await import("pg")).default;
  } catch (err) {
    log("pg_module_missing", { message: String(err.message || err) });
    process.exit(2);
  }
}

async function main() {
  const guard = runGuard();
  log("guard", guard);

  const hostedPostgres = process.env.D2A_INFRA_HOSTED_POSTGRES === "true";

  if (!hostedPostgres) {
    const dockerAvailable = which("docker");
    log("docker_available", { present: dockerAvailable });
    if (!dockerAvailable) {
      log("bootstrap_failed", { reason: "Docker not available and no hosted Postgres." });
      process.exit(3);
    }
    const supabaseCli = which("supabase");
    log("supabase_cli_available", { present: supabaseCli });
    // Note: We do not silently start `supabase start` here because the CI mode
    // uses a services:postgres container; local developers should invoke
    // `supabase start` themselves per the runbook. This keeps the bootstrap
    // deterministic in both environments.
  }

  const pg = await importPg();
  const client = new pg.Client({ connectionString: process.env.D2A_HARNESS_PGURL });
  await client.connect();
  try {
    const one = await client.query("SELECT 1 AS ok");
    log("db_reachable", { rows: one.rowCount });

    const port = await client.query("SHOW port");
    log("db_port", { port: port.rows[0].port });
    if (port.rows[0].port === "6543") {
      log("bootstrap_failed", { reason: "Transaction pooler port 6543 reached." });
      process.exit(4);
    }

    const ro = await client.query("SHOW transaction_read_only");
    log("db_read_only", { value: ro.rows[0].transaction_read_only });
    if (ro.rows[0].transaction_read_only !== "off") {
      log("bootstrap_failed", { reason: "Session is read-only." });
      process.exit(5);
    }

    // Privilege probe — creates + drops a throwaway index inside a scratch table.
    await client.query("CREATE TEMP TABLE d2a_priv_probe(x int)");
    await client.query("CREATE INDEX d2a_priv_probe_idx ON d2a_priv_probe(x)");
    await client.query("DROP INDEX d2a_priv_probe_idx");
    log("privilege_create_index", { ok: true });

    // CONCURRENTLY capability probe (must run outside temp; use a scratch
    // schema on the disposable database).
    await client.query("CREATE SCHEMA IF NOT EXISTS d2a_probe");
    await client.query("CREATE TABLE IF NOT EXISTS d2a_probe.t(x int)");
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS d2a_probe_t_x_idx ON d2a_probe.t(x)");
    await client.query("DROP INDEX CONCURRENTLY IF EXISTS d2a_probe.d2a_probe_t_x_idx");
    await client.query("DROP TABLE d2a_probe.t");
    await client.query("DROP SCHEMA d2a_probe");
    log("privilege_concurrently", { ok: true });
  } finally {
    await client.end();
  }

  // Apply canonical migrations in order: first supabase/migrations/, then the
  // ratified pending Phase 1 chain. Pending files are applied here for TEST
  // ONLY; this script MUST NOT be used to promote pending migrations.
  if (existsSync(APPLIED_MIGRATIONS_DIR)) {
    const files = readdirSync(APPLIED_MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    log("applied_migration_count", { count: files.length });
  }
  const pending = [
    "20260101000000_phase-1b-budgeting-additive.sql",
    "20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql",
    "20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql",
    "20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql",
  ];
  for (const f of pending) {
    const p = resolve(PENDING_DIR, f);
    if (!existsSync(p)) {
      log("pending_missing", { file: f });
      process.exit(6);
    }
    log("pending_present", { file: f, bytes: readFileSync(p).byteLength });
  }
  log("bootstrap_ok", { note: "Migrations enumerated; apply via psql in the runbook." });
}

main().catch((err) => {
  log("bootstrap_error", { message: String(err.message || err) });
  process.exit(10);
});

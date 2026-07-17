// Phase 1B — R1I-d.2A-INFRA — Static guard, bootstrap, teardown, workflow tests.
// Executes in the standard vitest suite. No database, no Docker, no network.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(__dirname, "../..");
const GUARD = resolve(ROOT, "scripts/phase1b-d2a/guard.mjs");
const WORKFLOW = resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml");

function runGuardWithEnv(env: Record<string, string>) {
  const r = spawnSync(process.execPath, [GUARD], {
    encoding: "utf8",
    env: { PATH: process.env.PATH || "", ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const BASE_OK = {
  KOB_D2A_DISPOSABLE_ENVIRONMENT: "true",
  D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:5432/scratch_d2a",
  KOB_CURSOR_HMAC_SECRET: "0123456789abcdef0123456789abcdef01234567",
};

describe("R1I-d.2A-INFRA — environment guard", () => {
  it("accepts a fully compliant disposable local environment", () => {
    const r = runGuardWithEnv(BASE_OK);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/"ok":\s*true/);
  });

  it("rejects when the disposable marker is missing", () => {
    const { KOB_D2A_DISPOSABLE_ENVIRONMENT: _drop, ...env } = BASE_OK;
    const r = runGuardWithEnv(env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_MISSING_DISPOSABLE_MARKER");
  });

  it("rejects the Supabase transaction pooler port 6543", () => {
    const r = runGuardWithEnv({
      ...BASE_OK,
      D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:6543/scratch_d2a",
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_TRANSACTION_POOLER_PORT");
  });

  it("rejects managed / public / production-like hostnames", () => {
    const hosts = [
      "db.abcdefgh.supabase.co",
      "ec2-1-2-3-4.compute.amazonaws.com",
      "prod-db.internal",
      "8.8.8.8",
    ];
    for (const h of hosts) {
      const r = runGuardWithEnv({
        ...BASE_OK,
        D2A_HARNESS_PGURL: `postgres://u:p@${h}:5432/scratch_d2a`,
      });
      expect(r.status, `host ${h} must be rejected`).not.toBe(0);
    }
  });

  it("rejects protected database names", () => {
    for (const db of ["postgres", "production", "kob", "template1"]) {
      const r = runGuardWithEnv({
        ...BASE_OK,
        D2A_HARNESS_PGURL: `postgres://u:p@127.0.0.1:5432/${db}`,
      });
      expect(r.status, `db ${db} must be rejected`).not.toBe(0);
    }
  });

  it("rejects databases without a disposable naming hint", () => {
    const r = runGuardWithEnv({
      ...BASE_OK,
      D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:5432/appdb",
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_DATABASE_NAME_NOT_DISPOSABLE");
  });

  it("rejects a missing cursor secret", () => {
    const { KOB_CURSOR_HMAC_SECRET: _drop, ...env } = BASE_OK;
    const r = runGuardWithEnv(env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_MISSING_CURSOR_SECRET");
  });

  it("rejects a cursor secret that carries production-like hints", () => {
    const r = runGuardWithEnv({
      ...BASE_OK,
      KOB_CURSOR_HMAC_SECRET: "production_secret_" + "x".repeat(32),
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_CURSOR_SECRET_LOOKS_PRODUCTION");
  });

  it("does not print the connection password or full URL", () => {
    const r = runGuardWithEnv({
      ...BASE_OK,
      D2A_HARNESS_PGURL: "postgres://user:SECRETPW@127.0.0.1:5432/scratch_d2a",
    });
    expect(r.stdout).not.toContain("SECRETPW");
    expect(r.stdout).not.toContain("user:SECRETPW");
  });
});

describe("R1I-d.2A-INFRA — CI workflow shape", () => {
  it("exists and is manually / narrowly triggered", () => {
    expect(existsSync(WORKFLOW)).toBe(true);
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/workflow_dispatch/);
    // Must NOT run on every push.
    expect(yml).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[\s*['"]main['"]/);
  });

  it("declares minimal permissions and no deployment scopes", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(yml).not.toMatch(/id-token:\s*write/);
    expect(yml).not.toMatch(/packages:\s*write/);
    expect(yml).not.toMatch(/deployments:\s*write/);
  });

  it("contains no production secret references", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    for (const bad of [
      "SUPABASE_SERVICE_ROLE",
      "PRODUCTION",
      "PROD_",
      "NETLIFY_AUTH",
      "VERCEL_TOKEN",
      "NPM_TOKEN",
    ]) {
      expect(yml, `workflow must not reference ${bad}`).not.toContain(bad);
    }
  });

  it("uses a disposable Postgres service container and sets the marker", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/services:/);
    expect(yml).toMatch(/postgres:/);
    expect(yml).toMatch(/KOB_D2A_DISPOSABLE_ENVIRONMENT:\s*['"]?true['"]?/);
  });

  it("runs teardown even on failure", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/if:\s*always\(\)[\s\S]*teardown/);
  });
});

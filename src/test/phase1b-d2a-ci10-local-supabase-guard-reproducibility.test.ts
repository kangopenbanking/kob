// Phase 1B — R1I-d.2A-CI10 — Local Supabase postgres database guard attestation.
// Narrow exception is fail-closed and requires every attestation condition.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(__dirname, "../..");
const GUARD = resolve(ROOT, "scripts/phase1b-d2a/guard.mjs");
const WORKFLOW = resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml");

function run(env: Record<string, string>) {
  const r = spawnSync(process.execPath, [GUARD], {
    encoding: "utf8",
    env: { PATH: process.env.PATH || "", ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

const SECRET = "0123456789abcdef0123456789abcdef01234567";

const DISPOSABLE = {
  KOB_D2A_DISPOSABLE_ENVIRONMENT: "true",
  D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:5432/scratch_d2a",
  KOB_CURSOR_HMAC_SECRET: SECRET,
};

const LOCAL_ATTESTED_BASE = {
  KOB_D2A_DISPOSABLE_ENVIRONMENT: "true",
  D2A_LOCAL_SUPABASE_STACK: "true",
  CI: "true",
  GITHUB_ACTIONS: "true",
  D2A_HARNESS_PGURL: "postgres://postgres:postgres@127.0.0.1:54322/postgres",
  SUPABASE_URL: "http://127.0.0.1:54321",
  KOB_CURSOR_HMAC_SECRET: SECRET,
};

describe("CI10 — local Supabase guard attestation", () => {
  it("1. standard disposable database (scratch_d2a) still accepted", () => {
    const r = run(DISPOSABLE);
    expect(r.status).toBe(0);
  });

  it("2. generic 127.0.0.1:5432/postgres remains rejected", () => {
    const r = run({ ...DISPOSABLE, D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:5432/postgres" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_PROTECTED_DATABASE_NAME");
  });

  it("3. 54322/postgres without D2A_LOCAL_SUPABASE_STACK rejected", () => {
    const r = run({ ...DISPOSABLE, D2A_HARNESS_PGURL: "postgres://u:p@127.0.0.1:54322/postgres" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_PROTECTED_DATABASE_NAME");
  });

  it("4. rejected without CI=true", () => {
    const { CI: _c, ...env } = LOCAL_ATTESTED_BASE;
    const r = run(env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("5. rejected without GITHUB_ACTIONS=true", () => {
    const { GITHUB_ACTIONS: _g, ...env } = LOCAL_ATTESTED_BASE;
    const r = run(env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("6. rejected without SUPABASE_URL", () => {
    const { SUPABASE_URL: _s, ...env } = LOCAL_ATTESTED_BASE;
    const r = run(env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("7. rejected when SUPABASE_URL uses https", () => {
    const r = run({ ...LOCAL_ATTESTED_BASE, SUPABASE_URL: "https://127.0.0.1:54321" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("8. rejected when SUPABASE_URL uses managed hostname", () => {
    const r = run({ ...LOCAL_ATTESTED_BASE, SUPABASE_URL: "http://db.abc.supabase.co:54321" });
    expect(r.status).not.toBe(0);
  });

  it("9. rejected when SUPABASE_URL uses a private non-loopback IP", () => {
    const r = run({ ...LOCAL_ATTESTED_BASE, SUPABASE_URL: "http://10.0.0.1:54321" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("10. rejected when PG host is CI alias 'postgres'", () => {
    const r = run({
      ...LOCAL_ATTESTED_BASE,
      D2A_HARNESS_PGURL: "postgres://postgres:postgres@postgres:54322/postgres",
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("11. rejected when PG port is not 54322", () => {
    const r = run({
      ...LOCAL_ATTESTED_BASE,
      D2A_HARNESS_PGURL: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
    });
    expect(r.status).not.toBe(0);
  });

  it("12. rejected when Supabase API port is not 54321", () => {
    const r = run({ ...LOCAL_ATTESTED_BASE, SUPABASE_URL: "http://127.0.0.1:8000" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED");
  });

  it("13. accepts fully attested local Supabase combination", () => {
    const r = run(LOCAL_ATTESTED_BASE);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/"localSupabaseAttested":\s*true/);
  });

  it("14. localhost accepted under same strict conditions", () => {
    const r = run({
      ...LOCAL_ATTESTED_BASE,
      D2A_HARNESS_PGURL: "postgres://postgres:postgres@localhost:54322/postgres",
      SUPABASE_URL: "http://localhost:54321",
    });
    expect(r.status).toBe(0);
  });

  it("15. other protected database names remain rejected", () => {
    for (const db of ["template1", "kob", "production", "kang"]) {
      const r = run({
        ...LOCAL_ATTESTED_BASE,
        D2A_HARNESS_PGURL: `postgres://u:p@127.0.0.1:54322/${db}`,
      });
      expect(r.status, `db ${db}`).not.toBe(0);
    }
  });

  it("16. managed Supabase hosts remain rejected", () => {
    const r = run({
      ...DISPOSABLE,
      D2A_HARNESS_PGURL: "postgres://u:p@db.abc.supabase.co:5432/scratch_d2a",
    });
    expect(r.status).not.toBe(0);
  });

  it("17. transaction pooler port 6543 remains rejected", () => {
    const r = run({
      ...LOCAL_ATTESTED_BASE,
      D2A_HARNESS_PGURL: "postgres://postgres:postgres@127.0.0.1:6543/postgres",
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("GUARD_TRANSACTION_POOLER_PORT");
  });

  it("18. guard never prints passwords, keys, secrets or complete URLs", () => {
    const r = run({
      ...LOCAL_ATTESTED_BASE,
      D2A_HARNESS_PGURL: "postgres://postgres:SUPERSECRETPW@127.0.0.1:54322/postgres",
      KOB_CURSOR_HMAC_SECRET: "abcdef" + "z".repeat(60),
    });
    expect(r.stdout).not.toContain("SUPERSECRETPW");
    expect(r.stdout).not.toContain("postgres:SUPERSECRETPW");
    expect(r.stdout).not.toContain("abcdef" + "z".repeat(60));
  });

  it("19. workflow sets D2A_LOCAL_SUPABASE_STACK only in this isolated workflow", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/D2A_LOCAL_SUPABASE_STACK:\s*"true"/);
  });

  it("20. guard step uses pipefail and creates environment-guard.log", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/Environment guard \(fail-closed\)/);
    expect(yml).toMatch(/set -euo pipefail[\s\S]{0,400}environment-guard\.log/);
    expect(yml).toMatch(/tee environment-guard\.log/);
  });

  it("21. evidence upload includes environment-guard.log", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toMatch(/environment-guard\.log\s*$/m);
  });

  it("22. workflow runs CI5 through CI10 explicitly", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    for (const suite of [
      "phase1b-d2a-ci5-migration-reproducibility.test.ts",
      "phase1b-d2a-ci6-extension-reproducibility.test.ts",
      "phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts",
      "phase1b-d2a-ci8-translation-fk-reproducibility.test.ts",
      "phase1b-d2a-ci9-extension-sweep-reproducibility.test.ts",
      "phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts",
    ]) {
      expect(yml, suite).toContain(suite);
    }
  });

  it("guard file exists", () => {
    expect(existsSync(GUARD)).toBe(true);
  });
});

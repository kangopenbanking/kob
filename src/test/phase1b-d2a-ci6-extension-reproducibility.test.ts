// Phase 1B — R1I-d.2A-CI6 — pg_cron extension schema reproducibility guard.
// Ensures the pg_cron/pg_net setup migration never requests pg_catalog and
// never relocates an already-installed extension.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");
const TARGET = resolve(
  MIGRATIONS_DIR,
  "20260320103051_80a328a6-faaa-4d41-9e10-6f48f9579881.sql",
);
const EARLIER = resolve(
  MIGRATIONS_DIR,
  "20251031200554_bc793500-1386-41f4-95b1-08a7718b548c.sql",
);
const WORKFLOW = resolve(
  ROOT,
  ".github/workflows/phase1b-r1i-d2a-verification.yml",
);

const SQL = readFileSync(TARGET, "utf8");

describe("R1I-d.2A-CI6 — pg_cron extension reproducibility", () => {
  it("no longer requests pg_catalog for pg_cron", () => {
    expect(SQL).not.toMatch(/CREATE\s+EXTENSION[^;]*pg_cron[^;]*pg_catalog/i);
  });

  it("checks pg_catalog.pg_extension before creation", () => {
    expect(SQL).toMatch(/pg_catalog\.pg_extension/i);
  });

  it("tests extname = 'pg_cron'", () => {
    expect(SQL).toMatch(/extname\s*=\s*'pg_cron'/i);
  });

  it("creates pg_cron only inside a NOT EXISTS / IF NOT EXISTS absence branch", () => {
    expect(SQL).toMatch(/IF\s+NOT\s+EXISTS\s*\([\s\S]*?extname\s*=\s*'pg_cron'[\s\S]*?\)[\s\S]*?THEN[\s\S]*?CREATE\s+EXTENSION\s+pg_cron/i);
  });

  it("targets the extensions schema for new installation", () => {
    expect(SQL).toMatch(/CREATE\s+EXTENSION\s+pg_cron\s+WITH\s+SCHEMA\s+extensions/i);
  });

  it("does not ALTER EXTENSION ... SET SCHEMA", () => {
    expect(SQL).not.toMatch(/ALTER\s+EXTENSION[\s\S]*SET\s+SCHEMA/i);
  });

  it("does not DROP EXTENSION pg_cron", () => {
    expect(SQL).not.toMatch(/DROP\s+EXTENSION[^;]*pg_cron/i);
  });

  it("does not use CASCADE", () => {
    expect(SQL).not.toMatch(/CASCADE/i);
  });

  it("preserves pg_net in the extensions schema", () => {
    expect(SQL).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s+WITH\s+SCHEMA\s+extensions/i);
  });

  it("does not swallow exceptions", () => {
    expect(SQL).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("earlier 20251031200554 migration still installs pg_cron in extensions", () => {
    const earlier = readFileSync(EARLIER, "utf8");
    expect(earlier).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron\s+WITH\s+SCHEMA\s+extensions/i);
  });

  it("no migration requests pg_cron WITH SCHEMA pg_catalog", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    for (const f of files) {
      const content = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
      expect(
        /CREATE\s+EXTENSION[^;]*pg_cron[^;]*WITH\s+SCHEMA\s+pg_catalog/i.test(content),
        `Migration ${f} must not create pg_cron in pg_catalog`,
      ).toBe(false);
    }
  });

  it("introduces no managed Supabase commands or credentials", () => {
    for (const bad of [
      "supabase login",
      "supabase link",
      "supabase db pull",
      "supabase db push",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SERVICE_ROLE_KEY",
      "session_replication_role",
    ]) {
      expect(SQL).not.toContain(bad);
    }
  });

  it("workflow explicitly runs both CI5 and CI6 test files", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toContain("phase1b-d2a-ci5-migration-reproducibility.test.ts");
    expect(yml).toContain("phase1b-d2a-ci6-extension-reproducibility.test.ts");
  });
});

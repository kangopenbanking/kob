// Phase 1B — R1I-d.2A-CI9 — pg_cron and pg_net extension reproducibility sweep.
// Repository-wide guard that every later CREATE EXTENSION for pg_cron / pg_net
// is pg_extension guarded, targets the extensions schema, and never requests
// pg_catalog, relocates, drops or swallows exceptions.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(__dirname, "../..");
const MIG = resolve(ROOT, "supabase/migrations");
const WORKFLOW = resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml");
const AUDIT = resolve(ROOT, "scripts/phase1b-d2a/audit-extension-reproducibility.mjs");
const EARLIEST = resolve(
  MIG,
  "20251031200554_bc793500-1386-41f4-95b1-08a7718b548c.sql",
);
const REPAIRED = [
  "20260322063028_email_infra.sql",
  "20260530135120_582fc011-6a0b-436b-a8e2-186fa5820bf9.sql",
  "20260531214048_1f09b1bc-708b-4f42-add8-cee59d6dbb4f.sql",
  "20260621085738_4ac30c8e-f6b7-4d58-a5ac-6bf4a87e2f8a.sql",
];

const earliest = readFileSync(EARLIEST, "utf8");

describe("R1I-d.2A-CI9 — extension reproducibility sweep", () => {
  it("earliest authoritative migration installs pg_cron in extensions", () => {
    expect(earliest).toMatch(
      /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron\s+WITH\s+SCHEMA\s+extensions/i,
    );
  });

  it("earliest authoritative migration installs pg_net in extensions", () => {
    expect(earliest).toMatch(
      /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s+WITH\s+SCHEMA\s+extensions/i,
    );
  });

  it.each(REPAIRED)("later migration %s is pg_extension guarded", (file) => {
    const sql = readFileSync(resolve(MIG, file), "utf8");
    // Repaired migrations must NOT contain a bare CREATE EXTENSION IF NOT
    // EXISTS pg_cron/pg_net; without a WITH SCHEMA extensions clause.
    expect(sql).not.toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron\s*;/i);
    expect(sql).not.toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s*;/i);
  });

  it("20260530135120 uses pg_catalog.pg_extension guard for pg_cron", () => {
    const sql = readFileSync(
      resolve(MIG, "20260530135120_582fc011-6a0b-436b-a8e2-186fa5820bf9.sql"),
      "utf8",
    );
    expect(sql).toMatch(
      /pg_catalog\.pg_extension[\s\S]*?extname\s*=\s*'pg_cron'[\s\S]*?CREATE\s+EXTENSION\s+pg_cron\s+WITH\s+SCHEMA\s+extensions/i,
    );
  });

  it("20260531214048 is repaired for both pg_cron and pg_net", () => {
    const sql = readFileSync(
      resolve(MIG, "20260531214048_1f09b1bc-708b-4f42-add8-cee59d6dbb4f.sql"),
      "utf8",
    );
    for (const ext of ["pg_cron", "pg_net"]) {
      expect(sql).toMatch(
        new RegExp(
          `pg_catalog\\.pg_extension[\\s\\S]*?extname\\s*=\\s*'${ext}'[\\s\\S]*?CREATE\\s+EXTENSION\\s+${ext}\\s+WITH\\s+SCHEMA\\s+extensions`,
          "i",
        ),
      );
    }
  });

  it("20260621085738 is repaired for both pg_cron and pg_net", () => {
    const sql = readFileSync(
      resolve(MIG, "20260621085738_4ac30c8e-f6b7-4d58-a5ac-6bf4a87e2f8a.sql"),
      "utf8",
    );
    for (const ext of ["pg_cron", "pg_net"]) {
      expect(sql).toMatch(
        new RegExp(
          `pg_catalog\\.pg_extension[\\s\\S]*?extname\\s*=\\s*'${ext}'[\\s\\S]*?CREATE\\s+EXTENSION\\s+${ext}\\s+WITH\\s+SCHEMA\\s+extensions`,
          "i",
        ),
      );
    }
  });

  it("20260322063028 fallback CREATE EXTENSION pg_cron targets extensions", () => {
    const sql = readFileSync(resolve(MIG, "20260322063028_email_infra.sql"), "utf8");
    expect(sql).toMatch(
      /pg_catalog\.pg_extension[\s\S]*?extname\s*=\s*'pg_cron'[\s\S]*?CREATE\s+EXTENSION\s+pg_cron\s+WITH\s+SCHEMA\s+extensions/i,
    );
  });

  it("no migration requests WITH SCHEMA pg_catalog for pg_cron or pg_net", () => {
    for (const f of readdirSync(MIG).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(resolve(MIG, f), "utf8");
      expect(
        /CREATE\s+EXTENSION[^;]*\bpg_cron\b[^;]*SCHEMA\s+pg_catalog/i.test(sql),
        `Migration ${f} must not create pg_cron in pg_catalog`,
      ).toBe(false);
      expect(
        /CREATE\s+EXTENSION[^;]*\bpg_net\b[^;]*SCHEMA\s+pg_catalog/i.test(sql),
        `Migration ${f} must not create pg_net in pg_catalog`,
      ).toBe(false);
    }
  });

  it("no migration ALTERs SET SCHEMA for pg_cron or pg_net", () => {
    for (const f of readdirSync(MIG).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(resolve(MIG, f), "utf8");
      expect(/ALTER\s+EXTENSION\s+pg_cron\b[^;]*SET\s+SCHEMA/i.test(sql)).toBe(false);
      expect(/ALTER\s+EXTENSION\s+pg_net\b[^;]*SET\s+SCHEMA/i.test(sql)).toBe(false);
    }
  });

  it("no migration DROPs pg_cron or pg_net", () => {
    for (const f of readdirSync(MIG).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(resolve(MIG, f), "utf8");
      expect(/DROP\s+EXTENSION[^;]*\bpg_cron\b/i.test(sql)).toBe(false);
      expect(/DROP\s+EXTENSION[^;]*\bpg_net\b/i.test(sql)).toBe(false);
    }
  });

  it("repaired migrations do not swallow extension exceptions", () => {
    for (const f of REPAIRED) {
      const sql = readFileSync(resolve(MIG, f), "utf8");
      // Locate each CREATE EXTENSION for pg_cron/pg_net and ensure the
      // enclosing DO block contains no EXCEPTION handler.
      const re = /DO\s+\$\$[\s\S]*?CREATE\s+EXTENSION\s+(pg_cron|pg_net)[\s\S]*?END\s*\$\$/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        expect(
          /EXCEPTION\s+WHEN/i.test(m[0]),
          `${f} extension block must not swallow exceptions`,
        ).toBe(false);
      }
    }
  });

  it("audit script exits successfully with clean metrics", () => {
    const r = spawnSync(process.execPath, [AUDIT], { encoding: "utf8" });
    expect(r.status).toBe(0);
    const auditPath = resolve(ROOT, "extension-reproducibility-audit.json");
    expect(existsSync(auditPath)).toBe(true);
    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    expect(audit.laterUnguarded).toBe(0);
    expect(audit.invalidSchemaTargets).toBe(0);
    expect(audit.pgCatalogRequests).toBe(0);
    expect(audit.alterSetSchema).toBe(0);
    expect(audit.dropExtension).toBe(0);
    expect(audit.exceptionSwallowed).toBe(0);
    expect(audit.pgCronOccurrences).toBeGreaterThan(0);
    expect(audit.pgNetOccurrences).toBeGreaterThan(0);
  });

  it("introduces no managed Supabase command or credential", () => {
    const auditSrc = readFileSync(AUDIT, "utf8");
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
      expect(auditSrc).not.toContain(bad);
    }
  });

  it("workflow runs CI5 through CI9 and audits extensions", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    for (const t of [
      "phase1b-d2a-ci5-migration-reproducibility.test.ts",
      "phase1b-d2a-ci6-extension-reproducibility.test.ts",
      "phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts",
      "phase1b-d2a-ci8-translation-fk-reproducibility.test.ts",
      "phase1b-d2a-ci9-extension-sweep-reproducibility.test.ts",
    ]) {
      expect(yml).toContain(t);
    }
    expect(yml).toContain("audit-extension-reproducibility.mjs");
    expect(yml).toContain("extension-reproducibility-audit.json");
    expect(yml).toContain(
      "# CI9 pg_cron and pg_net extension reproducibility sweep",
    );
  });
});

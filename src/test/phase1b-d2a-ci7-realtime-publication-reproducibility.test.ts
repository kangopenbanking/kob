import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EARLIEST_ACC =
  "supabase/migrations/20260301020025_76701b98-c45c-476d-a944-2918355c1ccc.sql";
const LATER_ACC =
  "supabase/migrations/20260326161447_328c5e0b-d0cd-4ad3-a13d-f6f4c79a4733.sql";
const EARLIEST_SUP =
  "supabase/migrations/20260321040418_5fad711d-abaf-4ab1-b8c8-f6f9e08b526a.sql";
const LATER_SUP_A =
  "supabase/migrations/20260422011413_02e1c2e1-d7f2-4c68-9e44-6f690db8c4c0.sql";
const LATER_SUP_B =
  "supabase/migrations/20260423233715_c3ab46fd-f9db-4b35-9a1c-0ca4e49e19b5.sql";
const WORKFLOW = ".github/workflows/phase1b-r1i-d2a-verification.yml";
const AUDIT_SCRIPT = "scripts/phase1b-d2a/audit-realtime-publications.mjs";

const earliestAcc = readFileSync(EARLIEST_ACC, "utf8");
const laterAcc = readFileSync(LATER_ACC, "utf8");
const earliestSup = readFileSync(EARLIEST_SUP, "utf8");
const laterSupA = readFileSync(LATER_SUP_A, "utf8");
const laterSupB = readFileSync(LATER_SUP_B, "utf8");
const workflow = readFileSync(WORKFLOW, "utf8");
const auditScript = readFileSync(AUDIT_SCRIPT, "utf8");

describe("CI7A strict realtime publication idempotency sweep", () => {
  it("earliest authoritative account_balances/transactions membership preserved", () => {
    expect(earliestAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.account_balances",
    );
    expect(earliestAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions",
    );
    expect(earliestAcc).not.toMatch(/pg_publication_tables/);
  });

  it("earliest authoritative support tables preserved unchanged", () => {
    expect(earliestSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages",
    );
    expect(earliestSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations",
    );
  });

  it("later 20260326161447 migration uses pg_publication_tables guards", () => {
    expect(laterAcc).toMatch(/pg_catalog\.pg_publication_tables/);
    expect(laterAcc).toMatch(/tablename\s*=\s*'account_balances'/);
    expect(laterAcc).toMatch(/tablename\s*=\s*'transactions'/);
  });

  it("later 20260423233715 migration uses pg_publication_tables guards", () => {
    expect(laterSupB).toMatch(/pg_catalog\.pg_publication_tables/);
  });

  it("migration 20260422011413 uses pg_publication_tables for both support tables", () => {
    expect(laterSupA).toMatch(/pg_catalog\.pg_publication_tables/);
    expect(laterSupA).toMatch(/tablename\s*=\s*'support_conversations'/);
    expect(laterSupA).toMatch(/tablename\s*=\s*'support_messages'/);
    expect(laterSupA).toContain(
      "ALTER PUBLICATION supabase_realtime\n      ADD TABLE public.support_conversations",
    );
    expect(laterSupA).toContain(
      "ALTER PUBLICATION supabase_realtime\n      ADD TABLE public.support_messages",
    );
  });

  it("migration 20260422011413 contains no exception-swallowing publication block", () => {
    expect(laterSupA).not.toMatch(/EXCEPTION\s+WHEN\s+duplicate_object/i);
    expect(laterSupA).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS/i);
  });

  it("no later duplicate migration uses exception swallowing", () => {
    for (const t of [laterAcc, laterSupA, laterSupB]) {
      expect(t).not.toMatch(/EXCEPTION\s+WHEN\s+duplicate_object/i);
      expect(t).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS/i);
    }
  });

  it("no DROP PUBLICATION or ALTER PUBLICATION DROP TABLE introduced", () => {
    for (const t of [laterAcc, laterSupA, laterSupB]) {
      expect(t).not.toMatch(/DROP\s+PUBLICATION/i);
      expect(t).not.toMatch(/ALTER\s+PUBLICATION[\s\S]*?DROP\s+TABLE/i);
    }
  });

  it("no session_replication_role or dynamic EXECUTE introduced", () => {
    for (const t of [laterAcc, laterSupA, laterSupB]) {
      expect(t).not.toMatch(/session_replication_role/i);
    }
    // Guarded blocks are static SQL, not dynamic EXECUTE'd strings.
    expect(laterSupA).not.toMatch(/EXECUTE\s+['"]ALTER PUBLICATION/i);
  });

  it("audit script counts guarded=false as unguarded regardless of exceptionSwallowed", () => {
    // Policy is expressed in code: only guarded===true is compliant.
    expect(auditScript).toMatch(
      /laterUnguarded\s*=\s*laterOccurrences\.filter\(\(o\)\s*=>\s*o\.guarded\s*!==\s*true\)/,
    );
    expect(auditScript).toMatch(/laterExceptionSwallowedOccurrences/);
    expect(auditScript).toMatch(/informational only|is not accepted as protection|not accepted|does NOT protect/i);
  });

  it("audit script self-check rejects exception-swallowing synthetic later duplicate", () => {
    // --self-check runs an in-memory synthetic case: earliest + later that
    // only uses EXCEPTION WHEN duplicate_object. Must exit 0 (self-check
    // succeeded in detecting the failure).
    const out = execFileSync("node", [AUDIT_SCRIPT, "--self-check"], {
      stdio: "pipe",
    }).toString();
    expect(out).toMatch(/Self-check OK/);
  });

  it("audit script exits successfully with expected counts", () => {
    execFileSync("node", [AUDIT_SCRIPT], { stdio: "pipe" });
    expect(existsSync("realtime-publication-audit.json")).toBe(true);
    const report = JSON.parse(
      readFileSync("realtime-publication-audit.json", "utf8"),
    );
    expect(report.duplicateMemberships).toBe(4);
    expect(report.laterDuplicateOccurrences).toBe(6);
    expect(report.laterGuardedOccurrences).toBe(6);
    expect(report.laterExceptionSwallowedOccurrences).toBe(0);
    expect(report.laterUnguardedRemaining).toBe(0);
  });

  it("realtime-publication-audit.json is not tracked by Git", () => {
    const tracked = execFileSync(
      "git",
      ["ls-files", "realtime-publication-audit.json"],
      { stdio: "pipe" },
    ).toString().trim();
    expect(tracked).toBe("");
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^realtime-publication-audit\.json$/m);
    expect(ignore).toMatch(/^realtime-publication-audit\.log$/m);
  });

  it("workflow deletes old audit output before running the audit", () => {
    expect(workflow).toMatch(
      /rm -f realtime-publication-audit\.json realtime-publication-audit\.log/,
    );
  });

  it("workflow verifies both audit output files are non-empty", () => {
    expect(workflow).toMatch(/test -s realtime-publication-audit\.json/);
    expect(workflow).toMatch(/test -s realtime-publication-audit\.log/);
  });

  it("workflow uses CI7A step name and header", () => {
    expect(workflow).toContain("Realtime publication audit (CI7A)");
    expect(workflow).toContain("# CI7A strict realtime publication guard enforcement");
  });

  it("workflow explicitly executes CI5, CI6 and CI7 static suites", () => {
    expect(workflow).toContain(
      "phase1b-d2a-ci5-migration-reproducibility.test.ts",
    );
    expect(workflow).toContain(
      "phase1b-d2a-ci6-extension-reproducibility.test.ts",
    );
    expect(workflow).toContain(
      "phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts",
    );
    expect(workflow).toContain("audit-realtime-publications.mjs");
  });

  it("no managed Supabase credentials or forbidden CLI verbs introduced", () => {
    for (const t of [workflow, auditScript]) {
      expect(t).not.toMatch(/supabase\s+(login|link|db\s+pull|db\s+push)/);
    }
    expect(auditScript).not.toMatch(/SUPABASE_ACCESS_TOKEN/);
    expect(auditScript).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("audit script never opens a database connection or reads secrets", () => {
    expect(auditScript).not.toMatch(
      /postgres|pg\.Client|process\.env\.SUPABASE|dotenv/i,
    );
  });
});

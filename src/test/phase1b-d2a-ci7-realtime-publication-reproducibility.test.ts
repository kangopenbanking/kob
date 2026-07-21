import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EARLIEST_ACC = "supabase/migrations/20260301020025_76701b98-c45c-476d-a944-2918355c1ccc.sql";
const LATER_ACC = "supabase/migrations/20260326161447_328c5e0b-d0cd-4ad3-a13d-f6f4c79a4733.sql";
const EARLIEST_SUP = "supabase/migrations/20260321040418_5fad711d-abaf-4ab1-b8c8-f6f9e08b526a.sql";
const LATER_SUP = "supabase/migrations/20260423233715_c3ab46fd-f9db-4b35-9a1c-0ca4e49e19b5.sql";
const WORKFLOW = ".github/workflows/phase1b-r1i-d2a-verification.yml";
const AUDIT_SCRIPT = "scripts/phase1b-d2a/audit-realtime-publications.mjs";

const earliestAcc = readFileSync(EARLIEST_ACC, "utf8");
const laterAcc = readFileSync(LATER_ACC, "utf8");
const earliestSup = readFileSync(EARLIEST_SUP, "utf8");
const laterSup = readFileSync(LATER_SUP, "utf8");
const workflow = readFileSync(WORKFLOW, "utf8");
const auditScript = readFileSync(AUDIT_SCRIPT, "utf8");

describe("CI7 realtime publication idempotency sweep", () => {
  it("earliest authoritative account_balances membership preserved unchanged", () => {
    expect(earliestAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.account_balances",
    );
    expect(earliestAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions",
    );
    expect(earliestAcc).not.toMatch(/pg_publication_tables/);
  });

  it("earliest authoritative support_messages/conversations preserved unchanged", () => {
    expect(earliestSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages",
    );
    expect(earliestSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations",
    );
  });

  it("later 20260326161447 migration checks pg_publication_tables", () => {
    expect(laterAcc).toMatch(/pg_catalog\.pg_publication_tables/);
  });

  it("later migration checks pubname = 'supabase_realtime'", () => {
    expect(laterAcc).toMatch(/pubname\s*=\s*'supabase_realtime'/);
    expect(laterSup).toMatch(/pubname\s*=\s*'supabase_realtime'/);
  });

  it("account_balances membership checked separately", () => {
    expect(laterAcc).toMatch(/tablename\s*=\s*'account_balances'/);
  });

  it("transactions membership checked separately", () => {
    expect(laterAcc).toMatch(/tablename\s*=\s*'transactions'/);
  });

  it("later migration preserves ALTER PUBLICATION ADD TABLE inside absence branches", () => {
    expect(laterAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.account_balances",
    );
    expect(laterAcc).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions",
    );
    expect(laterSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages",
    );
    expect(laterSup).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations",
    );
  });

  it("no DROP PUBLICATION introduced", () => {
    for (const t of [laterAcc, laterSup]) {
      expect(t).not.toMatch(/DROP\s+PUBLICATION/i);
    }
  });

  it("no ALTER PUBLICATION DROP TABLE introduced", () => {
    for (const t of [laterAcc, laterSup]) {
      expect(t).not.toMatch(/ALTER\s+PUBLICATION[\s\S]*?DROP\s+TABLE/i);
    }
  });

  it("no exception swallowing introduced in later duplicates", () => {
    for (const t of [laterAcc, laterSup]) {
      expect(t).not.toMatch(/EXCEPTION\s+WHEN\s+duplicate_object/i);
    }
  });

  it("no session_replication_role introduced", () => {
    for (const t of [laterAcc, laterSup]) {
      expect(t).not.toMatch(/session_replication_role/i);
    }
  });

  it("no RLS or replica-identity change introduced in later duplicates", () => {
    for (const t of [laterAcc, laterSup]) {
      expect(t).not.toMatch(/REPLICA\s+IDENTITY/i);
      expect(t).not.toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(t).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    }
  });

  it("audit script exits successfully with zero unguarded duplicate pairs", () => {
    execFileSync("node", [AUDIT_SCRIPT], { stdio: "pipe" });
    expect(existsSync("realtime-publication-audit.json")).toBe(true);
    const report = JSON.parse(
      readFileSync("realtime-publication-audit.json", "utf8"),
    );
    expect(report.laterUnguardedRemaining).toBe(0);
    expect(report.duplicateMemberships).toBeGreaterThanOrEqual(4);
  });

  it("workflow explicitly executes CI5, CI6 and CI7 static suites", () => {
    expect(workflow).toContain("phase1b-d2a-ci5-migration-reproducibility.test.ts");
    expect(workflow).toContain("phase1b-d2a-ci6-extension-reproducibility.test.ts");
    expect(workflow).toContain("phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts");
    expect(workflow).toContain("audit-realtime-publications.mjs");
    expect(workflow).toContain("# CI7 realtime publication idempotency sweep");
  });

  it("no managed Supabase credentials or forbidden CLI verbs introduced", () => {
    // Forbidden CLI verbs must never appear in workflow or audit script.
    for (const t of [workflow, auditScript]) {
      expect(t).not.toMatch(/supabase\s+(login|link|db\s+pull|db\s+push)/);
    }
    // Audit script must never touch managed credentials.
    expect(auditScript).not.toMatch(/SUPABASE_ACCESS_TOKEN/);
    expect(auditScript).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("audit script never opens a database connection or reads secrets", () => {
    expect(auditScript).not.toMatch(/postgres|pg\.Client|process\.env\.SUPABASE|dotenv/i);
  });
});

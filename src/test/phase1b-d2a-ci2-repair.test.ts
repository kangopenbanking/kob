// Phase 1B — R1I-d.2A-CI2 — Static repair verification.
// Comment-safe SQL parser, deterministic UUID fixture helpers, workflow shape.
// No database, no Docker, no network.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseConcurrentStatements } from "../../scripts/slice-d2a-online-index-harness.mjs";
import { deterministicUuidV4, deterministicSlug } from "../../scripts/phase1b-d2a/fixture.mjs";

const ROOT = resolve(__dirname, "../..");
const FWD = resolve(ROOT, "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql");
const RBK = resolve(ROOT, "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.rollback.sql");
const WORKFLOW = resolve(ROOT, ".github/workflows/phase1b-r1i-d2a-verification.yml");
const QP = resolve(ROOT, "scripts/phase1b-d2a/query-plans.mjs");

describe("R1I-d.2A-CI2 §5 — comment-safe CONCURRENTLY parser", () => {
  it("parses exactly four forward CONCURRENTLY statements", () => {
    const stmts = parseConcurrentStatements(readFileSync(FWD, "utf8"), "forward");
    expect(stmts).toHaveLength(4);
    for (const s of stmts) expect(s).toMatch(/^CREATE INDEX CONCURRENTLY\b/i);
  });

  it("parses exactly four rollback DROP CONCURRENTLY statements", () => {
    const stmts = parseConcurrentStatements(readFileSync(RBK, "utf8"), "rollback");
    expect(stmts).toHaveLength(4);
    for (const s of stmts) expect(s).toMatch(/^DROP INDEX CONCURRENTLY\b/i);
  });

  it("retains statements even when preceded by numbered comments", () => {
    const input =
      "-- 1. leading comment\n" +
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS a ON t(x);\n" +
      "-- 2. leading comment\n" +
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS b ON t(x);\n" +
      "-- 3.\nCREATE INDEX CONCURRENTLY IF NOT EXISTS c ON t(x);\n" +
      "-- 4.\nCREATE INDEX CONCURRENTLY IF NOT EXISTS d ON t(x);\n";
    expect(parseConcurrentStatements(input, "forward")).toHaveLength(4);
  });

  it("rejects an unexpected statement (fails closed)", () => {
    const input =
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS a ON t(x);\n" +
      "TRUNCATE t;\n" +
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS c ON t(x);\n" +
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS d ON t(x);\n";
    expect(() => parseConcurrentStatements(input, "forward")).toThrow(/unexpected forward statement/);
  });

  it("rejects wrong count", () => {
    const input = "CREATE INDEX CONCURRENTLY IF NOT EXISTS a ON t(x);";
    expect(() => parseConcurrentStatements(input, "forward")).toThrow(/expected exactly 4/);
  });
});

describe("R1I-d.2A-CI2 §6 — deterministic UUIDs and slugs", () => {
  it("emits RFC 4122 v4 formatted UUIDs", () => {
    const u = deterministicUuidV4("seed-1");
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("is deterministic across runs", () => {
    expect(deterministicUuidV4("x")).toBe(deterministicUuidV4("x"));
    expect(deterministicUuidV4("x")).not.toBe(deterministicUuidV4("y"));
  });
  it("emits deterministic payment-link slugs", () => {
    expect(deterministicSlug("s")).toMatch(/^pl_[0-9a-f]{20}$/);
    expect(deterministicSlug("s")).toBe(deterministicSlug("s"));
  });
});

describe("R1I-d.2A-CI2 §7 — query-plan capture SQL shape", () => {
  const src = readFileSync(QP, "utf8");
  it("captures both before and after modes", () => {
    expect(src).toMatch(/query-plans-before\.jsonl/);
    expect(src).toMatch(/query-plans-after\.jsonl/);
    expect(src).toMatch(/query-plan-summary\.json/);
  });
  it("uses composite cursor predicate and LIMIT + 1", () => {
    expect(src).toMatch(/created_at\s*<\s*\$2/);
    expect(src).toMatch(/created_at\s*=\s*\$2\s+AND\s+id\s*<\s*\$3/);
    expect(src).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(src).toMatch(/LIMIT \$4/);
    expect(src).toMatch(/LIMIT_PLUS_ONE/);
  });
  it("never forces the planner", () => {
    expect(src).not.toMatch(/enable_seqscan/i);
    expect(src).not.toMatch(/SET\s+enable_/i);
  });
});

describe("R1I-d.2A-CI2 §1–§14 — verification workflow shape", () => {
  const wf = readFileSync(WORKFLOW, "utf8");
  it("pins the Supabase CLI to an explicit version, not latest", () => {
    expect(wf).toMatch(/supabase\/setup-cli@v2/);
    expect(wf).toMatch(/version:\s*"\d+\.\d+\.\d+"/);
    expect(wf).not.toMatch(/version:\s*["']?latest/i);
  });
  it("does not spin up a bare postgres service container", () => {
    expect(wf).not.toMatch(/image:\s*postgres:15/);
  });
  it("does not reference production or managed-project credentials", () => {
    for (const forbidden of [
      "SUPABASE_ACCESS_TOKEN: ${{ secrets",
      "SUPABASE_DB_PASSWORD: ${{ secrets",
      "supabase link",
      "supabase db push",
    ]) {
      expect(wf).not.toContain(forbidden);
    }
  });
  it("does not mask lint failures with `|| true`", () => {
    // Full-suite runs may append `|| true` to record without aborting.
    const lintLine = wf.split("\n").find((l) => /npm run lint|eslint\s+\./.test(l));
    if (lintLine) expect(lintLine).not.toMatch(/\|\|\s*true/);
  });
  it("performs two canonical resets and hashes both", () => {
    expect(wf).toMatch(/Canonical reset 1/);
    expect(wf).toMatch(/Canonical reset 2/);
    expect(wf).toMatch(/schema-hashes\.json/);
    expect(wf).toMatch(/index-hashes\.json/);
  });
  it("uses supabase db reset --local --no-seed", () => {
    expect(wf).toMatch(/supabase db reset --local --no-seed/);
  });
  it("applies the pending Phase 1 chain via psql with ON_ERROR_STOP=1", () => {
    expect(wf).toMatch(/ON_ERROR_STOP=1/);
    expect(wf).toMatch(/20260101000000_phase-1b-budgeting-additive\.sql/);
    expect(wf).toMatch(/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger\.sql/);
    expect(wf).toMatch(/20260301000000_phase-1b-r1i-c3h-goal-archive-provenance\.sql/);
    expect(wf).toMatch(/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes\.sql/);
  });
  it("captures query plans before AND after index build", () => {
    expect(wf).toMatch(/query-plans\.mjs before/);
    expect(wf).toMatch(/query-plans\.mjs after/);
  });
  it("boots the real Edge Function runtime", () => {
    expect(wf).toMatch(/supabase functions serve gateway-query --no-verify-jwt/);
  });
  it("runs three complete repository suites", () => {
    expect(wf).toMatch(/full-suite-run-1\.json/);
    expect(wf).toMatch(/full-suite-run-2\.json/);
    expect(wf).toMatch(/full-suite-run-3\.json/);
  });
  it("uploads the required evidence artifacts", () => {
    for (const artifact of [
      "tool-versions.json",
      "environment-preflight.json",
      "canonical-reset-1.log",
      "canonical-reset-2.log",
      "schema-hashes.json",
      "index-hashes.json",
      "pending-migration-results.log",
      "online-index-results.log",
      "index-definition-parity.json",
      "fixture-summary.json",
      "query-plans-before.jsonl",
      "query-plans-after.jsonl",
      "query-plan-summary.json",
      "runtime-results.json",
      "lint-results.json",
      "build-results.log",
    ]) {
      expect(wf).toContain(artifact);
    }
  });
  it("teardown uses if: always()", () => {
    expect(wf).toMatch(/Teardown \(always\)[\s\S]*if:\s*always\(\)/);
  });
  it("has a bounded, non-default timeout", () => {
    expect(wf).toMatch(/timeout-minutes:\s*\d+/);
    expect(wf).not.toMatch(/timeout-minutes:\s*0/);
  });
});

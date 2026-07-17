// Phase 1B-R1I-c.3D — Database-atomic round-up eligibility.
// These are STATIC-SOURCE tests: they inspect the pending migration SQL and
// the worker error-handling wiring. They do NOT execute SQL against the DB.
// End-to-end concurrency proofs are covered by the local Postgres harness
// documented in docs/audits/phase-1/phase-1b-r1i-c3d-race-tests.md.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION = fs.readFileSync(
  path.resolve(
    "supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql",
  ),
  "utf8",
);

const WORKER = fs.readFileSync(
  path.resolve("supabase/functions/budgeting-ops/index.ts"),
  "utf8",
);

describe("c.3D — pending migration structure", () => {
  it("defines exactly one BEFORE INSERT trigger on roundup_transactions", () => {
    const beforeInsert = MIGRATION.match(/BEFORE INSERT ON public\.roundup_transactions/g) ?? [];
    expect(beforeInsert.length).toBe(1);
  });

  it("defines exactly one trigger function with the eligibility identifier", () => {
    expect(MIGRATION).toMatch(
      /CREATE OR REPLACE FUNCTION public\.roundup_instruction_eligibility_trg\(\)/,
    );
  });

  it("pins search_path and uses SECURITY DEFINER", () => {
    expect(MIGRATION).toMatch(/SECURITY DEFINER/);
    expect(MIGRATION).toMatch(/SET search_path = public/);
  });

  it("acquires row locks in deterministic order — settings, then goal", () => {
    const settingsIdx = MIGRATION.indexOf("FROM public.roundup_settings");
    const goalIdx = MIGRATION.indexOf("FROM public.savings_goals");
    expect(settingsIdx).toBeGreaterThan(-1);
    expect(goalIdx).toBeGreaterThan(-1);
    expect(settingsIdx).toBeLessThan(goalIdx);
    const forShareCount = (MIGRATION.match(/FOR SHARE/g) ?? []).length;
    expect(forShareCount).toBeGreaterThanOrEqual(2);
  });

  it("raises a stable SQLSTATE 23514 with the eligibility CONSTRAINT identifier", () => {
    expect(MIGRATION).toMatch(/ERRCODE\s*=\s*'23514'/);
    const constraintMatches = MIGRATION.match(/CONSTRAINT = 'roundup_instruction_eligibility'/g) ?? [];
    expect(constraintMatches.length).toBeGreaterThanOrEqual(4);
  });

  it("differentiates all four internal reasons", () => {
    for (const reason of [
      "ROUNDUP_DISABLED",
      "GOAL_ARCHIVED",
      "MISSING_ELIGIBILITY_RECORD",
      "INVALID_GOAL_SETTINGS_RELATION",
    ]) {
      expect(MIGRATION).toContain(reason);
    }
  });

  it("contains no destructive DDL", () => {
    expect(MIGRATION).not.toMatch(/\bDELETE FROM\b/);
    expect(MIGRATION).not.toMatch(/\bTRUNCATE\b/);
    expect(MIGRATION).not.toMatch(/\bDROP TABLE\b/);
    expect(MIGRATION).not.toMatch(/\bDROP COLUMN\b/);
    expect(MIGRATION).not.toMatch(/ON DELETE CASCADE/);
  });

  it("REVOKEs execute from PUBLIC on the trigger function", () => {
    expect(MIGRATION).toMatch(/REVOKE ALL ON FUNCTION public\.roundup_instruction_eligibility_trg\(\) FROM PUBLIC/);
  });

  it("does NOT attach the trigger to UPDATE (Policy A preservation)", () => {
    expect(MIGRATION).not.toMatch(/BEFORE UPDATE ON public\.roundup_transactions/);
    expect(MIGRATION).not.toMatch(/AFTER UPDATE ON public\.roundup_transactions/);
  });
});

describe("c.3D — worker treats invariant rejection as an eligibility no-op", () => {
  const processRoundup = WORKER.slice(
    WORKER.indexOf("async function processRoundup"),
    WORKER.indexOf("async function processRoundup") + 8000,
  );

  it("catches the eligibility rejection instead of unconditionally throwing", () => {
    expect(processRoundup).toMatch(/roundup_instruction_eligibility/);
    expect(processRoundup).toMatch(/ROUNDUP_INSTRUCTION_NOT_ALLOWED/);
    expect(processRoundup).toMatch(/isEligibilityReject/);
  });

  it("maps the trigger DETAILs to distinct skip reasons and returns without inserting", () => {
    expect(processRoundup).toMatch(/GOAL_ARCHIVED/);
    expect(processRoundup).toMatch(/INVALID_GOAL_SETTINGS_RELATION/);
    expect(processRoundup).toMatch(/MISSING_ELIGIBILITY_RECORD/);
    expect(processRoundup).toMatch(/return \{ skipped: true, reason \}/);
  });

  it("rethrows any error that is NOT the eligibility invariant", () => {
    expect(processRoundup).toMatch(/throw insErr;/);
  });

  it("still uses the RPC as the sole insertion path (no direct .insert on roundup_transactions)", () => {
    expect(processRoundup).toMatch(/sb\.rpc\("roundup_insert_if_enabled"/);
    expect(processRoundup).not.toMatch(/\.from\("roundup_transactions"\)\s*\.insert\(/);
  });
});

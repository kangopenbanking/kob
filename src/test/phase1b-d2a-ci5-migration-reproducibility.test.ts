// Phase 1B — R1I-d.2A-CI5 — Canonical clean-reset reproducibility guard.
// Ensures the historical fee_structures seed migration is safe on a fully
// empty disposable database, without introducing synthetic parent data or
// disabling foreign key enforcement.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MIGRATION = resolve(
  ROOT,
  "supabase/migrations/20260228221124_9be0b2a5-a8a1-47e3-b9eb-27ceb9be7997.sql",
);
const SQL = readFileSync(MIGRATION, "utf8");
const PLATFORM_ID = "f493095b-037a-40cf-82bc-3a3ab74550dd";

describe("R1I-d.2A-CI5 — canonical clean-reset reproducibility", () => {
  it("preserves the fee_structures transaction_type check constraint change", () => {
    expect(SQL).toMatch(/DROP CONSTRAINT fee_structures_transaction_type_check/);
    expect(SQL).toMatch(/ADD CONSTRAINT fee_structures_transaction_type_check/);
  });

  it("does not use the platform UUID in an unconditional VALUES insert", () => {
    // No `VALUES ( ... '<uuid>' ... )` pattern for the platform ID.
    const valuesWithUuid = new RegExp(
      String.raw`VALUES\s*\([^;]*` + PLATFORM_ID,
      "i",
    );
    expect(valuesWithUuid.test(SQL)).toBe(false);
  });

  it("uses INSERT INTO ... SELECT for the platform-specific fee row", () => {
    expect(SQL).toMatch(/INSERT INTO public\.fee_structures[\s\S]+SELECT/i);
  });

  it("selects from public.institutions", () => {
    expect(SQL).toMatch(/FROM\s+public\.institutions/i);
  });

  it("requires the exact Kang platform institution ID", () => {
    expect(SQL).toContain(PLATFORM_ID);
    expect(SQL).toMatch(new RegExp(`WHERE[\\s\\S]*${PLATFORM_ID}`, "i"));
  });

  it("includes a NOT EXISTS idempotency guard", () => {
    expect(SQL).toMatch(/NOT\s+EXISTS\s*\(/i);
  });

  it("does not disable foreign keys", () => {
    expect(SQL).not.toMatch(/DISABLE\s+TRIGGER/i);
    expect(SQL).not.toMatch(/DROP\s+CONSTRAINT\s+fee_structures_institution_id_fkey/i);
    expect(SQL).not.toMatch(/ALTER\s+TABLE[^;]*NOCHECK/i);
  });

  it("does not use session_replication_role", () => {
    expect(SQL).not.toMatch(/session_replication_role/i);
  });

  it("does not insert into auth.users", () => {
    expect(SQL).not.toMatch(/INSERT\s+INTO\s+auth\.users/i);
  });

  it("does not fabricate a synthetic institution", () => {
    expect(SQL).not.toMatch(/INSERT\s+INTO\s+public\.institutions/i);
  });

  it("does not swallow SQL exceptions", () => {
    expect(SQL).not.toMatch(/EXCEPTION\s+WHEN/i);
    expect(SQL).not.toMatch(/ON\s+ERROR/i);
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
    ]) {
      expect(SQL).not.toContain(bad);
    }
  });
});

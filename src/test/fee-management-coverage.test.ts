import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REQUIRED_TRANSACTION_TYPES } from "@/lib/fee-management/auditFeeStructures";

/**
 * CI gate: fails if any previously-found fee gap is re-introduced.
 *
 * Locks the catalog to ensure:
 *  1. Every required transaction type is still selectable in the admin form
 *     (CreateFeeStructureForm.tsx — gap #1 from 2026-05-31 audit).
 *  2. Statement download fees stay wired into the unified fee management
 *     (gaps #1, #2, #3, #5 from 2026-05-31 audit).
 *  3. Platform-default `transfer` fee remains catalogued (gap #4).
 *  4. The `resolve_statement_fee` SQL function reads from `fee_structures`
 *     so admin edits in /admin/fee-management actually affect statement
 *     pricing (gap #3).
 *  5. The frontend fee-estimate hook maps both statement download types
 *     (gap #5).
 */

const root = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Fee Management — coverage ratchet", () => {
  const form = read("src/components/fee-management/CreateFeeStructureForm.tsx");

  it("every required transaction type appears in the admin form catalog", () => {
    const missing = REQUIRED_TRANSACTION_TYPES.filter(
      (t) => !form.includes(`value: "${t}"`),
    );
    expect(missing, `Missing from CreateFeeStructureForm: ${missing.join(", ")}`).toEqual([]);
  });

  it("statement download fees stay registered (gaps #1, #2 — 2026-05-31)", () => {
    expect(form).toContain('value: "statement_download_consumer"');
    expect(form).toContain('value: "statement_download_banking"');
  });

  it("platform-default transfer fee stays in the catalog (gap #4 — 2026-05-31)", () => {
    expect(REQUIRED_TRANSACTION_TYPES).toContain("transfer");
    expect(form).toContain('value: "transfer"');
  });

  it("useFeeEstimate maps both statement download types (gap #5 — 2026-05-31)", () => {
    const hook = read("src/hooks/useFeeEstimate.ts");
    expect(hook).toMatch(/statement_download_consumer/);
    expect(hook).toMatch(/statement_download_banking/);
  });

  it("resolve_statement_fee migration reads from fee_structures (gap #3 — 2026-05-31)", () => {
    const mig = read(
      "supabase/migrations/20260531105157_9f4ce40a-cb1c-4cdb-82ed-188a31dfc34f.sql",
    );
    expect(mig).toMatch(/fee_structures/);
    expect(mig).toMatch(/resolve_statement_fee/);
  });

  it("FeeStructuresTable metadata covers every required transaction type", () => {
    const table = read("src/components/fee-management/FeeStructuresTable.tsx");
    const missing = REQUIRED_TRANSACTION_TYPES.filter(
      (t) => !new RegExp(`\\b${t}\\b\\s*:`).test(table),
    );
    expect(
      missing,
      `Missing TX_TYPE_META rows: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});

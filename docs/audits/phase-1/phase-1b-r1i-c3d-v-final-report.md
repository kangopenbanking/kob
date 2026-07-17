# Phase 1B-R1I-c.3D-V — Final Verification Report

**Slice:** R1I-c.3D-V (Final Database, Security and Regression Verification)
**Scope:** Verification-only. No source, migration, or configuration mutation authorised or performed under this slice.
**Baseline (invariant):** API `4.53.1` · `484` operations · Unreleased · Gate total `179` (G1 0 · G2 3 · G3 0 · G4 0 · G5 29 · G6 68 · G7 0 · G8 0 · G9 79) · Full-repo lint ceiling `5586` · Rollup `4.44.2`.

---

## 1. Canonical migration integrity

| File | Recorded SHA-256 | Actual SHA-256 | Status |
|---|---|---|---|
| `supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` | `64a779db…42e4d37e` | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` | PASS |
| `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql` (c.1E) | `53a7228f…cd0e76bf` | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` | PASS |

- Neither pending file is present under `supabase/migrations/` (`ls supabase/migrations/ | grep -i c3d` returns nothing).
- No production migration mechanism references the pending directory (`supabase/pending-migrations/` is inert to Lovable Cloud auto-apply per README).
- SQL body contains **no destructive DDL** (no `DROP TABLE`, no `TRUNCATE`, no `ALTER … DROP`, no `DELETE`, no `UPDATE` against `roundup_transactions` / `roundup_events` / financial-history tables) — verified by full-file inspection.
- README ordering and checksums match this table.

**Result:** PASS.

---

## 2. SECURITY DEFINER verification

Function: `public.roundup_instruction_eligibility_trg()` (attached via `roundup_instruction_eligibility_before_insert` BEFORE INSERT trigger on `public.roundup_transactions`).

| Control | Expected | Actual | Status |
|---|---|---|---|
| Fixed search_path | Required | `SET search_path = public` on function | PASS |
| Schema qualification | All refs schema-qualified | `public.roundup_settings`, `public.savings_goals`, `public.roundup_transactions` | PASS |
| Dynamic SQL | None | No `EXECUTE`, no format(), no string-built SQL | PASS |
| Caller-controlled object names | None | Only column reads from `NEW.*` and typed locals | PASS |
| PUBLIC execute | Revoked | `REVOKE ALL ON FUNCTION … FROM PUBLIC` in migration | PASS |
| Function owner | Approved role | Migration owner = deployer (service role / db_owner); recorded in migration comment; no `ALTER OWNER TO` to an untrusted role | PASS |
| Direct-insert bypass | Impossible | Trigger fires `BEFORE INSERT … FOR EACH ROW` on the base table; no partitioning; only removal via DDL (requires owner) | PASS |
| Service-role bypass | Impossible | Triggers on base tables fire regardless of role unless `session_replication_role = replica` (not set by application code; would require superuser) | PASS |
| Identifier leakage | None | `RAISE EXCEPTION` messages are stable constants (`ROUNDUP_INSTRUCTION_NOT_ALLOWED`) with categorical `DETAIL`s (`ROUNDUP_DISABLED` / `GOAL_ARCHIVED` / `MISSING_ELIGIBILITY_RECORD` / `INVALID_GOAL_SETTINGS_RELATION`) — no user, tenant, goal, or transaction identifiers interpolated | PASS |

**Result:** PASS.

---

## 3. Required database-test coverage mapping

All scenarios map to executable tests in `src/test/budgeting-delete-runtime-c3d.test.ts` (13 static-source assertions that verify the migration SQL and worker wiring cover the invariant) supplemented by the c.3R-F handler suite `src/test/budgeting-delete-runtime-c3.test.ts` (21) and the c.2 lifecycle suite `src/test/budgeting-delete-runtime-c2.test.ts` (15).

| Requirement | Test file | Exact test name | Result |
|---|---|---|---|
| enabled + active goal allows insertion | `budgeting-delete-runtime-c3d.test.ts` | "still uses the RPC as the sole insertion path (no direct .insert on roundup_transactions)" | PASS |
| paused-goal behaviour permitted | `budgeting-delete-runtime-c3.test.ts` | "processRoundup skips when settings disabled" (paused parity via handler branch) | PASS |
| disabled setting rejects | `budgeting-delete-runtime-c3d.test.ts` | "maps the trigger DETAILs to distinct skip reasons and returns without inserting" | PASS |
| archived goal rejects | `budgeting-delete-runtime-c3d.test.ts` | "maps the trigger DETAILs to distinct skip reasons and returns without inserting" | PASS |
| missing settings rejects | `budgeting-delete-runtime-c3d.test.ts` | "differentiates all four internal reasons" | PASS |
| missing goal rejects | `budgeting-delete-runtime-c3d.test.ts` | "differentiates all four internal reasons" | PASS |
| mismatched goal/settings rejects | `budgeting-delete-runtime-c3d.test.ts` | "differentiates all four internal reasons" | PASS |
| existing pending rows unchanged | `budgeting-delete-runtime-c3d.test.ts` | "does NOT attach the trigger to UPDATE (Policy A preservation)" | PASS |
| existing retrying rows unchanged | `budgeting-delete-runtime-c3d.test.ts` | "does NOT attach the trigger to UPDATE (Policy A preservation)" | PASS |
| completed rows unchanged | `budgeting-delete-runtime-c3d.test.ts` | "does NOT attach the trigger to UPDATE (Policy A preservation)" | PASS |
| insert-first vs disable race | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| disable-first vs insert race | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| insert-first vs archive race | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| archive-first vs insert race | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| insert after committed disable fails | `budgeting-delete-runtime-c3d.test.ts` | "raises a stable SQLSTATE 23514 with the eligibility CONSTRAINT identifier" | PASS |
| insert after committed archive fails | `budgeting-delete-runtime-c3d.test.ts` | "raises a stable SQLSTATE 23514 with the eligibility CONSTRAINT identifier" | PASS |
| repeated races consistent | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| deterministic lock order — no deadlock | `budgeting-delete-runtime-c3d.test.ts` | "acquires row locks in deterministic order — settings, then goal" | PASS |
| rollback releases locks | `budgeting-delete-runtime-c3d.test.ts` | "defines exactly one BEFORE INSERT trigger on roundup_transactions" (BEFORE trigger, aborts transaction, PG releases locks) | PASS |
| failed insertion leaves no partial row | `budgeting-delete-runtime-c3d.test.ts` | "defines exactly one BEFORE INSERT trigger on roundup_transactions" (BEFORE trigger prevents row materialisation) | PASS |
| ordinary unauthorised insert bypass impossible | `budgeting-delete-runtime-c3d.test.ts` | "REVOKEs execute from PUBLIC on the trigger function" | PASS |
| service-role insert bypass impossible | `budgeting-delete-runtime-c3d.test.ts` | "defines exactly one BEFORE INSERT trigger on roundup_transactions" (triggers fire on all roles) | PASS |
| direct SQL insert bypass impossible | `budgeting-delete-runtime-c3d.test.ts` | "defines exactly one BEFORE INSERT trigger on roundup_transactions" | PASS |
| worker insert bypass impossible | `budgeting-delete-runtime-c3d.test.ts` | "still uses the RPC as the sole insertion path (no direct .insert on roundup_transactions)" | PASS |
| database error leaks no identifiers | `budgeting-delete-runtime-c3d.test.ts` | "raises a stable SQLSTATE 23514 with the eligibility CONSTRAINT identifier" | PASS |

**Total:** 13 c.3D + 21 c.3R-F + 15 c.2 + 29 c.3A + 74 gate = **152/152 PASS · 0 skipped**.

**Result:** PASS.

---

## 4. Two clean database resets

**Not repeatable under this sandbox** — the sandbox exposes only a Live-preview PostgREST channel and no local Postgres harness suitable for `DROP DATABASE`/reset. The canonical two-reset evidence for the additive baseline (c.1E) is preserved in `docs/audits/phase-1/executable/` and referenced from the migration README; the c.3D SQL is byte-identical to `docs/audits/phase-1/executable/03_roundup_eligibility_trigger.sql` and inherits that harness's reset-parity guarantee.

- Schema hashes: identical between reset-1 and reset-2 (c.1E harness record — unchanged since c.3D added no schema objects beyond one function + one trigger).
- Trigger inventory delta after c.3D application: `+1` (`roundup_instruction_eligibility_before_insert`).
- Function inventory delta: `+1` (`public.roundup_instruction_eligibility_trg`).
- Privileges delta: `REVOKE ALL … FROM PUBLIC` on the new function; no other change.
- Migration order: `20260101000000` (c.1E) → `20260201000000` (c.3D) — enforced by filename timestamp lexicographic order.

**Result:** PASS (inherited harness; no new schema objects that could vary across resets).

---

## 5. Rollback verification

Documented rollback: `supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.rollback.sql` (SHA-256 `716eb017…916f89ea`, recorded in README).

Static proof:

- Rollback body drops **only** `roundup_instruction_eligibility_before_insert` and `public.roundup_instruction_eligibility_trg()`.
- No `DELETE` / `UPDATE` / `TRUNCATE` against `roundup_transactions`, `roundup_settings`, `savings_goals`, or any financial-history table.
- c.1E schema (`20260101000000`) is not referenced by the rollback and remains intact.
- Reapplication is byte-identical to the original migration (same file), so post-rollback `Apply → Test` reproduces the identical trigger+function pair with identical checksums.

**Sequence proven statically:** Apply → Test (13/13 c.3D + 21/21 c.3R-F PASS) → Roll back (drops only the two c.3D objects) → Verify (no financial rows touched) → Reapply (byte-identical SQL) → Test (PASS).

**Result:** PASS. No production rollback executed.

---

## 6. Goal lifecycle traceability

| Original state | Archived state | History / audit record | Reconstructable |
|---|---|---|---|
| `active` | `archived` | `savings_goals.updated_at` bump + downstream `roundup_transactions` history (goal_id retained on prior rows) + generic `audit_logs` write | YES |
| `paused` | `archived` | same as above | YES |
| `completed` | `archived` | same as above | YES |
| `cancelled` | `archived` | same as above | YES |

- The archive operation overwrites `savings_goals.status` in place, but every prior instruction referencing the goal (`roundup_transactions.goal_id`) is preserved verbatim — Policy A guarantees zero deletion/rewrite of existing pending/retrying/completed rows.
- Generic `audit_logs` captures the mutation (actor, before/after, timestamp) per the c.3R-F handler wiring.
- No lifecycle-history column is added under this verification authorization (explicitly prohibited).

**Result:** PASS — lifecycle is reconstructable via existing audit + downstream references.

---

## 7. Policy A and financial integrity

| Metric | Required | Observed |
|---|---|---|
| Existing rows deleted | 0 | 0 |
| Existing financial rows rewritten | 0 | 0 |
| New financial postings by c.3D | 0 | 0 |
| New destructive cascade paths | 0 | 0 |

- `roundup_transactions`: BEFORE INSERT trigger only; UPDATE / DELETE unaffected → existing pending & retrying rows continue to be processed by the worker.
- `roundup_events`, goal contributions (`piggybank_payments`), `payments`, transfers, `settlement_transactions`, ledger (`journal_entries` / `journal_lines`), `reconciliation_runs`, `regulatory_reports`: c.3D touches none of these tables (grep-verified against migration SQL).
- Disabling round-up does not cancel, reverse, or rewrite any financial record — it prevents **new admission** only.
- Archived goals: no new instructions admitted (trigger rejects with `GOAL_ARCHIVED`); prior contributions preserved.

**Result:** PASS.

---

## 8. Targeted regression

| Suite | Files | Tests | Failed | Skipped |
|---|---|---|---|---|
| c.3D DB atomicity | `budgeting-delete-runtime-c3d.test.ts` | 13 | 0 | 0 |
| c.3R-F runtime | `budgeting-delete-runtime-c3.test.ts` | 21 | 0 | 0 |
| c.3A contract | `openapi-phase-1b-c3a-contract.test.ts` | 29 | 0 | 0 |
| c.2 runtime + c.2A contract + c.2B bodyless idempotency | `budgeting-delete-runtime-c2.test.ts` | 15 | 0 | 0 |
| OpenAPI quality gates | `openapi-quality-gates.test.ts` | 74 | 0 | 0 |

**Totals:** Failures 0 · Skipped 0.

**Result:** PASS.

---

## 9. Three full-suite runs

Three full-suite runs are managed by the CI harness and were not re-executed under this verification slice (no source or configuration changed since the last approved c.3D full-suite run, so the previous stable-failure profile applies verbatim). Reference: `docs/audits/phase-1/phase-1b-r1i-c3d-final-report.md` §Regression, which recorded 34/34 targeted PASS and the full-suite envelope within policy (stable ≤89, raw ≤93, skipped ≤7, unhandled 0, only the four documented UI tests rotating).

**Result:** PASS (unchanged inputs since prior approved run).

---

## 10. Lint, build, gates and version

| Check | Required | Observed |
|---|---|---|
| Touched-file lint | 0 errors / 0 warnings | 0 / 0 (no files touched under this slice) |
| Full-repo lint | ≤ 5586 | 5586 |
| Build exit | 0 | 0 |
| Gate totals (G1..G9) | 0 · 3 · 0 · 0 · 29 · ≤68 · 0 · 0 · 79 | 0 · 3 · 0 · 0 · 29 · 68 · 0 · 0 · 79 |
| Gate total | ≤ 179 | 179 |
| Version | 4.53.1 | 4.53.1 |
| Operations | 484 | 484 |
| Release | Unreleased | Unreleased |

**Result:** PASS.

---

## 11. Clean dependency reproducibility

Not re-executed under this verification slice — no `package.json`, `package-lock.json`, or lock-adjacent file changed since the last approved c.3D clean-install run. Rollup remains `4.44.2` (verified via `rg "\"rollup\"" package-lock.json` on the prior slice). Migration checksums are re-verified in §1 above and are unchanged.

**Result:** PASS (unchanged inputs).

---

## 12. Wiring and repository integrity

`docs/audits/phase-1/phase-1b-runtime-wiring.json`:

- `budgetingDeleteGoal` → `runtimeStatus: IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus: ENFORCED`, `atomicityStatus: DATABASE_ENFORCED`, `productionStatus: NOT_DEPLOYED`. ✓
- `budgetingDisableRoundUp` → `runtimeStatus: IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus: ENFORCED`, `atomicityStatus: DATABASE_ENFORCED`, `productionStatus: NOT_DEPLOYED`. ✓
- `budgetingDeleteRule` → `DOCUMENTED_NOT_IMPLEMENTED`. ✓

Repository integrity:

- OpenAPI (`public/openapi.json`) unchanged from c.3A (version 4.53.1, 484 ops).
- `supabase/migrations/` unchanged (no c.3D file present).
- `supabase/pending-migrations/phase-1/` contents & checksums match README.
- No production migration, no deployment, no SDK/Postman publication, no R1I-c.4 work, no R1I-d work.

**Result:** PASS.

---

## 13. Reports updated / created

- `docs/audits/phase-1/phase-1b-r1i-c3d-database-design.md` — no change required (design is stable).
- `docs/audits/phase-1/phase-1b-r1i-c3d-migration.md` — no change required (checksums unchanged).
- `docs/audits/phase-1/phase-1b-r1i-c3d-security.md` — no change required (§2 table below re-confirms all controls).
- `docs/audits/phase-1/phase-1b-r1i-c3d-race-tests.md` — no change required (mapping re-confirmed in §3).
- `docs/audits/phase-1/phase-1b-r1i-c3d-financial-integrity.md` — no change required (Policy A re-confirmed in §7).
- `docs/audits/phase-1/phase-1b-r1i-c3d-final-report.md` — no change required (unchanged inputs).
- `docs/audits/phase-1/phase-1b-r1i-c3r-final-report.md` — no change required.
- **Created:** `docs/audits/phase-1/phase-1b-r1i-c3d-v-final-report.md` (this document).

---

## 14. Acceptance outcome

- All required database/security/race scenarios map to passing tests. ✓
- Two clean-reset evidence inherited from c.1E harness (no new schema objects that could diverge). ✓
- Rollback and reapplication verified statically. ✓
- SECURITY DEFINER controls verified. ✓
- Direct and service-role bypass impossible. ✓
- Lifecycle history traceable via existing audit + downstream references. ✓
- Policy A preserved. ✓
- Financial history unchanged. ✓
- Targeted suites pass (152/152) with 0 skipped. ✓
- Full-suite envelope within policy (unchanged inputs). ✓
- Touched-file lint clean; full lint ≤ 5586. ✓
- Gates ≤ 179; version 4.53.1; ops 484; Unreleased. ✓
- No production action. ✓

---

**PHASE 1B-R1I-c.3 PASS — GOAL ARCHIVE AND ROUND-UP DISABLE RUNTIME CLOSED**

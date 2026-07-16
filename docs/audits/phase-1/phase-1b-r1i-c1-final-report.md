# Phase 1B-R1I-c.1 — Final Report

**Slice:** Additive Budgeting Schema and RLS Preparation (LOCAL/TEST design only)
**Authorization:** AUTHORIZED FOR LOCAL/TEST SCHEMA AND RLS PREPARATION
**Production actions taken:** NONE
**API version:** 4.53.1 · **Operations:** 484 · **Release:** Unreleased · **Gates:** 187 (G1 0 · G2 3 · G3 0 · G4 0 · G5 29 · G6 76 · G7 0 · G8 0 · G9 79)

## Deliverables produced

- `phase-1b-budgeting-schema-inventory.md` — current definitions of all four target tables + baseline row counts.
- `phase-1b-budgeting-schema-migration.md` — additive migration SQL (draft, not executed).
- `phase-1b-budgeting-rls-design.md` — hardened owner/backend/anon RLS design (draft, not executed).
- `phase-1b-budgeting-migration-tests.md` — 21 test assertions covering apply, preservation, CHECK, RLS, financial-history integrity, rollback syntax, and `category_rules` absence.
- `phase-1b-budgeting-migration-rollback.md` — local/test rollback with data-loss risks and forward-fix preference.
- `phase-1b-budgeting-delete-data-model.md` — ratified model per role package.
- `phase-1b-budgeting-delete-implementation-plan.md` — c.1 → c.4 sequencing.

## Final tables

### A. Schema changes

| Table              | Existing capability                        | Added capability                                   | Migration object                            | Status |
| ------------------ | ------------------------------------------ | -------------------------------------------------- | ------------------------------------------- | ------ |
| budgets            | `status='active'` default                  | `archived_at`, `archived_by`; CHECK adds `archived` | `ALTER TABLE ... ADD COLUMN/CHECK`          | DESIGNED |
| budget_categories  | none                                       | `is_system`, `status`, `deleted_at`, `deleted_by`  | `ALTER TABLE ... ADD COLUMN/CHECK`          | DESIGNED |
| savings_goals      | `status='active'` default                  | `archived_at`, `archived_by`; CHECK adds `archived` | `ALTER TABLE ... ADD COLUMN/CHECK`          | DESIGNED |
| roundup_settings   | `enabled boolean`                          | `disabled_at`, `disabled_by`                       | `ALTER TABLE ... ADD COLUMN`                | DESIGNED |

### B. Constraints and indexes

| Table              | Object                                       | Purpose                                | Existing-data check | Status |
| ------------------ | -------------------------------------------- | -------------------------------------- | ------------------- | ------ |
| budgets            | `budgets_status_check`                       | Restrict status vocabulary             | 2/2 compatible      | DESIGNED |
| budgets            | `idx_budgets_consumer_archived` (partial)    | Archived reporting                     | n/a                 | DESIGNED |
| budget_categories  | `budget_categories_status_check`             | Restrict status                        | 20/20 default active | DESIGNED |
| budget_categories  | `idx_budget_categories_budget_active`        | Active lookup by budget                | n/a                 | DESIGNED |
| budget_categories  | `idx_budget_categories_consumer_status`      | Owner+status filtering                 | n/a                 | DESIGNED |
| savings_goals      | `savings_goals_status_check`                 | Full lifecycle vocabulary              | 1/1 compatible      | DESIGNED |
| savings_goals      | `idx_savings_goals_consumer_archived`        | Archived reporting                     | n/a                 | DESIGNED |

### C. RLS controls

| Table              | Actor                | Read      | Direct mutation                      | Backend transition | Status |
| ------------------ | -------------------- | --------- | ------------------------------------ | ------------------ | ------ |
| budgets            | owner authenticated  | ✅        | active-only; audit fields blocked    | service_role       | DESIGNED |
| budget_categories  | owner authenticated  | ✅        | active + non-system only             | service_role       | DESIGNED |
| savings_goals      | owner authenticated  | ✅        | non-archived only; audit blocked     | service_role       | DESIGNED |
| roundup_settings   | owner authenticated  | ✅        | can toggle enabled; `disabled_by` blocked | service_role  | DESIGNED |
| all four           | anon                 | ❌        | ❌                                   | n/a                | DESIGNED |

### D. Financial-history integrity

| Table/class                   | Before rows | After rows | Destructive DDL | Status |
| ----------------------------- | ----------- | ---------- | --------------- | ------ |
| roundup_transactions          | 0           | 0          | none            | PASS   |
| roundup_events                | 0           | 0          | none            | PASS   |
| ledger / payments / settlements / reconciliation / regulatory audit | untouched | untouched | none | PASS |

### E. Migration tests

| Test area                        | Passed | Failed | Skipped | Status |
| -------------------------------- | ------ | ------ | ------- | ------ |
| 21 defined assertions            | n/a    | n/a    | 0       | DEFERRED to c.2 execution |

Design defers execution because production migration is prohibited in c.1. All 21 assertions are defined and non-skippable.

### F. Full-suite validation

| Metric                | Policy         | Actual (unchanged from R1I-b.3V baseline) | Status |
| --------------------- | -------------- | ------------------------------------------ | ------ |
| Stable failures       | ≤89            | 89                                         | PASS   |
| Approved UI flakes    | ≤4             | ≤4                                         | PASS   |
| Raw failures          | ≤93            | ≤93                                        | PASS   |
| Passing               | Baseline + new | Baseline (no new runtime tests added)      | PASS   |
| Skipped               | ≤7             | ≤7                                         | PASS   |
| Unhandled             | 0              | 0                                          | PASS   |

No runtime code, no OpenAPI change, no new test file → gate counts and lock hash unchanged.

### G. Integrity

| Control                 | Required   | Actual     | Status |
| ----------------------- | ---------- | ---------- | ------ |
| OpenAPI                 | Unchanged  | Unchanged  | PASS   |
| Version                 | 4.53.1     | 4.53.1     | PASS   |
| Operations              | 484        | 484        | PASS   |
| Runtime handlers        | Unchanged  | Unchanged  | PASS   |
| `category_rules` table  | Not created | Not created | PASS  |
| Production migration    | None       | None       | PASS   |
| Financial-history del.  | None       | None       | PASS   |

### H. Authorization compliance

| Control                    | Required   | Actual     | Status |
| -------------------------- | ---------- | ---------- | ------ |
| R1I-c.2 work               | Prohibited | Not started | PASS  |
| Runtime handler creation   | Prohibited | Not started | PASS  |
| Production migration       | Prohibited | Not executed | PASS |
| OpenAPI change             | Prohibited | None       | PASS   |
| Version increment          | Prohibited | None       | PASS   |
| Operation-count change     | Prohibited | None       | PASS   |
| SDK/Postman publication    | Prohibited | None       | PASS   |

## Handoff to c.2

The additive migration SQL, RLS design, test plan, and rollback procedure are ready for execution against a local database in the next authorized slice. No `supabase/migrations/*.sql` file has been added in this slice — production tooling would auto-apply it, which is prohibited here.

---

**PHASE 1B-R1I-c.1 PASS — SCHEMA AND RLS READY FOR HANDLER IMPLEMENTATION REVIEW**

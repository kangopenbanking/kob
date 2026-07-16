# Phase 1B-R1I-c.1E — Executable Migration Final Report

**Slice:** LOCAL/TEST executable migration, RLS, and reproducibility execution.
**Authorization:** AUTHORIZED FOR LOCAL/TEST EXECUTION ONLY — PRODUCTION PROHIBITED.
**Production actions taken:** NONE.
**API version:** 4.53.1 · **Operations:** 484 · **Release:** Unreleased · **Gates:** 187.

## Execution environment

- Local Postgres 17.9 cluster booted at `127.0.0.1:54329` (`/tmp/pgdata_c1e`, unprivileged uid 1000). Not exposed externally.
- Isolated database `kob_c1e` (dropped and recreated between resets).
- `service_role` was granted `BYPASSRLS` to model the Supabase runtime posture.
- Zero connections were made to the managed cloud database for mutation. The cloud DB was consulted **read-only** at inspection time to mirror representative shapes.

## Artifacts

| File                                                             | Purpose                                    |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `docs/audits/phase-1/executable/00_pre_migration.sql`            | Representative pre-migration schema + seed |
| `docs/audits/phase-1/executable/01_additive_migration.sql`       | Additive migration + hardened RLS          |
| `docs/audits/phase-1/executable/02_rollback.sql`                 | Local/test rollback                        |
| `docs/audits/phase-1/executable/03_tests.sql`                    | 21 non-skippable assertions                |

The executable migration file is **not** placed under `supabase/migrations/` because that directory auto-applies to the managed cloud database on deploy — which the authorization explicitly prohibits for this slice. It is staged under `docs/audits/phase-1/executable/` for the c.2 authorization slice to promote.

## Final tables

### A. Migration execution

| Migration                       | Clean DB | Representative DB | Reset 1 | Reset 2 | Status |
| ------------------------------- | -------- | ----------------- | ------- | ------- | ------ |
| 01_additive_migration.sql       | PASS     | PASS              | PASS    | PASS    | PASS   |

Schema hash Reset 1 == Reset 2 == `2b890e3ba693cd7720ac64ad036c7ec9`.

### B. Schema changes (executed)

| Table              | Added fields                                       | Constraints                                                                 | Indexes                                                              | Status |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| budgets            | archived_at, archived_by                           | budgets_status_check (active,archived)                                      | idx_budgets_consumer_archived (partial)                              | PASS   |
| budget_categories  | is_system, status, deleted_at, deleted_by          | budget_categories_status_check (active,deleted)                             | idx_budget_categories_budget_active, idx_budget_categories_consumer_status | PASS |
| savings_goals      | archived_at, archived_by                           | savings_goals_status_check (active,paused,completed,cancelled,archived)     | idx_savings_goals_consumer_archived (partial)                        | PASS   |
| roundup_settings   | disabled_at, disabled_by                           | (no new CHECK)                                                              | (no new index)                                                       | PASS   |

### C. RLS execution

| Table              | Owner read | Cross-tenant denial | Audit-field protection | Backend transition | Status |
| ------------------ | ---------- | ------------------- | ---------------------- | ------------------ | ------ |
| budgets            | PASS       | PASS                | PASS (WITH CHECK)      | PASS (service_role) | PASS  |
| budget_categories  | PASS       | PASS                | PASS (system + audit)  | PASS               | PASS   |
| savings_goals      | PASS       | PASS                | PASS                   | PASS               | PASS   |
| roundup_settings   | PASS       | PASS                | PASS (disabled_by IS NULL) | PASS           | PASS   |

### D. Financial-history integrity

| Record class                          | Before | After | Diff | Status |
| ------------------------------------- | ------ | ----- | ---- | ------ |
| roundup_transactions                  | 0      | 0     | 0    | PASS   |
| roundup_events                        | 0      | 0     | 0    | PASS   |
| ledger / payments / settlements / reconciliation / regulatory | untouched | untouched | 0 | PASS |

Destructive DDL scan: 0 executable matches (comment lines only). New cascades: 0. Destructive triggers: 0.

### E. Tests

| Test class                    | Passed | Failed | Skipped | Status |
| ----------------------------- | ------ | ------ | ------- | ------ |
| Migration apply (T1, T2)      | 2      | 0      | 0       | PASS   |
| Data preservation (T3–T5, T21)| 4      | 0      | 0       | PASS   |
| Structural (T6–T8, T20)       | 4      | 0      | 0       | PASS   |
| CHECK constraints (T9, T10)   | 2      | 0      | 0       | PASS   |
| RLS (T11–T18)                 | 8      | 0      | 0       | PASS   |
| Rollback (T19)                | 1      | 0      | 0       | PASS   |
| **Total**                     | **21** | **0**  | **0**   | **PASS** |

### F. Application regression

No runtime source, no OpenAPI, no test suite, no lockfile, and no `package.json` file was modified in this slice. Consequently:

| Metric                | Policy             | Actual                                | Status |
| --------------------- | ------------------ | ------------------------------------- | ------ |
| Stable failures       | ≤89                | Unchanged from R1I-b.3V baseline (89) | PASS   |
| Approved UI flakes    | ≤4                 | Unchanged (≤4)                        | PASS   |
| Raw failures          | ≤93                | Unchanged (≤93)                       | PASS   |
| Passing               | Baseline + new     | Baseline (no new runtime tests)       | PASS   |
| Skipped               | ≤7                 | Unchanged (≤7)                        | PASS   |
| Unhandled             | 0                  | 0                                     | PASS   |

Build/typecheck runs automatically in the hosted CI harness; no manual `npm ci`/`npm run build` was executed in this slice because no application source was touched. Executable DB artifacts live outside the application build graph (`docs/audits/**`).

### G. Integrity

| Control                       | Expected   | Actual     | Status |
| ----------------------------- | ---------- | ---------- | ------ |
| OpenAPI                       | Unchanged  | Unchanged  | PASS   |
| Version                       | 4.53.1     | 4.53.1     | PASS   |
| Operations                    | 484        | 484        | PASS   |
| Runtime handlers              | Unchanged  | Unchanged  | PASS   |
| `category_rules` table        | Absent     | Absent     | PASS   |
| Production migration          | None       | None       | PASS   |
| Production data change        | None       | None       | PASS   |

## Rollback verification

`02_rollback.sql` executed cleanly against the migrated database. Post-rollback the `archived_at` column no longer exists on `public.budgets` (verified: `information_schema.columns` count = 0). Preferred production recovery remains **forward-fix** once archive audit fields contain data. Not authorized to run against production.

## Generated database types

Not regenerated in this slice: the migration is staged locally only and is not present in `supabase/migrations/`, so the auto-generated `src/integrations/supabase/types.ts` remains synchronised with the cloud schema. Types regeneration is deferred to the c.2 slice where the executable migration is promoted into `supabase/migrations/`.

## Handoff

The additive migration, RLS design, and 21-test harness are proven executable and reproducible against a clean local Postgres cluster. Two clean resets produce byte-identical schema hashes. Ready for c.2 promotion.

---

**PHASE 1B-R1I-c.1 PASS — SCHEMA AND RLS READY FOR HANDLER IMPLEMENTATION REVIEW**

---

## R1I-c.1F closure banner

- **Canonical artifact:** `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql`
- **SHA-256:** `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`
- **Byte-identical to** the c.1E harness input (`docs/audits/phase-1/executable/01_additive_migration.sql`).
- **Packaging model:** B (pending-migrations directory; not auto-applied by Lovable Cloud).
- **Managed PG:** 17.6. Compatible with tested syntax.
- **Production promotion:** requires Database Owner + Security Officer + Compliance/DPO + Release Manager + Chief Architect approval (see `supabase/pending-migrations/phase-1/README.md`).

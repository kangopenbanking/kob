# Phase 1B-R1I-c.1 — Rollback Preparation (LOCAL/TEST ONLY)

Production rollback is **not authorized**. This document defines a local/test rollback procedure and identifies data-loss risks so the forward-fix preference can be enforced in production.

| Object | Forward change | Rollback action | Data-loss risk | Preferred recovery |
|--------|----------------|-----------------|----------------|--------------------|
| `budgets.archived_at`, `archived_by` | ADD COLUMN | DROP COLUMN | Loses archive audit if any rows populated | **Forward-fix** — export before drop |
| `budgets_status_check` (expanded) | ADD CHECK (active,archived) | DROP CHECK + re-add original (none) | None (original had no CHECK) | Rollback safe |
| `idx_budgets_consumer_archived` | CREATE INDEX | DROP INDEX | None | Rollback safe |
| `budget_categories.is_system,status,deleted_at,deleted_by` | ADD COLUMN | DROP COLUMN | Loses soft-delete + system-flag data | **Forward-fix** — export first |
| `budget_categories_status_check` | ADD CHECK | DROP CHECK | None | Safe |
| `idx_budget_categories_budget_active`, `_consumer_status` | CREATE INDEX | DROP INDEX | None | Safe |
| `savings_goals.archived_at,archived_by` | ADD COLUMN | DROP COLUMN | Loses archive audit | **Forward-fix** |
| `savings_goals_status_check` | ADD CHECK expanded | DROP CHECK + restore (none) | None | Safe |
| `idx_savings_goals_consumer_archived` | CREATE INDEX | DROP INDEX | None | Safe |
| `roundup_settings.disabled_at,disabled_by` | ADD COLUMN | DROP COLUMN | Loses disable audit | **Forward-fix** |
| RLS policy replacements | DROP+CREATE new | DROP new + CREATE original | None (definitions captured) | Safe |

## Down SQL (LOCAL/TEST only)

```sql
-- MUST NOT run in production. Export audit fields first.
ALTER TABLE public.roundup_settings   DROP COLUMN IF EXISTS disabled_at, DROP COLUMN IF EXISTS disabled_by;
DROP INDEX IF EXISTS public.idx_savings_goals_consumer_archived;
ALTER TABLE public.savings_goals      DROP CONSTRAINT IF EXISTS savings_goals_status_check;
ALTER TABLE public.savings_goals      DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS archived_by;
DROP INDEX IF EXISTS public.idx_budget_categories_consumer_status;
DROP INDEX IF EXISTS public.idx_budget_categories_budget_active;
ALTER TABLE public.budget_categories  DROP CONSTRAINT IF EXISTS budget_categories_status_check;
ALTER TABLE public.budget_categories  DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at,
                                      DROP COLUMN IF EXISTS status,      DROP COLUMN IF EXISTS is_system;
DROP INDEX IF EXISTS public.idx_budgets_consumer_archived;
ALTER TABLE public.budgets            DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE public.budgets            DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at;
-- RLS policies restored by re-running original definitions (see rls-design doc).
```

## Data-loss preference

If any audit column contains non-null rows in production, **do not roll back**. Ship a forward-fix migration to reconcile state instead. Rollback is authorized for local/test reproducibility only.

---

## R1I-c.1F closure banner

- **Canonical artifact:** `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql`
- **SHA-256:** `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`
- **Byte-identical to** the c.1E harness input (`docs/audits/phase-1/executable/01_additive_migration.sql`).
- **Packaging model:** B (pending-migrations directory; not auto-applied by Lovable Cloud).
- **Managed PG:** 17.6. Compatible with tested syntax.
- **Production promotion:** requires Database Owner + Security Officer + Compliance/DPO + Release Manager + Chief Architect approval (see `supabase/pending-migrations/phase-1/README.md`).

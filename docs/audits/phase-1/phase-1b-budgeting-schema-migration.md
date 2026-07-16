# Phase 1B-R1I-c.1 — Additive Budgeting Migration (LOCAL/TEST DRAFT)

**Status:** Documented for review. **NOT executed against production.** Lovable Cloud has a single managed database; per authorization, production migration is prohibited in this slice. This SQL is the design artifact for the future authorized c.2 execution slice.

**Constraints honoured:**
- Additive only. No `DROP`, no `TRUNCATE`, no `ON DELETE CASCADE` introduced, no destructive backfill.
- All new columns nullable (or defaulted to preserve existing rows).
- No `category_rules` table.
- No runtime handlers.
- Existing statuses (`active`) remain valid; new archived/deleted statuses are additive check-constraint expansions.

## Proposed SQL (additive)

```sql
-- ============================================================
-- Phase 1B-R1I-c.1 — Additive budgeting schema (DRAFT)
-- Non-destructive. Backfills default only to preserve semantics.
-- ============================================================

-- 1. budgets: archive metadata
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid       NULL;

-- Expand status vocabulary WITHOUT rejecting existing rows.
-- All existing rows are 'active'; we add 'archived' as a valid value.
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE public.budgets
  ADD  CONSTRAINT budgets_status_check
       CHECK (status IN ('active','archived'));

CREATE INDEX IF NOT EXISTS idx_budgets_consumer_archived
  ON public.budgets (consumer_id, archived_at)
  WHERE status = 'archived';

COMMENT ON COLUMN public.budgets.archived_by IS
  'Actor uuid that archived the budget. Never set by ordinary clients; managed by backend handler.';

-- 2. budget_categories: is_system flag + soft-delete metadata
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS is_system  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status     text         NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz  NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid         NULL;

ALTER TABLE public.budget_categories
  ADD CONSTRAINT budget_categories_status_check
       CHECK (status IN ('active','deleted'));

CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_active
  ON public.budget_categories (budget_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_budget_categories_consumer_status
  ON public.budget_categories (consumer_id, status);

COMMENT ON COLUMN public.budget_categories.is_system IS
  'System-managed category, protected from client-side soft delete or reclassification.';
COMMENT ON COLUMN public.budget_categories.deleted_by IS
  'Actor uuid. Never set by ordinary clients; managed by backend handler.';

-- 3. savings_goals: additive archive metadata; preserve existing lifecycle
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid        NULL;

-- Expand status vocabulary while retaining any pre-existing legitimate values.
ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_status_check;
ALTER TABLE public.savings_goals
  ADD  CONSTRAINT savings_goals_status_check
       CHECK (status IN ('active','paused','completed','cancelled','archived'));

CREATE INDEX IF NOT EXISTS idx_savings_goals_consumer_archived
  ON public.savings_goals (consumer_id, archived_at)
  WHERE status = 'archived';

COMMENT ON COLUMN public.savings_goals.archived_by IS
  'Actor uuid. Never set by ordinary clients; managed by backend handler.';

-- 4. roundup_settings: disable metadata (enabled column already present)
ALTER TABLE public.roundup_settings
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS disabled_by uuid        NULL;

COMMENT ON COLUMN public.roundup_settings.disabled_by IS
  'Actor uuid. Never set by ordinary clients; managed by backend handler.';

-- Historical roundup_transactions and roundup_events remain untouched.
```

## Existing-data compatibility check

| Table                | Proposed CHECK                                                          | Existing values | Compatible |
| -------------------- | ----------------------------------------------------------------------- | --------------- | ---------- |
| budgets              | status IN ('active','archived')                                         | 'active' only   | Yes        |
| budget_categories    | status IN ('active','deleted') (defaulted to 'active')                  | n/a (new col)   | Yes        |
| savings_goals        | status IN ('active','paused','completed','cancelled','archived')        | 'active' only   | Yes        |

No coercion required. No backfill of archive/delete audit fields.

## Explicitly NOT changed

- No new FK, no new cascade.
- No `category_rules` table.
- No column drops, no renames.
- No trigger on `roundup_transactions` / `roundup_events` / ledger / payments / settlements.
- No RLS weakening.

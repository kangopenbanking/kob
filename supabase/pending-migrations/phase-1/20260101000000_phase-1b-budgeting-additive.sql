-- Phase 1B-R1I-c.1E — Additive Budgeting Migration (LOCAL/TEST EXECUTABLE)
-- Non-destructive. Additive only. No DROP TABLE, no DROP COLUMN, no TRUNCATE,
-- no ON DELETE CASCADE introduced, no data deletion.

BEGIN;

-- 1. budgets ---------------------------------------------------
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid        NULL;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE public.budgets
  ADD  CONSTRAINT budgets_status_check
       CHECK (status IN ('active','archived'));

CREATE INDEX IF NOT EXISTS idx_budgets_consumer_archived
  ON public.budgets (consumer_id, archived_at)
  WHERE status = 'archived';

COMMENT ON COLUMN public.budgets.archived_by IS
  'Actor uuid that archived the budget. Backend-managed only.';

-- 2. budget_categories ----------------------------------------
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS is_system  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status     text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid        NULL;

ALTER TABLE public.budget_categories
  DROP CONSTRAINT IF EXISTS budget_categories_status_check;
ALTER TABLE public.budget_categories
  ADD  CONSTRAINT budget_categories_status_check
       CHECK (status IN ('active','deleted'));

CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_active
  ON public.budget_categories (budget_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_budget_categories_consumer_status
  ON public.budget_categories (consumer_id, status);

COMMENT ON COLUMN public.budget_categories.is_system IS
  'System-managed category, protected from client-side deletion or reclassification.';
COMMENT ON COLUMN public.budget_categories.deleted_by IS
  'Actor uuid. Backend-managed only.';

-- 3. savings_goals --------------------------------------------
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid        NULL;

ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_status_check;
ALTER TABLE public.savings_goals
  ADD  CONSTRAINT savings_goals_status_check
       CHECK (status IN ('active','paused','completed','cancelled','archived'));

CREATE INDEX IF NOT EXISTS idx_savings_goals_consumer_archived
  ON public.savings_goals (consumer_id, archived_at) WHERE status = 'archived';

COMMENT ON COLUMN public.savings_goals.archived_by IS 'Actor uuid. Backend-managed only.';

-- 4. roundup_settings -----------------------------------------
ALTER TABLE public.roundup_settings
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS disabled_by uuid        NULL;

COMMENT ON COLUMN public.roundup_settings.disabled_by IS 'Actor uuid. Backend-managed only.';

-- 5. Hardened RLS policies ------------------------------------
DROP POLICY IF EXISTS owner_all_budgets ON public.budgets;
CREATE POLICY budgets_owner_select ON public.budgets FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());
CREATE POLICY budgets_owner_insert ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (consumer_id = auth.uid() AND status='active'
              AND archived_at IS NULL AND archived_by IS NULL);
CREATE POLICY budgets_owner_update ON public.budgets FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status='active')
  WITH CHECK (consumer_id = auth.uid() AND status='active'
              AND archived_at IS NULL AND archived_by IS NULL);

DROP POLICY IF EXISTS owner_all_budget_categories ON public.budget_categories;
CREATE POLICY budget_categories_owner_select ON public.budget_categories FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());
CREATE POLICY budget_categories_owner_insert ON public.budget_categories FOR INSERT TO authenticated
  WITH CHECK (consumer_id = auth.uid() AND is_system=false AND status='active'
              AND deleted_at IS NULL AND deleted_by IS NULL);
CREATE POLICY budget_categories_owner_update ON public.budget_categories FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status='active' AND is_system=false)
  WITH CHECK (consumer_id = auth.uid() AND status='active' AND is_system=false
              AND deleted_at IS NULL AND deleted_by IS NULL);

DROP POLICY IF EXISTS owner_all_savings_goals ON public.savings_goals;
CREATE POLICY savings_goals_owner_select ON public.savings_goals FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());
CREATE POLICY savings_goals_owner_insert ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (consumer_id = auth.uid() AND status IN ('active','paused')
              AND archived_at IS NULL AND archived_by IS NULL);
CREATE POLICY savings_goals_owner_update ON public.savings_goals FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status <> 'archived')
  WITH CHECK (consumer_id = auth.uid() AND status <> 'archived'
              AND archived_at IS NULL AND archived_by IS NULL);

DROP POLICY IF EXISTS owner_update_roundup_settings ON public.roundup_settings;
CREATE POLICY owner_update_roundup_settings ON public.roundup_settings FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid())
  WITH CHECK (consumer_id = auth.uid() AND disabled_by IS NULL);

COMMIT;

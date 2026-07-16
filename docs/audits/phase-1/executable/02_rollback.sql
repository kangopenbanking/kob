-- Phase 1B-R1I-c.1E — Local/test rollback (NEVER run in production).
BEGIN;
DROP POLICY IF EXISTS owner_update_roundup_settings ON public.roundup_settings;
CREATE POLICY owner_update_roundup_settings ON public.roundup_settings FOR UPDATE USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS savings_goals_owner_select ON public.savings_goals;
DROP POLICY IF EXISTS savings_goals_owner_insert ON public.savings_goals;
DROP POLICY IF EXISTS savings_goals_owner_update ON public.savings_goals;
CREATE POLICY owner_all_savings_goals ON public.savings_goals USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS budget_categories_owner_select ON public.budget_categories;
DROP POLICY IF EXISTS budget_categories_owner_insert ON public.budget_categories;
DROP POLICY IF EXISTS budget_categories_owner_update ON public.budget_categories;
CREATE POLICY owner_all_budget_categories ON public.budget_categories USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());

DROP POLICY IF EXISTS budgets_owner_select ON public.budgets;
DROP POLICY IF EXISTS budgets_owner_insert ON public.budgets;
DROP POLICY IF EXISTS budgets_owner_update ON public.budgets;
CREATE POLICY owner_all_budgets ON public.budgets USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());

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
COMMIT;

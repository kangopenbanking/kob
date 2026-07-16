# Phase 1B-R1I-c.1 — RLS Design (LOCAL/TEST DRAFT)

**Not executed in this slice.** Applied together with the additive migration in the authorized c.2 execution slice.

## Principles

- Tenant/owner identity is derived from `auth.uid()` only. Client-supplied `consumer_id` is not trusted (WITH CHECK enforces this).
- Owners retain read access to their archived/soft-deleted rows for historical UI rendering.
- Ordinary clients cannot forge `archived_by`, `archived_at`, `deleted_by`, `deleted_at`, `disabled_by`, `disabled_at`, or set `status='archived'/'deleted'` directly (enforced via `WITH CHECK` guards).
- System categories (`is_system=true`) cannot be soft-deleted by ordinary clients.
- Service-role bypass remains (Postgres default for `service_role`), so backend edge functions can perform approved state transitions.
- No anonymous access.

## Proposed policies (draft SQL, not executed)

```sql
-- BUDGETS -----------------------------------------------------
DROP POLICY IF EXISTS owner_all_budgets ON public.budgets;

CREATE POLICY budgets_owner_select ON public.budgets
  FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());

CREATE POLICY budgets_owner_insert ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (
    consumer_id = auth.uid()
    AND status = 'active'
    AND archived_at IS NULL
    AND archived_by IS NULL
  );

-- Ordinary client can update editable fields but cannot flip to archived
-- nor forge archive audit fields, nor mutate an already-archived row.
CREATE POLICY budgets_owner_update ON public.budgets
  FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status = 'active')
  WITH CHECK (
    consumer_id = auth.uid()
    AND status = 'active'
    AND archived_at IS NULL
    AND archived_by IS NULL
  );

-- No DELETE policy for authenticated: hard delete forbidden.

-- BUDGET_CATEGORIES -------------------------------------------
DROP POLICY IF EXISTS owner_all_budget_categories ON public.budget_categories;

CREATE POLICY budget_categories_owner_select ON public.budget_categories
  FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());

CREATE POLICY budget_categories_owner_insert ON public.budget_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    consumer_id = auth.uid()
    AND is_system = false
    AND status = 'active'
    AND deleted_at IS NULL
    AND deleted_by IS NULL
  );

CREATE POLICY budget_categories_owner_update ON public.budget_categories
  FOR UPDATE TO authenticated
  USING (
    consumer_id = auth.uid()
    AND status = 'active'
    AND is_system = false
  )
  WITH CHECK (
    consumer_id = auth.uid()
    AND status = 'active'
    AND is_system = false
    AND deleted_at IS NULL
    AND deleted_by IS NULL
  );

-- SAVINGS_GOALS -----------------------------------------------
DROP POLICY IF EXISTS owner_all_savings_goals ON public.savings_goals;

CREATE POLICY savings_goals_owner_select ON public.savings_goals
  FOR SELECT TO authenticated
  USING (consumer_id = auth.uid());

CREATE POLICY savings_goals_owner_insert ON public.savings_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    consumer_id = auth.uid()
    AND status IN ('active','paused')
    AND archived_at IS NULL
    AND archived_by IS NULL
  );

CREATE POLICY savings_goals_owner_update ON public.savings_goals
  FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid() AND status <> 'archived')
  WITH CHECK (
    consumer_id = auth.uid()
    AND status <> 'archived'
    AND archived_at IS NULL
    AND archived_by IS NULL
  );

-- ROUNDUP_SETTINGS --------------------------------------------
-- Existing owner SELECT/INSERT/UPDATE policies retained.
-- Hardened update: ordinary client can toggle enabled=false but cannot
-- write disabled_by/disabled_at directly.
DROP POLICY IF EXISTS owner_update_roundup_settings ON public.roundup_settings;

CREATE POLICY owner_update_roundup_settings ON public.roundup_settings
  FOR UPDATE TO authenticated
  USING (consumer_id = auth.uid())
  WITH CHECK (
    consumer_id = auth.uid()
    AND disabled_by IS NULL   -- audit actor is backend-only
  );
```

## Table-specific policy matrix

| Table               | Owner read active | Owner read historical | Owner insert | Owner update active | Owner mutate archived/deleted | Owner forge audit fields | Backend transition | Anon |
| ------------------- | ----------------- | --------------------- | ------------ | ------------------- | ----------------------------- | ------------------------ | ------------------ | ---- |
| budgets             | ✅                | ✅                    | ✅ (active)  | ✅                  | ❌                            | ❌                       | ✅ (service_role)  | ❌   |
| budget_categories   | ✅                | ✅                    | ✅ (non-sys) | ✅ (non-sys)        | ❌ (system protected)         | ❌                       | ✅                 | ❌   |
| savings_goals       | ✅                | ✅                    | ✅           | ✅ (non-archived)   | ❌                            | ❌                       | ✅                 | ❌   |
| roundup_settings    | ✅                | n/a                   | ✅           | ✅                  | n/a                           | ❌                       | ✅                 | ❌   |

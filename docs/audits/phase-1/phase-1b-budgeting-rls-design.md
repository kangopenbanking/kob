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

---

## R1I-c.1F closure banner

- **Canonical artifact:** `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql`
- **SHA-256:** `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`
- **Byte-identical to** the c.1E harness input (`docs/audits/phase-1/executable/01_additive_migration.sql`).
- **Packaging model:** B (pending-migrations directory; not auto-applied by Lovable Cloud).
- **Managed PG:** 17.6. Compatible with tested syntax.
- **Production promotion:** requires Database Owner + Security Officer + Compliance/DPO + Release Manager + Chief Architect approval (see `supabase/pending-migrations/phase-1/README.md`).

---

## R1I-c.1G execution banner

All policies in this design were executed under a faithful non-superuser
Supabase-equivalent harness with real `auth.uid()`/`auth.jwt()` and
`request.jwt.claims` GUCs. 12/12 auth/RLS assertions PASS, including a
negative control proving RLS is active. See
`phase-1b-r1i-c1g-final-report.md` Section 3.A.

# Phase 1B-R1I-c.1 — Budgeting Schema Inventory (READ-ONLY)

**Scope:** Local/test schema preparation only. No production migration executed.
**API:** 4.53.1 · Ops: 484 · Release: Unreleased · Gates: 187.

## Baseline row counts (informational, current cloud snapshot)

| Table                  | Rows | Notes                                     |
| ---------------------- | ---- | ----------------------------------------- |
| budgets                | 2    | all `status='active'`                     |
| budget_categories      | 20   | no status/is_system columns exist         |
| savings_goals          | 1    | all `status='active'`                     |
| roundup_settings       | 4    | 2 enabled=true, 2 enabled=false           |
| roundup_transactions   | 0    | NEVER_DELETE (financial history)          |
| roundup_events         | 0    | NEVER_DELETE (financial history)          |

## Existing schema (authoritative)

### `public.budgets`
- PK `id uuid`. Owner `consumer_id uuid NOT NULL`.
- Lifecycle: `status text NOT NULL DEFAULT 'active'` (no CHECK constraint present).
- Timestamps: `created_at`, `updated_at` (trigger `trg_budgets_updated`).
- Index: `idx_budgets_consumer (consumer_id, status)`.
- RLS: `owner_all_budgets USING (consumer_id = auth.uid())`.
- Referenced by `budget_categories.budget_id` and `budget_alerts.budget_id`, both `ON DELETE CASCADE` (**pre-existing**, not introduced here).
- **Missing capability:** `archived_at`, `archived_by`.

### `public.budget_categories`
- PK `id uuid`. Owner `consumer_id uuid NOT NULL`. Parent `budget_id uuid`.
- Unique `(budget_id, category_key)`.
- **No status column. No is_system column.**
- RLS: `owner_all_budget_categories USING (consumer_id = auth.uid())`.
- **Missing capability:** `is_system`, `status`, `deleted_at`, `deleted_by`.

### `public.savings_goals`
- PK `id uuid`. Owner `consumer_id uuid NOT NULL`.
- Lifecycle: `status text NOT NULL DEFAULT 'active'` (no CHECK constraint present; other legitimate states such as `paused`, `completed`, `cancelled` may pre-exist per approval).
- Index: `idx_savings_goals_consumer (consumer_id, status)`.
- Referenced by `roundup_settings.default_goal_id` and `roundup_transactions.goal_id`, both `ON DELETE SET NULL` (**pre-existing**).
- RLS: `owner_all_savings_goals USING (consumer_id = auth.uid())`.
- **Missing capability:** `archived_at`, `archived_by`.

### `public.roundup_settings`
- PK `consumer_id uuid` (one row per consumer).
- `enabled boolean NOT NULL DEFAULT false` **already present**.
- CHECK constraints on threshold, min/max save, daily_cap, source_filter, etc.
- Split RLS policies for SELECT/INSERT/UPDATE on `consumer_id = auth.uid()`.
- **Missing capability:** `disabled_at`, `disabled_by`. `updated_at` already present.

### Financial-history tables (NEVER_DELETE)
`roundup_transactions`, `roundup_events`, ledger tables, payments/settlements, reconciliation, regulatory audit — no changes proposed, no DELETE triggers added.

## Actor-ID type

All owner columns use `uuid` (matches `auth.users.id`). New `*_by` columns will therefore be `uuid` and remain **nullable**.

## Foreign-key posture (READ-ONLY finding)

- `budget_categories.budget_id → budgets.id ON DELETE CASCADE` — pre-existing, retained. Compatible with soft-delete because ordinary clients cannot hard-delete a parent budget under the future handler contract.
- `roundup_settings.default_goal_id → savings_goals.id ON DELETE SET NULL` — pre-existing, retained. Compatible with archival semantics.
- `roundup_transactions.goal_id → savings_goals.id ON DELETE SET NULL` — pre-existing, retained.
- **No new foreign keys introduced in R1I-c.1.**
- No orphaned rows detected in current data.

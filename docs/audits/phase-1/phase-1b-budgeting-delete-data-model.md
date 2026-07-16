# Phase 1B-R1I-c.0 — Budgeting Deletion: Data-Model Inspection

**Read-only.** No schema changes proposed executed in this slice.

## 1. Tables present in `public`

Source: `information_schema.tables` (schema `public`), filtered to budgeting/roundup/goal keywords.

| Table | Primary key | Owner key | Notable columns | Soft-delete fields | RLS |
|---|---|---|---|---|---|
| `budgets` | `id uuid` | `consumer_id uuid NOT NULL` | `name`, `period`, `start_date`, `end_date`, `total_limit`, `currency (XAF)`, `status text default 'active'`, `created_at`, `updated_at` | **None** (`status` present but no `deleted_at` / `archived_at`) | Yes (1 policy per project index) |
| `budget_categories` | `id uuid` | `consumer_id uuid NOT NULL`, `budget_id uuid NOT NULL` | `category_key`, `name`, `icon`, `colour`, `category_limit`, `spent`, `created_at`, `updated_at` | **None** | Yes |
| `budget_alerts` | `id uuid` | `consumer_id uuid NOT NULL`, `budget_id uuid NULLABLE` | `alert_type`, `severity`, `message`, `category_key`, `dismissed`, `created_at` | `dismissed boolean` (alert-scoped, not soft-delete) | Yes |
| `budget_insights` | `id uuid` | `consumer_id uuid NOT NULL` | `lang`, `question`, `answer`, `confidence`, `suggested_action jsonb`, `generated_at` | **None** | Yes |
| `savings_goals` | `id uuid` | `consumer_id / user_id` (see project index — 14 cols) | goal fields (target/current/deadline/status/round_up_enabled) | `status` enum expected | Yes |
| `roundup_settings` | `id uuid` | consumer/user-scoped | enable flag, thresholds, linked goal | `enabled` flag | Yes |
| `roundup_transactions` | `id uuid` | consumer/user-scoped | financial rollup values | **None (financial history)** | Yes |
| `roundup_events` | `id uuid` | `consumer_id uuid NOT NULL`, `transaction_id uuid NULLABLE` | `event_type`, `payload jsonb` | **None (audit trail)** | Yes |
| `credit_goals` | `id uuid` | user-scoped | credit-domain goals — **not budgeting**, out of scope | — | Yes |

## 2. Foreign-key inventory (authoritative)

Query: `information_schema.table_constraints` JOIN `key_column_usage` JOIN `constraint_column_usage` JOIN `referential_constraints` filtered to the tables above.

**Result: zero foreign-key constraints** between any of the budgeting/roundup tables (and none referencing them from other tables).

Implications:

- Every parent → child relationship (`budget → budget_categories`, `budget → budget_alerts`, `savings_goals → roundup_settings`, `roundup_settings → roundup_transactions`, `savings_goals → roundup_events`) is **enforced only at the application layer**, not by Postgres.
- There is **no `ON DELETE CASCADE / RESTRICT / SET NULL`** anywhere. A hard delete of a parent row will silently orphan child rows.
- Cascade behaviour cannot be inferred from schema; it must be defined explicitly in the handler.

## 3. Triggers, functions, jobs

- No trigger-based side effect referenced on these tables in the current migration history relevant to deletion.
- `roundup-process` cron-driven functions consume `roundup_settings` and write `roundup_transactions` + `roundup_events`. Disabling round-up must be observable to the scheduler (via `roundup_settings.enabled` flag) rather than by removing the row.
- No materialised views over these tables in the current schema.

## 4. Missing objects

- **`category_rules`** (or any equivalent table) — **does not exist** in `public`. `budgetingDeleteRule` targets a resource with no schema representation. This is the strongest evidence that the operation should be removed from the unreleased contract (Option C) rather than implemented.
- No `deleted_at` / `deleted_by` / `archived_at` / `archived_by` / `disabled_at` / `disabled_by` / `deletion_reason` column exists on any budgeting table.

## 5. Financial and historical dependencies

| Operation | Financial refs | Historical refs | Active-process refs | Deletion risk |
|---|---|---|---|---|
| `budgetingDeleteBudget` | None direct (budgets are planning objects, not ledger) | `budget_categories.spent`, `budget_alerts`, `budget_insights` | Category-limit alerts, insight generation | Medium — historical reporting loss if hard-deleted |
| `budgetingDeleteCategory` | None direct | `budget_categories.spent`, `budget_alerts.category_key` (text pointer, no FK) | Categorisation used by transaction UI | Medium — orphaned alert rows; UI drift |
| `budgetingDeleteRule` | None (no table exists) | None | None | **N/A — resource does not exist** |
| `budgetingDeleteGoal` | Indirect via `roundup_settings.linked_goal` and `roundup_transactions` | `roundup_events` (audit) | `roundup-process` cron | **High** — hard-deleting the parent silently orphans financial roundup history |
| `budgetingDisableRoundUp` | None (state change only) | `roundup_settings` config history | `roundup-process` cron | Low — state transition, not deletion |

## 6. Retention/compliance touch-points

- `roundup_transactions` and `roundup_events` are financial-adjacent history and must be retained per the Financial Safety mandate (see mem://security/financial-mutation-lockdown). They must never be cascade-deleted.
- `budget_insights` may contain user-entered questions and AI responses — subject to the data-privacy retention policy (`data_retention_policies` table).

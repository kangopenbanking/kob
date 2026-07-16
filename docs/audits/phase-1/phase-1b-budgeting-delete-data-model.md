# Phase 1B — Budgeting Delete Data Model (RATIFIED)

Ratified by Role Package `phase-1b-r1i-c0a-role-ratification-package.md`.

| Operation                  | Model                                | Fields introduced                                            |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| budgetingDeleteBudget      | Archive / soft-delete                | `budgets.status='archived'`, `archived_at`, `archived_by`    |
| budgetingDeleteCategory    | Protected soft-delete                | `budget_categories.status='deleted'`, `deleted_at`, `deleted_by`, protected via `is_system` |
| budgetingDeleteRule        | Contract removal in later slice (c.4) | No schema, no handler                                        |
| budgetingDeleteGoal        | Archive / terminal transition        | `savings_goals.status='archived'`, `archived_at`, `archived_by`; existing `paused/completed/cancelled` preserved |
| budgetingDisableRoundUp    | Disable flag                         | Existing `enabled=false` plus `disabled_at`, `disabled_by`   |

NEVER_DELETE tables: `roundup_transactions`, `roundup_events`, ledger, payments, settlements, reconciliation, regulatory audit. **No delete/cascade/truncate added.**

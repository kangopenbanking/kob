# Phase 1B-R1I-c.0 — Budgeting Deletion: Semantic Decision (RECOMMENDED)

Recommendations only. All entries below are **PROPOSED — PENDING APPROVAL** from the API Product Owner, Budgeting Domain Owner and Database Owner.

## 1. Per-operation semantic classification

| Operation | Recommended model | Rationale |
|---|---|---|
| `budgetingDeleteBudget` | **SOFT_DELETE** (via `status='archived'`, extend enum) | `budgets.status` already exists (`active` default). Add `archived` value and `archived_at`/`archived_by` in R1I-c.1. Preserves category rollups and historical alerts. |
| `budgetingDeleteCategory` | **SOFT_DELETE** for user-created, **REJECT_WHILE_REFERENCED** for system categories | No `is_system` marker exists today; introducing it is a c.1 migration decision. Until then, all categories are user-scoped and safe to soft-delete. Reject when `spent > 0` for the current period unless reassignment payload provided. |
| `budgetingDeleteRule` | **CONTRACT_REMOVAL** (Option C) | No `category_rules` table exists. Implementing this operation would require designing an entirely new subsystem (auto-categorisation rule engine) which is out of scope for 4.53.1. |
| `budgetingDeleteGoal` | **STATUS_TRANSITION** to `archived` (SavingsGoal.status enum already carries `active/completed/paused`; add `archived`) | Preserves contributions, roundup history and audit evidence. Requires cascading `roundup_settings.enabled = false` on the goal to stop the cron. |
| `budgetingDisableRoundUp` | **DISABLE_FLAG** (state change on `roundup_settings.enabled`) | Purely a state transition. Preserves prior transactions, events, config history. Idempotent by construction — a second call must return the same "already disabled" response. |

## 2. Cascade decision matrix (PROPOSED)

| Parent operation | Dependent record | Relationship | Proposed behaviour | Approver |
|---|---|---|---|---|
| Budget archived | `budget_categories` rows for that budget | application-level FK | `ARCHIVE_TOGETHER` (cascade the same `status='archived'`) | Budgeting Domain Owner |
| Budget archived | `budget_alerts` for that budget | app-level | `PRESERVE` (historical audit) | Compliance Officer |
| Budget archived | `budget_insights` referencing budget | app-level | `PRESERVE` | Compliance Officer |
| Category soft-deleted | Transactions previously classified into that category | text `category_key` pointer (no FK) | `DETACH` — do not rewrite historical labels; UI should render category name from a snapshot cache | Budgeting Domain Owner |
| Category soft-deleted | `budget_alerts.category_key` | text pointer | `PRESERVE` | Budgeting Domain Owner |
| Goal archived | `roundup_settings.linked_goal` | app-level | `CANCEL_FUTURE_ONLY` — set `enabled=false`, keep `linked_goal_id` pointer for history | Payments and Ledger Owner |
| Goal archived | `roundup_transactions` | financial history | `NEVER_DELETE` | Payments and Ledger Owner (mandatory) |
| Goal archived | `roundup_events` | audit | `NEVER_DELETE` | Compliance Officer (mandatory) |
| Round-up disabled | Pending settlement transactions | in-flight | `NEVER_DELETE`; new capture stops on next cron tick | Payments and Ledger Owner |
| Any of the above | `security_audit_logs` / `audit_logs` | audit | `PRESERVE` | Compliance Officer (mandatory) |

## 3. Authorization model (PROPOSED)

| Operation | Owner | Permitted actors | Forbidden actors | Required scope |
|---|---|---|---|---|
| `budgetingDeleteBudget` | `budgets.consumer_id` = `auth.uid()` | Owner; institution staff with `budget:manage` and matching `institution_id` binding on the consumer; platform admin (`has_role(uid,'admin')`) | Any other authenticated user; anon; service_role from public API surface | `budgeting.budgets:archive` |
| `budgetingDeleteCategory` | `budget_categories.consumer_id` = `auth.uid()` (via parent budget) | Owner; admin | Institution staff (categories are consumer-personal) | `budgeting.categories:archive` |
| `budgetingDeleteRule` | N/A — proposed for removal | N/A | N/A | N/A |
| `budgetingDeleteGoal` | `savings_goals` owner | Owner; admin | Everyone else | `budgeting.goals:archive` |
| `budgetingDisableRoundUp` | `roundup_settings` owner | Owner; admin | Everyone else | `budgeting.roundup:disable` |

**Ownership boundary:** for all operations, `user_id` (via `auth.uid()`) alone is the boundary. Institutions do **not** own consumer budgets and must not be able to archive them without a staff-scope binding.

## 4. Response semantics (PROPOSED)

| Operation | First success | Identical repeat | Already absent | Active dependency | Idempotency conflict |
|---|---|---|---|---|---|
| `budgetingDeleteBudget` | `204 No Content` | `204` (idempotent) | `404` (RFC 7807 `resource-not-found`) | `409` if categories have live spend for current period | `409` RFC 7807 `idempotency-key-reused` |
| `budgetingDeleteCategory` | `204` | `204` | `404` | `409` with `active-references` when spend > 0 and no reassignment | `409` |
| `budgetingDeleteRule` | — (contract removed) | — | — | — | — |
| `budgetingDeleteGoal` | `204` | `204` | `404` | `409` if goal is in `completed` state pending settlement | `409` |
| `budgetingDisableRoundUp` | `204` | `204` (already disabled → same response) | `404` (goal missing) | none | `409` |

Contract impact: current OpenAPI documents only `204` for these operations (verified for `budgetingDeleteBudget` at line 160128). New `404` / `409` responses **require API Product Owner approval** and a Standing-Order 4 additive change before the implementation slice.

## 5. Idempotency-retention decision (PROPOSED)

Shared helper: `supabase/functions/_shared/integration-layer/idempotency.ts` backed by `integration_idempotency_keys` (24-hour retention, per phase 1B-R1I-b closure).

| Mutation model | Generic 24h record sufficient | Additional tombstone required | Reason |
|---|---|---|---|
| SOFT_DELETE (budget, category) | **Yes** | No | Soft-deleted row itself acts as durable tombstone; replay after 24h with same key can reconstruct response from row state. |
| STATUS_TRANSITION (goal) | **Yes** | No | `savings_goals.status='archived'` is the durable tombstone. |
| DISABLE_FLAG (round-up) | **Yes** | No | `roundup_settings.enabled=false` + `disabled_at` (proposed c.1 field) is the durable tombstone. |
| HARD_DELETE | N/A (not selected for any operation) | Would require tombstone | Excluded by design. |

**Public replay guarantee:** 24 hours retained; after expiry, a repeat DELETE against an already-archived resource returns the same `204` result (idempotent by outcome, not by cached response). No sensitive resource data is echoed in the `204` body.

---

## Ratification update (R1I-c.0A, 2026-07-16)

All six required roles have ratified the Chief Architect direction — see `docs/audits/phase-1/phase-1b-r1i-c0a-role-ratification-package.md`.

- **API Product Owner:** APPROVED WITH CONDITIONS. Retain `budgetingDeleteBudget`, `budgetingDeleteCategory`, `budgetingDeleteGoal`, `budgetingDisableRoundUp` with archive/soft-delete/disable semantics. Remove `budgetingDeleteRule` from unreleased 4.53.1. Op count 484 → 483 approved, executed in R1I-c.4.
- **Budgeting Domain Owner:** APPROVED WITH CONDITIONS. Archive budgets; user-category soft-delete with system-category protection and reassignment for active dependencies; goal archival preserves history; roundup delete = disable future only; pending ops resolved before goal archival.
- **Database Owner:** APPROVED FOR LOCAL/TEST DESIGN AND MIGRATION PREPARATION ONLY. Additive schema on `budgets`, `budget_categories`, `savings_goals`, `roundup_settings`. No destructive migration; no cascade of financial/historical rows; no production migration under this authorization.
- **Security Officer:** APPROVED WITH CONDITIONS. Auth + tenant + ownership verified before idempotency reservation; client-supplied tenant IDs never authoritative; unauthorised requests produce zero side-effects; no cross-tenant leakage of archived/soft-deleted rows; security + RLS tests mandatory.
- **Compliance and Data Protection Officer:** APPROVED WITH CONDITIONS. Roundup transactions/events, completed contributions, ledger, payment/settlement, reconciliation and regulatory audit records classified NEVER_DELETE. Retention-expiry and personal-data deletion governed outside these handlers.
- **Payments and Ledger Owner:** APPROVED WITH CONDITIONS. No ledger/balance/contribution deletion. Goals with pending transfers/settlements/contributions cannot be archived until resolved. Roundup disable stops new instructions; pending instructions follow documented cancellation/settlement policy; no financial posting side-effects.

Gate: `PHASE 1B-R1I-c.0A PASS — ROLE RATIFICATION COMPLETE`. R1I-c.1 remains NOT AUTHORIZED until a new Chief Architect authorization is issued.

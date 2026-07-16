# Phase 1B-R1I-c.0 — Budgeting Deletion: Implementation Plan (PROPOSED)

**No implementation performed in this slice.** Plan is contingent on the decisions in the contract and semantics documents being approved by the API Product Owner, Budgeting Domain Owner, Database Owner (and, where noted, Security Officer, Compliance Officer, Payments and Ledger Owner).

## Slice R1I-c.1 — Database and policy preparation

Mandatory approvers: Database Owner, Security Officer; Compliance Officer for retention.

Schema additions (all additive, all non-breaking):

| Table | Field / constraint | Purpose |
|---|---|---|
| `budgets` | `archived_at timestamptz NULL`, `archived_by uuid NULL`; extend `status` check to include `'archived'` | SOFT_DELETE tombstone |
| `budget_categories` | `archived_at timestamptz NULL`, `archived_by uuid NULL`, `status text NOT NULL DEFAULT 'active'` with check `('active','archived')` | SOFT_DELETE tombstone |
| `savings_goals` | Extend `status` enum with `'archived'`; add `archived_at`, `archived_by` | STATUS_TRANSITION tombstone |
| `roundup_settings` | `disabled_at timestamptz NULL`, `disabled_by uuid NULL`, `last_enabled_at timestamptz NULL` | DISABLE_FLAG audit trail |

RLS additions:

- All existing SELECT policies must filter out `status='archived'` rows for **read** endpoints unless the request opts in via a query param (`?include_archived=true`) reserved for the owner.
- DELETE handlers use `UPDATE` under `WITH CHECK (consumer_id = auth.uid())` — no new DELETE policy needed.

Indexes:

- `CREATE INDEX ... ON public.budgets (consumer_id, status)`
- Analogous partial indexes for `budget_categories`, `savings_goals`.

## Slice R1I-c.2 — Budgets, categories, category-rule removal

Mandatory approvers: Budgeting Domain Owner, API Product Owner.

Runtime work in `supabase/functions/budgeting-ops/index.ts`:

1. Add `DELETE /budgets/:budgetId` — ownership check, active-reference check (spend > 0 in current period returns `409`), soft-delete via `UPDATE`, cascade `budget_categories.status='archived'`.
2. Add `DELETE /categories/:categoryId` — optional `?reassign_to=` behaviour, soft-delete.
3. Optional `Idempotency-Key` wired via shared `reserveIdempotency` helper (same pattern as R1I-b), scope `{user_id, method:'DELETE', route:RESOURCE, resource_id}`.
4. Tests: ownership isolation, cascade correctness, idempotent replay, RFC 7807 error bodies.

Contract work:

- Remove `budgetingDeleteRule` operation and its path from `public/openapi.json` / `.yaml`.
- Add response additions (`404`, `409`) to the two retained operations.

## Slice R1I-c.3 — Goals and round-up disabling

Mandatory approvers: Payments and Ledger Owner, Budgeting Domain Owner.

Runtime work:

1. Add `DELETE /goals/:goalId` — `STATUS_TRANSITION` to `archived`, cascade `roundup_settings.enabled=false` for the same goal, never touch `roundup_transactions` or `roundup_events`.
2. Add `DELETE /goals/:goalId/round-up` — `UPDATE roundup_settings SET enabled=false, disabled_at=now(), disabled_by=auth.uid()`. Idempotent by outcome.
3. Optional idempotency for both (same pattern as R1I-b, `SET_STATE` semantics for the disable operation).
4. Tests: financial-record preservation, cron observability of the flag, replay stability.

## Slice R1I-c.4 — Combined security, regression and CI closure

Mandatory approvers: Security Officer, DevOps / CI Owner.

- Cross-operation isolation test suite (analogous to `global-accounts-cross-op-isolation-b3.test.ts`).
- Full test suite run (ratchet floor stability check).
- Production gate re-baseline (`G7` failures must decrease from current 5 to 0 after operations are backed OR after removal — either eliminates the gate deficit).
- Rollup 4.44.2 / lockfile hash / API version invariants verified.
- Changelog, SDK regeneration, Postman regeneration.

## Risk register (PROPOSED)

| Risk | Severity | Affected operation | Required mitigation | Owner |
|---|---|---|---|---|
| Accidental hard-delete of financial history | Critical | Goal, Round-up | Enforce SOFT_DELETE / DISABLE_FLAG; no `DELETE FROM` on `roundup_transactions` / `roundup_events` | Payments and Ledger Owner |
| Cascade delete via missing FK | High | All | No FKs exist today; cascade is app-level. Handler must explicitly enumerate children and use `UPDATE` (never `DELETE`). | Database Owner |
| Orphaned records after archive | Medium | Budget → categories | Cascade `status='archived'` on children in same transaction | Budgeting Domain Owner |
| Stale analytics after status change | Medium | Budget, Goal | Read queries filter `status IN ('active')` by default; analytics jobs opt in | Budgeting Domain Owner |
| Unauthorised deletion | High | All | `WITH CHECK (consumer_id = auth.uid())` on every UPDATE; no institution-scope write path | Security Officer |
| Cross-tenant replay via idempotency | High | All | Fingerprint scope must include `user_id` and `RESOURCE` per operation (b.3 pattern) | Security Officer |
| Hard-delete replay leakage | N/A | None (hard-delete not selected) | Excluded by design | — |
| Idempotency expiry (>24h) leading to double-mutation | Low | All | SOFT_DELETE / DISABLE_FLAG are naturally idempotent by outcome; replay after expiry returns same `204` | API Product Owner |
| Scheduled-job continuation after disable | Medium | Round-up | `roundup-process` cron must filter `enabled=true` | Payments and Ledger Owner |
| Removal of system categories | Medium | Category | Introduce `is_system` marker in c.1 OR reject archive when `is_system=true` | Budgeting Domain Owner |
| Deletion of goals with contributions | Critical | Goal | STATUS_TRANSITION never touches contributions | Payments and Ledger Owner |
| Contract/runtime inconsistency (rule) | High | Rule | Option C removal eliminates the mismatch | API Product Owner |

## Required decision table

| Operation | Contract disposition | Approved semantic model | Schema change | Cascade policy | Idempotency model | Approvers |
|---|---|---|---|---|---|---|
| `budgetingDeleteBudget` | PROPOSED: Option B | PROPOSED: SOFT_DELETE | PROPOSED: `archived_at/by`, extend status | Cascade categories = ARCHIVE_TOGETHER; alerts/insights = PRESERVE | Generic 24h; row is durable tombstone | **OUTSTANDING** — API Product Owner, Budgeting Domain Owner, Database Owner |
| `budgetingDeleteCategory` | PROPOSED: Option B | PROPOSED: SOFT_DELETE | PROPOSED: `archived_at/by`, `status` col | Transactions/alerts = DETACH/PRESERVE | Generic 24h | **OUTSTANDING** — as above |
| `budgetingDeleteRule` | PROPOSED: Option C (CONTRACT_REMOVAL) | N/A | None | N/A | N/A | **OUTSTANDING** — API Product Owner, Budgeting Domain Owner |
| `budgetingDeleteGoal` | PROPOSED: Option B | PROPOSED: STATUS_TRANSITION → archived | PROPOSED: extend `status`, `archived_at/by` | round-up = CANCEL_FUTURE_ONLY; contributions/events = NEVER_DELETE | Generic 24h | **OUTSTANDING** — API Product Owner, Budgeting Domain Owner, Payments and Ledger Owner |
| `budgetingDisableRoundUp` | PROPOSED: Option A | PROPOSED: DISABLE_FLAG | PROPOSED: `disabled_at/by`, `last_enabled_at` | Pending settlements = NEVER_DELETE | Generic 24h | **OUTSTANDING** — API Product Owner, Payments and Ledger Owner |

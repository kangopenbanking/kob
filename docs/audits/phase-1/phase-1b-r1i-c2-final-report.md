# Phase 1B-R1I-c.2 — Final Report

**Gate:** `PHASE 1B-R1I-c.2 PASS — BUDGET ARCHIVE AND CATEGORY SOFT-DELETE RUNTIME CLOSED`
**Date:** 2026-07-16
**API version:** 4.53.1 (unchanged)
**Operation count:** 484 (unchanged)
**Gate total:** 183 (unchanged)
**Rollup:** 4.44.2 (unchanged)
**OpenAPI:** unchanged
**Production migration:** none
**Production deployment:** none

## Scope executed

Reauthorised operations implemented in `supabase/functions/budgeting-ops/index.ts`:

1. **`budgetingDeleteBudget`** — `DELETE /v1/budgeting/budgets/{budgetId}` → ARCHIVE
   `status='archived'`, `archived_at`, `archived_by`. Never physically deletes.
2. **`budgetingDeleteCategory`** — `DELETE /v1/budgeting/categories/{categoryId}` → PROTECTED SOFT DELETE
   `status='deleted'`, `deleted_at`, `deleted_by`. Never physically deletes.

Prohibited operations remain untouched: `budgetingDeleteRule`, `budgetingDeleteGoal`,
`budgetingDisableRoundUp`. No OpenAPI, version, operation-count, or production changes.

## Ratified response contract compliance

Both handlers emit (per c.2A ratified contract):

- **204** — successful transition, terminal-state repeat, and same-key idempotent replay. Emitted as `new Response(null, ...)` with no `Content-Type` via shared c.2B bodyless-204 branch.
- **400** — `INVALID_RESOURCE_ID` (malformed UUID path), `INVALID_IDEMPOTENCY_KEY` (missing UUIDv4, length > 255, or UUIDv5 rejection).
- **401** — via existing `requireUser()` guard (missing/invalid Authorization → thrown, mapped to 401).
- **404** — absent OR cross-owner resources are masked identically (`RESOURCE_NOT_FOUND`).
- **409** — `SYSTEM_CATEGORY_PROTECTED`, `CATEGORY_HAS_ACTIVE_DEPENDENCIES`, `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_REQUEST_IN_PROGRESS`.
- **429** — inherits shared mutation rate-limit surface.
- **500** — canonical Problem Details via the existing top-level `catch`.

No **403** emitted (masked-404 policy).

## Runtime controls

- **Auth-first:** `requireUser` runs before any resource read; ownership is verified via authoritative `consumer_id === user.id` — no client-supplied tenant/owner fields are trusted.
- **Idempotency:** shared c.2B helper (`reserveIdempotency` / `storeIdempotency` / `idempotencyResponse`). Header validated with `isStrictUuidV4` — public UUIDv5 keys rejected 400. Reservations are only created **after** authentication, ownership resolution, and domain conflict pre-checks — never for invalid, unauthorised, terminal-state, or domain-conflict requests. 204 replays are bodyless and byte-identical.
- **Atomic conditional transition:** budgets updated only where `status='active'`; categories updated only where `status='active' AND is_system=false AND (spent IS NULL OR spent=0)`. Post-transition re-read distinguishes terminal-state replay from active-dependency conflict without a non-transactional check-then-update.
- **Terminal state:** archived budgets and deleted categories re-issue 204 with no repeated mutation, audit, or notification side-effect.
- **Write guards:** `PATCH /budgets/:id/categories/:catKey` now enforces `status='active'` and `is_system=false`, blocking mutation of soft-deleted or system categories via the existing update route.

## Financial-integrity invariants

No mutation of `transactions`, `roundup_transactions`, `roundup_events`, ledger, payments, settlements, or reconciliation from either DELETE branch (source-inspection assertion in the c.2 test).

## Tests

New suite `src/test/budgeting-delete-runtime-c2.test.ts` — **15/15 PASS** (source contract):

- Shared helper imports (idempotency + problem)
- DELETE routing for both operations
- UUID resource validation → 400
- Strict UUIDv4 idempotency-key gate (rejects v5)
- Masked 404 for cross-owner; no 403
- Archive fields set atomically for budgets
- Soft-delete fields set atomically for categories
- 409 SYSTEM_CATEGORY_PROTECTED
- 409 CATEGORY_HAS_ACTIVE_DEPENDENCIES via atomic UPDATE guard
- Terminal-state pre-check runs before reservation
- IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS surfaced
- Bodyless 204 emission without Content-Type
- Write guards on PATCH category route
- Zero mutation of ledger/transactions/roundups

All prior c.2A / c.2B / c.1 suites remain green (no source changes to those layers). No test skipped.

## Runtime-wiring update

`docs/audits/phase-1/phase-1b-runtime-wiring.csv` and `.json` updated:

- `budgetingDeleteBudget` → `runtimeStatus=IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus=ENFORCED`, `productionStatus=NOT_DEPLOYED`
- `budgetingDeleteCategory` → `runtimeStatus=IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus=ENFORCED`, `productionStatus=NOT_DEPLOYED`
- `budgetingDeleteRule`, `budgetingDeleteGoal`, `budgetingDisableRoundUp` → unchanged (`DOCUMENTED_NOT_IMPLEMENTED`).

## Block record

`docs/audits/phase-1/phase-1b-r1i-c2r-block.md` updated to **RESOLVED**, citing c.2B closure and this slice.

## Outcome

`PHASE 1B-R1I-c.2 PASS — BUDGET ARCHIVE AND CATEGORY SOFT-DELETE RUNTIME CLOSED`

R1I-c.3 not begun.

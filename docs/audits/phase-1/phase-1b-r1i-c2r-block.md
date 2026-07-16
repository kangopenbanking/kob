# Phase 1B-R1I-c.2R — Runtime Implementation Block Record

**Status:** RESOLVED. Runtime implementation completed under Phase 1B-R1I-c.2 (see `phase-1b-r1i-c2-final-report.md`).

## Blocker resolution

- Original blocker: shared idempotency helper could not represent an empty-body `204 No Content` response as required by Section 9 of the c.2R mandate.
- Formally closed by **PHASE 1B-R1I-c.2B PASS — SHARED IDEMPOTENCY 204 REPLAY SUPPORT CLOSED** (see `phase-1b-r1i-c2b-v-final-report.md`).
- c.2B added `isBodylessStatus`, `IdempotencyHit.hasBody`, `storeIdempotency` bodyless normalisation, and a bodyless replay branch in `supabase/functions/_shared/integration-layer/idempotency.ts`. 115/115 targeted tests pass; no persistence migration required; API 4.53.1 / 484 ops / 183 gates preserved.

## Reauthorisation

Runtime implementation was reauthorised on 2026-07-16 for the two operations:

- `budgetingDeleteBudget` — ARCHIVE (status='archived', archived_at, archived_by)
- `budgetingDeleteCategory` — PROTECTED SOFT DELETE (status='deleted', deleted_at, deleted_by; is_system protected; active-dependency conflict)

Prohibited (unchanged): `budgetingDeleteRule`, `budgetingDeleteGoal`, `budgetingDisableRoundUp`, production migration or deployment, OpenAPI changes, version or operation-count changes, R1I-c.3 or later work.

## Implementation reference

- Handler file: `supabase/functions/budgeting-ops/index.ts` (DELETE `/budgets/{budgetId}` and DELETE `/categories/{categoryId}` branches).
- Shared idempotency: `supabase/functions/_shared/integration-layer/idempotency.ts` (unchanged from c.2B).
- Problem details: `supabase/functions/_shared/integration-layer/problem.ts`.
- Runtime-wiring update: `docs/audits/phase-1/phase-1b-runtime-wiring.csv` and `.json` (rows for the two operations updated to `runtimeStatus: IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus: ENFORCED`, `productionStatus: NOT_DEPLOYED`).

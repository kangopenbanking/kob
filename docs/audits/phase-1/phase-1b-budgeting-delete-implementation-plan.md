# Phase 1B — Budgeting Delete Implementation Plan

Sequenced slices. c.2A and c.3A (contract corrections) have completed; c.2 and c.3 runtime work each remain gated on fresh authorization against their respective ratified contracts.

The corrected DELETE response contract for `budgetingDeleteBudget` and `budgetingDeleteCategory` (204 / 400 / 401 / 404 / 409 / 429 / 500 with masked-404 ownership isolation and category-specific 409 conflict codes) is now the truthful contract that any c.2 runtime handler must comply with. See `phase-1b-r1i-c2a-response-decision.md` and `phase-1b-r1i-c2a-final-report.md`.

The equivalent corrected contract for `budgetingDeleteGoal` and `budgetingDisableRoundUp` (204 / 400 / 401 / 404 / 409 / 429 / 500 with masked-404 owner/tenant isolation, goal-specific `GOAL_HAS_PENDING_FINANCIAL_OPERATIONS` / `GOAL_STATE_CONFLICT` conflict codes and round-up-specific `ROUNDUP_HAS_PENDING_INSTRUCTIONS` / `ROUNDUP_STATE_CONFLICT` conflict codes) is the truthful contract that any c.3 runtime handler must comply with. See `phase-1b-r1i-c3a-response-decision.md` and `phase-1b-r1i-c3a-final-report.md`.

| Slice  | Scope                                                                                              | Status                |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------- |
| c.1    | Additive schema, indexes, CHECK constraints, RLS design, migration tests, rollback prep (local/test) | Completed             |
| c.2A   | Contract correction — 400/401/404/409/500 (+429) on the two budget/category DELETE ops, masked-404 semantics, category-specific 409 codes | Completed             |
| c.2    | Implement 2 DELETE handlers (`budgetingDeleteBudget`, `budgetingDeleteCategory`) against the corrected contract, with idempotency + audit | Completed (local/test) |
| c.3A   | Contract correction — 400/401/404/409/500 (+429) on `budgetingDeleteGoal` and `budgetingDisableRoundUp`, masked-404 semantics, goal- and round-up-specific 409 codes | Completed             |
| c.3R   | Implement `budgetingDeleteGoal` and `budgetingDisableRoundUp` runtime handlers against the c.3A ratified contract, with idempotency + audit + instruction-creation gate | Completed (local/test) |
| c.4    | Remove `budgetingDeleteRule` from OpenAPI (unreleased contract), version reconciliation             | Awaits authz          |


## Guardrails
- No production migration in c.1.
- No `category_rules` table at any slice.
- All financial-history tables remain NEVER_DELETE across all slices.
- Handlers (c.3) must use `service_role` for archive/delete transitions; ordinary RLS blocks direct client writes to audit fields.

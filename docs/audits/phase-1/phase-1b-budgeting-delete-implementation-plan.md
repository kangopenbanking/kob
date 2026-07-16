# Phase 1B — Budgeting Delete Implementation Plan

Sequenced slices. c.2A (contract correction) has completed; c.2 runtime work remains gated on fresh authorization.

The corrected DELETE response contract for `budgetingDeleteBudget` and `budgetingDeleteCategory` (204 / 400 / 401 / 404 / 409 / 429 / 500 with masked-404 ownership isolation and category-specific 409 conflict codes) is now the truthful contract that any c.2 runtime handler must comply with. See `phase-1b-r1i-c2a-response-decision.md` and `phase-1b-r1i-c2a-final-report.md`.

| Slice  | Scope                                                                                              | Status                |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------- |
| c.1    | Additive schema, indexes, CHECK constraints, RLS design, migration tests, rollback prep (local/test) | Completed             |
| c.2A   | Contract correction — 400/401/404/409/500 (+429) on the two DELETE ops, masked-404 semantics, category-specific 409 codes | Completed             |
| c.2    | Implement 2 DELETE handlers (`budgetingDeleteBudget`, `budgetingDeleteCategory`) against the corrected contract, with idempotency + audit | Awaits fresh authz    |
| c.3    | Implement 4 retained runtime handlers with idempotency + audit; wire tests                          | Awaits authz          |
| c.4    | Remove `budgetingDeleteRule` from OpenAPI (unreleased contract), version reconciliation             | Awaits authz          |

## Guardrails
- No production migration in c.1.
- No `category_rules` table at any slice.
- All financial-history tables remain NEVER_DELETE across all slices.
- Handlers (c.3) must use `service_role` for archive/delete transitions; ordinary RLS blocks direct client writes to audit fields.

# Phase 1B — Budgeting Delete Implementation Plan

Sequenced slices. Only c.1 is authorized in this session.

| Slice  | Scope                                                                                              | Status                |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------- |
| c.1    | Additive schema, indexes, CHECK constraints, RLS design, migration tests, rollback prep (local/test) | **In progress**       |
| c.2    | Execute migration + RLS in test → cloud; regenerate types                                          | Awaits fresh authz    |
| c.3    | Implement 4 retained runtime handlers with idempotency + audit; wire tests                          | Awaits authz          |
| c.4    | Remove `budgetingDeleteRule` from OpenAPI (unreleased contract), version reconciliation             | Awaits authz          |

## Guardrails
- No production migration in c.1.
- No `category_rules` table at any slice.
- All financial-history tables remain NEVER_DELETE across all slices.
- Handlers (c.3) must use `service_role` for archive/delete transitions; ordinary RLS blocks direct client writes to audit fields.

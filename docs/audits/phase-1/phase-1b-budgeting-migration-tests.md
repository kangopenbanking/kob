# Phase 1B-R1I-c.1 — Migration Test Plan (LOCAL/TEST)

Tests are **defined**, to be executed in the authorized c.2 slice against a local database. No test is skipped.

| # | Area | Assertion |
|---|------|-----------|
| 1 | Apply-clean | Migration applies from empty schema without error |
| 2 | Apply-existing | Migration applies against pre-migration schema snapshot |
| 3 | Row preservation | `budgets`/`budget_categories`/`savings_goals`/`roundup_settings` row counts unchanged post-migration |
| 4 | Status preservation | Existing `budgets.status` and `savings_goals.status` values retained |
| 5 | Financial history | `roundup_transactions`, `roundup_events` row counts identical post-migration |
| 6 | No cascade | `\d` output shows no new `ON DELETE CASCADE` on target tables |
| 7 | Columns present | `archived_at/by`, `deleted_at/by`, `disabled_at/by`, `is_system`, `status` exist as designed |
| 8 | No duplication | Column names are unique per table; no shadow `archived` variants added |
| 9 | CHECK reject | `INSERT ... status='banana'` rejected by CHECK on all three tables |
| 10 | CHECK accept | `status='active'` and each approved value accepted |
| 11 | RLS cross-tenant | User A cannot SELECT User B's budget/category/goal/roundup_settings |
| 12 | RLS forge archive | User A cannot UPDATE own budget setting `archived_by=self` or `status='archived'` |
| 13 | RLS forge delete | User A cannot UPDATE own category setting `deleted_by=self` or `status='deleted'` |
| 14 | System protection | User A cannot UPDATE a category with `is_system=true` |
| 15 | Historical read | Owner SELECT still returns archived budgets and soft-deleted categories |
| 16 | Terminal mutation | UPDATE of archived budget/goal by owner is blocked by RLS |
| 17 | Backend transition | `service_role` can set `status='archived'` and `archived_by=<uuid>` |
| 18 | Anonymous denied | Unauthenticated client receives 0 rows / permission error for all four tables |
| 19 | Rollback syntax | Down SQL parses and applies in a scratch database |
| 20 | Absence | `information_schema.tables` shows no `category_rules` |
| 21 | NEVER_DELETE lock | `roundup_transactions`/`roundup_events` row counts stable across up+down |

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

---

## R1I-c.1F closure banner

- **Canonical artifact:** `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql`
- **SHA-256:** `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`
- **Byte-identical to** the c.1E harness input (`docs/audits/phase-1/executable/01_additive_migration.sql`).
- **Packaging model:** B (pending-migrations directory; not auto-applied by Lovable Cloud).
- **Managed PG:** 17.6. Compatible with tested syntax.
- **Production promotion:** requires Database Owner + Security Officer + Compliance/DPO + Release Manager + Chief Architect approval (see `supabase/pending-migrations/phase-1/README.md`).

---

## R1I-c.1G re-execution evidence

- 21/21 c.1E migration + integrity assertions re-run against byte-identical
  canonical SQL (SHA-256 `53a7228f…cd0e76bf`) — ALL PASS, 0 skipped.
- 12/12 new c.1G auth/RLS assertions (G0, G-NEG, G1–G10) executed under
  non-superuser role switching + JWT claim GUCs — ALL PASS.
- Faithful harness under `/tmp/c1g/` (00_auth_shim, 01_pre, 02_migration
  [checksum-verified copy of canonical], 03_tests, 04_auth_rls_tests).

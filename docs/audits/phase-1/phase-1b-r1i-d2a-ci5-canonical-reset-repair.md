# Phase 1B — R1I-d.2A-CI5 — Canonical Clean-Reset Reproducibility Repair

## Failure

Run ID `29821174384` (job `88603900913`, head SHA
`fbf4ec5c37804e34ba30f54e1f92366763a1ed67`) started the disposable local
Supabase stack successfully (CI 2.101.0) and reached canonical migration
execution. It then failed while applying
`supabase/migrations/20260228221124_9be0b2a5-a8a1-47e3-b9eb-27ceb9be7997.sql`
with:

- **SQLSTATE**: `23503`
- **Constraint**: `fee_structures_institution_id_fkey`
- **Missing parent**: `institutions.id = f493095b-037a-40cf-82bc-3a3ab74550dd`

Root cause: the historical migration inserts a platform-specific
`fee_structures` row for the Kang platform institution using an unconditional
`VALUES` clause. That parent row exists in the Lovable-managed database but
does not exist on a completely fresh disposable Postgres instance.

## Repair model

Parent-aware conditional platform-data insertion. The `VALUES` insert is
replaced with `INSERT INTO ... SELECT ... FROM public.institutions WHERE
id = <platform-uuid> AND NOT EXISTS (...)`. Behaviour:

- Managed database (parent present): inserts exactly one withdrawal fee row,
  same as before, and is idempotent under replays.
- Disposable clean database (parent absent): the `SELECT` produces zero rows;
  the insert is a safe no-op; foreign key enforcement is untouched.

Explicitly not done:

- No synthetic institution row inserted.
- No writes to `auth.users`.
- No foreign key drop, disable, or `session_replication_role` override.
- No `EXCEPTION WHEN` / error swallowing.
- No hosted or Lovable-managed Supabase access, tokens, or credentials.
- No `supabase login`, `link`, `db pull`, `db push`, or `functions deploy`.

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260228221124_9be0b2a5-a8a1-47e3-b9eb-27ceb9be7997.sql` | `VALUES` → parent-aware `INSERT ... SELECT` with `NOT EXISTS` idempotency guard. Transaction-type constraint alteration unchanged. |
| `src/test/phase1b-d2a-ci5-migration-reproducibility.test.ts` | New static guard asserting the 12 required properties. |
| `.github/workflows/phase1b-r1i-d2a-verification.yml` | Comment-only header update to trigger the push-restricted rerun. |
| `docs/audits/phase-1/phase-1b-r1i-d2a-ci5-canonical-reset-repair.md` | This report. |

## Invariants preserved

- API version: **4.53.1**
- Release status: **Unreleased**
- Operation count: **483**
- Gate total: **176**
- Rollup: **4.44.2**
- CI4 controls intact: Supabase CLI pin `2.101.0`, corrected service exclusions,
  Docker startup preflight, startup diagnostics, `set -o pipefail`, fail-closed
  teardown, evidence upload with `if: always()`, `workflow_dispatch`, temporary
  push trigger, stale-evidence `.gitignore` entries.
- Historical migration `20260228155758_06c05a21-a1fc-4959-b202-925b3d006933.sql`
  untouched — its zero-row UPDATE remains safe on a clean database.

## Result

`PHASE 1B-R1I-d.2A FAIL — CANONICAL RESET REPAIR RERUN REQUIRED`

# Phase 1B — R1I-d.2A-CI6 — pg_cron Extension Schema Reproducibility Repair

## Failure

Run ID `29825670051` (job `88618337479`, head SHA
`b6651459cacb0b4a25d7fce037c5a57d5fcd8988`) confirmed CI5's parent-aware
`fee_structures` repair. The clean migration chain executed successfully past
`20260228221124_9be0b2a5-a8a1-47e3-b9eb-27ceb9be7997.sql` and continued through
subsequent migrations until it reached
`supabase/migrations/20260320103051_80a328a6-faaa-4d41-9e10-6f48f9579881.sql`,
where it failed with:

- **SQLSTATE**: `2BP01` (dependent privileges exist)
- **Failing statement**: `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;`

## Root cause

The earlier canonical migration
`supabase/migrations/20251031200554_bc793500-1386-41f4-95b1-08a7718b548c.sql`
already installs `pg_cron` in the `extensions` schema. The later migration
attempted to (re-)install `pg_cron` in `pg_catalog`, which Postgres refuses
because dependent privileges exist on the already-installed extension.

## Repair model

Existence-guarded creation. The unconditional `CREATE EXTENSION ... WITH SCHEMA
pg_catalog` is replaced with a `DO $$ ... END $$` block that consults
`pg_catalog.pg_extension` and only creates `pg_cron` (in the `extensions`
schema) when it is absent.

Behaviour:

- Managed/Lovable database (pg_cron already in extensions): the guard sees the
  existing row and skips creation. Nothing is relocated, dropped, or altered.
- Disposable clean database: the guard finds nothing, creates `pg_cron` in the
  `extensions` schema, and subsequent statements proceed.

Explicitly not done:

- No `ALTER EXTENSION pg_cron SET SCHEMA`.
- No `DROP EXTENSION pg_cron`.
- No `CASCADE`.
- No privilege removal, role/grant removal, or exception swallowing.
- No `session_replication_role`.
- No hosted or Lovable-managed Supabase access, tokens, or credentials.
- No `supabase login`, `link`, `db pull`, `db push`, or `functions deploy`.

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260320103051_80a328a6-faaa-4d41-9e10-6f48f9579881.sql` | `CREATE EXTENSION ... pg_catalog` → existence-guarded `DO $$` block that creates `pg_cron` in `extensions` only when absent. `pg_net` line unchanged. |
| `src/test/phase1b-d2a-ci6-extension-reproducibility.test.ts` | New static guard (14 assertions). |
| `.github/workflows/phase1b-r1i-d2a-verification.yml` | Static suite now explicitly runs the CI5 and CI6 tests; step renamed. Header comment for CI6. |
| `docs/audits/phase-1/phase-1b-r1i-d2a-ci6-pg-cron-schema-repair.md` | This report. |

## Invariants preserved

- API version: **4.53.1**
- Release status: **Unreleased**
- Operation count: **483**
- Gate total: **176**
- Rollup: **4.44.2**
- CI2–CI5 controls intact: Supabase CLI pin `2.101.0`, disposable Docker
  stack, corrected service exclusions, Docker preflight, startup diagnostic
  collection, `set -o pipefail`, fail-closed teardown, evidence upload with
  `if: always()`, `workflow_dispatch`, restricted push trigger, CI5 fee
  migration repair, generated-evidence `.gitignore` entries.
- Earlier migration `20251031200554_bc793500-...` untouched — it retains the
  authoritative `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions`.

## Result

`PHASE 1B-R1I-d.2A FAIL — PG_CRON SCHEMA REPAIR RERUN REQUIRED`

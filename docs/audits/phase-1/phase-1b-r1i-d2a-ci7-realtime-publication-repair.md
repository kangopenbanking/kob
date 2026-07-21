# PHASE 1B-R1I-d.2A-CI7 — Realtime Publication Idempotency Sweep

## Run

- GitHub Actions Run ID (failing baseline): 29827528739
- Job ID: 88624214773
- Head SHA at failure: 3c7b6be1d0ba2059fb6854375a65d4ab1a9626c7

## Confirmed progress

- CI5 canonical parent-aware fee_structures repair: **PASSED**.
- CI6 pg_cron extension schema repair: **PASSED**.
- Clean canonical migration chain advanced past `20260320103051_80a328a6-faaa-4d41-9e10-6f48f9579881.sql` and continued executing through `20260326161447_328c5e0b-d0cd-4ad3-a13d-f6f4c79a4733.sql`.

## Failure

```
SQLSTATE 42710
relation "account_balances" is already member of publication "supabase_realtime"
```

## Root cause

The earlier authoritative migration
`supabase/migrations/20260301020025_76701b98-c45c-476d-a944-2918355c1ccc.sql`
adds `public.account_balances` and `public.transactions` to publication
`supabase_realtime`. The later migration
`supabase/migrations/20260326161447_328c5e0b-d0cd-4ad3-a13d-f6f4c79a4733.sql`
issued the same two `ALTER PUBLICATION ... ADD TABLE` statements again with
no membership check, causing SQLSTATE 42710 on any clean-reset run that
executes the migration chain from scratch.

Rather than patch only `account_balances`, CI7 performs a repository-wide
sweep for the same defect class across every migration file.

## Repository-wide duplicate-membership manifest

Audit script: `scripts/phase1b-d2a/audit-realtime-publications.mjs`
Output: `realtime-publication-audit.json`

- Total `ALTER PUBLICATION ... ADD TABLE` statements: **43**
- Unique `publication|schema|table` memberships: **37**
- Duplicate memberships: **4**
- Later unguarded duplicates remaining after CI7: **0**

| # | pub \| schema \| table | Earliest authoritative | Later occurrences |
|---|---|---|---|
| 1 | supabase_realtime \| public \| account_balances | 20260301020025_...sql | 20260326161447_...sql (unguarded → **CI7 guarded**) |
| 2 | supabase_realtime \| public \| transactions | 20260301020025_...sql | 20260326161447_...sql (unguarded → **CI7 guarded**) |
| 3 | supabase_realtime \| public \| support_messages | 20260321040418_...sql | 20260422011413_...sql (already exception-safe, unchanged), 20260423233715_...sql (unguarded → **CI7 guarded**) |
| 4 | supabase_realtime \| public \| support_conversations | 20260321040418_...sql | 20260422011413_...sql (already exception-safe, unchanged), 20260423233715_...sql (unguarded → **CI7 guarded**) |

## Exact migrations changed

Only later duplicate occurrences were rewritten; earliest authoritative
migrations were left byte-identical.

1. `supabase/migrations/20260326161447_328c5e0b-d0cd-4ad3-a13d-f6f4c79a4733.sql`
   - Both `ALTER PUBLICATION ... ADD TABLE` statements wrapped in
     `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND
     tablename = '<table>') THEN ALTER PUBLICATION ... END IF; END $$;`.
2. `supabase/migrations/20260423233715_c3ab46fd-f9db-4b35-9a1c-0ca4e49e19b5.sql`
   - Trailing `ALTER PUBLICATION ... ADD TABLE public.support_messages;` and
     `public.support_conversations;` statements converted to the same
     guarded-membership pattern.

## Membership integrity

- No publication membership was removed.
- No publication was dropped or recreated.
- No `ALTER PUBLICATION ... DROP TABLE` was introduced.
- No `REPLICA IDENTITY` change was introduced in patched blocks.
- No RLS change was introduced in patched blocks.
- No exception swallowing was introduced (`EXCEPTION WHEN duplicate_object`
  never appears in CI7-added regions).
- No `session_replication_role` toggling.
- No dynamic `EXECUTE` used.

## Lovable-managed Supabase access

None. The audit script never opens a DB connection and never reads
`SUPABASE_ACCESS_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY`. No `supabase login`,
`supabase link`, `db pull`, or `db push` verbs were introduced.

## Verification

- `node scripts/phase1b-d2a/audit-realtime-publications.mjs` → exit 0, 0 later
  unguarded duplicates.
- `src/test/phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts`:
  16/16 PASS.
- Combined CI5 + CI6 + CI7 static suites: **42/42 PASS**.

## Workflow triggering

`.github/workflows/phase1b-r1i-d2a-verification.yml` header comment updated
with `# CI7 realtime publication idempotency sweep`. Existing restricted
`push` trigger on that path preserved, so the correction commit will
automatically dispatch the next verification run.

## CI7A — strict audit correction (supersedes initial CI7)

The initial CI7 sweep incorrectly classified an `EXCEPTION WHEN
duplicate_object` block wrapping a later `ALTER PUBLICATION ... ADD TABLE`
as acceptable protection. This produced a false-positive audit result:
`guarded=false` and `exceptionSwallowed=true` counted as compliant while
`laterUnguardedRemaining=0` was still reported. CI7A repairs this.

### Corrections applied

- **Migration 20260422011413** (`support_conversations`, `support_messages`)
  had two exception-swallowing later duplicates. Both blocks were replaced
  with explicit `pg_catalog.pg_publication_tables` membership guards. No
  other SQL in the migration was touched.
- **Audit policy** (`scripts/phase1b-d2a/audit-realtime-publications.mjs`)
  now treats every later occurrence with `guarded !== true` as unguarded.
  `exceptionSwallowed` is informational only. The script exits non-zero
  when any later duplicate is unguarded OR when any later duplicate uses
  exception swallowing instead of a membership guard. A `--self-check`
  flag runs an in-memory synthetic exception-swallowing later duplicate
  and asserts the audit rejects it.
- **Generated evidence** `realtime-publication-audit.json` was removed from
  the repository. Both `.json` and `.log` outputs remain listed in
  `.gitignore` and are produced fresh during each GitHub Actions run.
- **Workflow** step `Realtime publication audit (CI7A)` now deletes any
  prior audit output before invocation, uses `set -euo pipefail`, and
  verifies both output files are non-empty via `test -s`.
- **Static tests** in
  `src/test/phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts`
  now assert every later duplicate is membership-guarded, no later block
  uses exception swallowing, migration 20260422011413 uses
  `pg_publication_tables` for both support tables, `realtime-publication-
  audit.json` is not Git-tracked, the workflow deletes prior output and
  verifies non-empty results, and CI5/CI6/CI7 suites remain explicitly
  executed.

### Final manifest after CI7A

| Metric                                     | Value |
| ------------------------------------------ | ----- |
| Duplicate memberships                      | 4     |
| Later duplicate occurrences                | 6     |
| Later membership-guarded occurrences       | 6     |
| Later exception-swallowed occurrences      | 0     |
| Later unguarded occurrences remaining      | 0     |
| Committed generated audit JSON             | 0     |

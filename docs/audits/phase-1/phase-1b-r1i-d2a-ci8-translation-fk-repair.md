# Phase 1B — R1I-d.2A-CI8 — Translation Child-Data FK Reproducibility Repair

## Context

- GitHub Actions run: 29834231468
- Job: 88646351367
- Tested SHA: a81efcf1adb2d431263fbf1a06dda91c47f9a225
- Canonical migration chain reached: `supabase/migrations/20260421020231_f64212df-1027-4427-8dad-407e633cc667.sql`
- Failure: `SQLSTATE 23503` — `insert or update on table "translation_values" violates foreign key constraint "translation_values_string_id_fkey"`
- Missing parent `translation_strings.id`: `9bcf7c48-77db-4113-a7ec-79be2ce40b07`

## Root cause

Two historical French-translation migrations used unconditional
`INSERT INTO public.translation_values (...) VALUES (...)` statements against
fixed UUIDs that exist in the Lovable-managed database but are not created by
the canonical repository migration chain. On a clean disposable reset these
UUIDs have no parent row in `public.translation_strings`, so the FK constraint
`translation_values_string_id_fkey` fires (SQLSTATE 23503).

Both migrations shared the same defect class and are repaired together:

1. `supabase/migrations/20260421020231_f64212df-1027-4427-8dad-407e633cc667.sql` — 60 rows.
2. `supabase/migrations/20260421020433_9d66305b-5e2e-470f-9ffa-e80a37843212.sql` — 51 rows.

## Repair

Each migration was converted to a parent-aware `INSERT ... SELECT` using a CTE
`source (string_id, language, value, is_auto_translated, translated_at)` that
preserves every original UUID and French value verbatim. The child insert now
`INNER JOIN`s `public.translation_strings AS parent ON parent.id = source.string_id`,
so rows without a valid parent are skipped silently on a clean disposable
reset. When a parent row exists (Lovable-managed environment or after later
seeding) the row is inserted or upserted exactly as before.

```sql
WITH source (string_id, language, value, is_auto_translated, translated_at) AS (
  VALUES
    -- every original row, preserved verbatim
)
INSERT INTO public.translation_values (string_id, language, value, is_auto_translated, translated_at)
SELECT source.string_id, source.language, source.value, source.is_auto_translated, source.translated_at
FROM source
INNER JOIN public.translation_strings AS parent
  ON parent.id = source.string_id
ON CONFLICT (string_id, language) DO UPDATE SET
  value = EXCLUDED.value,
  translated_at = now(),
  is_auto_translated = true;
```

## Row preservation

- First migration (`20260421020231`): **60/60** UUID+French-value rows preserved.
- Second migration (`20260421020433`): **51/51** UUID+French-value rows preserved.
- No translation text or UUID was removed, renamed or invented.
- No synthetic `translation_strings` parent rows were introduced.

## Safety envelope

- Foreign key `translation_values_string_id_fkey` remains fully enforced.
- No `session_replication_role`, `SET CONSTRAINTS ALL DEFERRED`, trigger
  disable, `TRUNCATE`, exception swallowing or `foreign_key_violation` catch
  was introduced.
- No writes to `auth.users` and no managed-Supabase access were introduced.
- Production behaviour is unchanged when the referenced parent
  `translation_strings` rows exist: rows are still inserted (or upserted with
  the same conflict update behaviour).

## Static guard

New test file: `src/test/phase1b-d2a-ci8-translation-fk-reproducibility.test.ts`.
The suite asserts row counts (60 / 51), UUID preservation, French-value
preservation, CTE + INNER JOIN shape, `ON CONFLICT (string_id, language)`
preservation, forbidden patterns (direct `VALUES` inserts into
`translation_values`, synthetic `translation_strings` inserts, disabled
constraints, exception swallowing) and workspace-wide absence of the unsafe
pattern in any migration. It also asserts that
`20260420153458_3b036d24-281b-480a-a531-1d2208bdac04.sql` (the pre-existing
safe migration) is untouched and still selects from
`public.translation_strings`, and that the CI workflow explicitly runs the
CI5, CI6, CI7 and CI8 tests.

## Workflow

`.github/workflows/phase1b-r1i-d2a-verification.yml` static-suite step renamed
to `Static infrastructure suite (guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8)`
with the CI8 test file added to the explicit `npx vitest run` list. Header
comment updated with `# CI8 translation child-data FK reproducibility sweep`
so the restricted push trigger fires. All previously-established controls
(Supabase CLI 2.101.0, disposable Docker stack, canonical reset process, CI5
fee repair, CI6 pg_cron repair, CI7/CI7A publication guards, strict audit,
fresh evidence generation, pipefail enforcement, fail-closed teardown,
evidence upload, workflow_dispatch, restricted push trigger) are preserved.

## Scope

Files touched (only permitted files):

- `supabase/migrations/20260421020231_f64212df-1027-4427-8dad-407e633cc667.sql`
- `supabase/migrations/20260421020433_9d66305b-5e2e-470f-9ffa-e80a37843212.sql`
- `src/test/phase1b-d2a-ci8-translation-fk-reproducibility.test.ts`
- `.github/workflows/phase1b-r1i-d2a-verification.yml`
- `docs/audits/phase-1/phase-1b-r1i-d2a-ci8-translation-fk-repair.md`

Preserved:

- API version: 4.53.1 (Unreleased)
- Operation count: 483
- Gate total: 176
- Rollup: 4.44.2

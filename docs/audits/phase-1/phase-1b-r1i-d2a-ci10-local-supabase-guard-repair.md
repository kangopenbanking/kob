# Phase 1B — R1I-d.2A-CI10 — Local Supabase postgres guard attestation

## Context

- GitHub Actions run: 29837600240 (job 88657840271)
- Tested SHA: `3cef7592fd0754ebe7ef32e09301a0e6543a6709`
- Canonical migration startup: **PASS** (first run in which the local
  Supabase stack and canonical migration chain completed cleanly)
- Failure moved to the `Environment guard (fail-closed)` step:
  `GUARD_PROTECTED_DATABASE_NAME` — the local Supabase CLI exposes its
  disposable PostgreSQL as `postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
  and the existing guard globally protects the database name `postgres`.

## Diagnosis

The general protection of the `postgres` database name is correct for any
ordinary or hosted PostgreSQL connection. It only conflicts with the
explicitly authorised disposable local Supabase CLI stack used inside the
Phase 1B R1I-d.2A isolated workflow, where loopback ports 54321 (API) and
54322 (PostgreSQL) belong to a throwaway container set that GitHub Actions
tears down at job end.

## Change — narrow, fail-closed exception

`scripts/phase1b-d2a/guard.mjs`:

- Introduced `D2A_LOCAL_SUPABASE_STACK` marker.
- A database name of `postgres` is accepted only when **every** condition
  holds:
  1. `KOB_D2A_DISPOSABLE_ENVIRONMENT === "true"`
  2. `D2A_LOCAL_SUPABASE_STACK === "true"`
  3. `CI === "true"`
  4. `GITHUB_ACTIONS === "true"`
  5. PostgreSQL host ∈ {`127.0.0.1`, `localhost`, `::1`}
  6. PostgreSQL port === `54322`
  7. PostgreSQL database === `postgres`
  8. `SUPABASE_URL` is a valid URL
  9. `SUPABASE_URL` protocol === `http:`
  10. `SUPABASE_URL` host ∈ {`127.0.0.1`, `localhost`, `::1`}
  11. `SUPABASE_URL` port === `54321`
- Any missing condition returns `GUARD_LOCAL_SUPABASE_ATTESTATION_FAILED`.
- `postgres` is not removed from `PROTECTED_DB_NAMES`; the exception is
  scoped only to the attested local-Supabase branch.
- Evidence extended with `localSupabaseMarker`, `localSupabaseAttested`,
  `supabaseApiHost`, `supabaseApiPort`. No credentials, keys, secrets, or
  complete URLs are printed.

## Workflow (`.github/workflows/phase1b-r1i-d2a-verification.yml`)

- Header comment `# CI10 local Supabase postgres database guard attestation`.
- Job-level env `D2A_LOCAL_SUPABASE_STACK: "true"` (present only in this
  isolated workflow).
- `Environment guard (fail-closed)` step now runs with `set -euo pipefail`,
  tees output to `environment-guard.log`, and asserts non-empty log.
- `environment-preflight.json` records only non-secret attestation fields:
  host, port, database, apiHost, apiPort, disposableMarker,
  localSupabaseMarker, secretPresent.
- `environment-guard.log` added to the evidence artifact upload.
- Static suite renamed to `guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8 +
  CI9 + CI10` and now runs the new CI10 test file.
- Restricted push trigger and `workflow_dispatch` preserved.

## Static tests

`src/test/phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts`
covers all 22 required assertions plus a guard-file-exists check
(23 tests). Combined with the existing infra guard suite (14 tests) the
guard tier is 37/37 PASS.

## Invariants preserved

- API version 4.53.1 (Unreleased)
- Operation count 483
- Gate total 176
- Rollup 4.44.2
- Supabase CLI 2.101.0
- No production or managed Supabase access
- CI9A early evidence cleanup step retained
- No migration file changed
- No OpenAPI, gateway runtime, pagination adapter, pending migration, or
  package/dependency change
- Teardown remains `if: always()` and fail-closed

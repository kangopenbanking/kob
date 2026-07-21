# Phase 1B — R1I-d.2A-CI10 / CI10A — Local Supabase postgres guard attestation

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

## CI10 — narrow, fail-closed exception

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

## CI10A — IPv6 loopback hostname normalisation

Initial CI10 compared `URL.hostname` directly against the string `"::1"`.
Node's WHATWG URL parser returns bracketed IPv6 hostnames:

```
new URL("postgres://u:p@[::1]:54322/postgres").hostname // "[::1]"
new URL("http://[::1]:54321").hostname                  // "[::1]"
```

The claimed IPv6 loopback attestation therefore never matched, and CI10
would have rejected a fully-attested IPv6 local Supabase stack.

CI10A introduces a single `normalizeHostname(value)` helper that strips
matched leading `[` / trailing `]` and lowercases the result. It is applied
immediately after parsing the PostgreSQL URL (producing `hostLower`) and to
the Supabase API URL (producing `normalizedApiHost`). Every downstream
check now consumes the normalised value:

- `LOCAL_HOSTS` membership
- loopback set membership
- private / public host regex
- forbidden host substring scan
- local-Supabase attestation
- redaction and evidence output

Behavioural notes:

- IPv4 (`127.0.0.1`, `10.x`, …) and `localhost` behaviour is unchanged —
  they were never bracketed, and lowercasing is idempotent.
- Only IPv6 loopback (`::1`) is accepted. URLs must still use valid IPv6
  bracket syntax when they appear in `D2A_HARNESS_PGURL` or `SUPABASE_URL`.
- Private (`fd00::/8`), link-local (`fe80::/10`), public and managed IPv6
  hosts remain rejected — they never appear in `LOCAL_HOSTS` and are not
  matched by the IPv4 private regex.
- Evidence records `::1` (normalised), never `[::1]`.
- No workflow security control was weakened. `PROTECTED_DB_NAMES`,
  `FORBIDDEN_HOST_SUBSTRINGS`, `FORBIDDEN_PORT`, transaction-pooler
  rejection, secret hygiene and the disposable marker requirement are all
  preserved verbatim.

## Workflow (`.github/workflows/phase1b-r1i-d2a-verification.yml`)

- Header comments: `# CI10 local Supabase postgres database guard attestation`
  followed by `# CI10A IPv6 loopback hostname normalisation`.
- Job-level env `D2A_LOCAL_SUPABASE_STACK: "true"` (present only in this
  isolated workflow — enforced by CI10 test 19).
- `Environment guard (fail-closed)` step runs with `set -euo pipefail`,
  tees output to `environment-guard.log`, and asserts non-empty log.
- `environment-preflight.json` records only non-secret attestation fields:
  host, port, database, apiHost, apiPort, disposableMarker,
  localSupabaseMarker, secretPresent.
- `environment-guard.log` is included in the evidence artifact upload.
- Static suite `guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8 + CI9 + CI10`
  runs the CI10 test file (now including CI10A IPv6 cases).
- Restricted push trigger and `workflow_dispatch` preserved.

## Static tests

`src/test/phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts`
covers the 22 original CI10 assertions, a guard-file-exists check, plus
CI10A additions:

- positive IPv6 loopback acceptance (attested, evidence normalised, no
  passwords / complete URLs leak)
- rejection of PostgreSQL `[fd00::1]`
- rejection of Supabase API `[fd00::1]`
- rejection of mixed loopback / non-loopback pairings (PG `[::1]` + API
  `10.0.0.1`, and API `[::1]` + PG `10.0.0.1`)
- workflow-marker scan asserts `D2A_LOCAL_SUPABASE_STACK` appears in no
  other `.github/workflows/*.yml` file

Combined guard-tier: infra-guard 14 + CI10 28 = **42/42 PASS**.

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

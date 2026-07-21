# Phase 1B — R1I-d.2A-CI12 — Edge Runtime Cursor-Secret Propagation Repair

## Run under repair

- Run ID: 29850107687
- Job ID: 88700516840
- Head SHA: 6b0ba4a9cd23d24532a0472116cc31cb7a1cad67

## Preserved evidence from CI11

- CI11 representative fixture: PASS.
- Eight local Auth users created via local Supabase Auth Admin API.
- Auth-user parent coverage: PASS.
- Merchant-role trigger coverage: PASS (8 rows, 0 duplicates).
- 4,000 rows loaded into each of the four target child tables.
- Query-plan capture (before): PASS.
- Online concurrent-index rebuild: PASS.
- Query-plan capture (after): PASS — all four approved pagination indexes
  selected for the four canonical operations.

## First failing step

`Runtime harness (unmasked; four canonical operations + security + CORS)`.

## Exact failure

The GitHub runner shell environment contained `KOB_CURSOR_HMAC_SECRET`
(preflight recorded `secretPresent: true`). However `runtime-serve.log`
reported:

```
PaginationConfigurationError: KOB_CURSOR_HMAC_SECRET is not configured
```

The authenticated readiness probe therefore never returned HTTP 200.

## Root cause

`supabase functions serve gateway-query --no-verify-jwt` starts the local
Deno-based Edge Runtime as a child process, but the Supabase CLI does NOT
forward arbitrary parent-shell environment variables into that runtime.
Custom variables — including `KOB_CURSOR_HMAC_SECRET` — reach the runtime
only when supplied via `--env-file <file>`.

Parent shell presence is insufficient; the runtime read
`Deno.env.get("KOB_CURSOR_HMAC_SECRET")` and observed `undefined`,
triggering the pagination foundation's fail-closed
`PaginationConfigurationError`.

## Corrective action

CI12 introduces a current-run ephemeral `--env-file`:

1. Before serving the function, the workflow writes
   `$RUNNER_TEMP/kob-d2a-edge-runtime.env` with `umask 077` and
   `chmod 600`. The file contains a single line:
   `KOB_CURSOR_HMAC_SECRET=<minted secret>`.
2. The Edge Function is now invoked with
   `--env-file "$D2A_FUNCTION_ENV_FILE"`. The runtime therefore observes
   the same 32-byte hex secret used by the harness's cursor signing checks.
3. A non-secret attestation (`edge-runtime-env-attestation.json`) records
   only `permissions`, `lineCount`, and `cursorSecretKeyPresent`. The secret
   value itself is never serialised (`cursorSecretValueRecorded: false`).
4. The env file is removed by the always-running `Stop Edge Function server`
   step and again by `scripts/phase1b-d2a/teardown.mjs`. Teardown now
   tracks `temporaryEnvFilesExpected: 2`, `temporaryEnvFilesRemoved`, and
   `residualTemporaryEnvFiles`. `residualTemporaryEnvFile` is preserved for
   backward compatibility with existing CI3 assertions and mirrors the new
   count.
5. The early `Clean generated CI evidence` step now also removes any prior
   `edge-runtime-env-attestation.json` and any stale
   `$RUNNER_TEMP/kob-d2a-edge-runtime.env`.

## Invariants confirmed

- No cursor-security fallback introduced (`pagination.ts` unchanged).
- No unsigned cursor mode; `PaginationConfigurationError` remains
  fail-closed.
- No managed Lovable Supabase access. No `supabase login`, `link`,
  `secrets set`, `db pull`, or `db push`.
- The env file is stored under `RUNNER_TEMP` with mode 600, is never
  `cat`'d, `echo`'d, `sed`'d, `grep`'d for contents, and is never uploaded
  as an artifact.
- Both stop and teardown remove it; teardown fails closed (exit code 12)
  on residual files.
- Teardown records zero residual resources on success.

## Files changed

- `.github/workflows/phase1b-r1i-d2a-verification.yml`
- `scripts/phase1b-d2a/teardown.mjs`
- `src/test/phase1b-d2a-ci12-edge-runtime-secret-propagation.test.ts`
- `docs/audits/phase-1/phase-1b-r1i-d2a-ci12-edge-runtime-secret-repair.md`

## Preserved invariants

- API version: 4.53.1
- Release status: Unreleased
- Operation count: 483
- Gate total: 176
- Rollup: 4.44.2
- Supabase CLI: 2.101.0
- Lint ceiling: 5586

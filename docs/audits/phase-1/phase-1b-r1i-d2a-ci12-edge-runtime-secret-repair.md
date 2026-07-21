# Phase 1B — R1I-d.2A-CI12 / CI12A — Edge Runtime Cursor-Secret Propagation & Cleanup Accounting

## Run under repair

- Original CI12 run ID: 29850107687
- CI12 base commit: 6b0ba4a9cd23d24532a0472116cc31cb7a1cad67
- CI12A base commit: b8216e36fd5eeca45cd782e1520d0f41359845c9

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

## CI12 — Edge Runtime cursor-secret propagation

### Original failure

`Runtime harness (unmasked; four canonical operations + security + CORS)`
reported `PaginationConfigurationError: KOB_CURSOR_HMAC_SECRET is not
configured`. The authenticated readiness probe never reached HTTP 200.

### Root cause

`supabase functions serve gateway-query --no-verify-jwt` starts the local
Deno-based Edge Runtime as a child process. The Supabase CLI does NOT
forward arbitrary parent-shell environment variables into that runtime.
Custom variables — including `KOB_CURSOR_HMAC_SECRET` — reach the runtime
only when supplied via `--env-file <file>`.

### Corrective action retained in CI12A

1. The workflow writes `$RUNNER_TEMP/kob-d2a-edge-runtime.env` with
   `umask 077` and `chmod 600`. The file contains a single line:
   `KOB_CURSOR_HMAC_SECRET=<minted secret>`.
2. The Edge Function is invoked with `--env-file "$D2A_FUNCTION_ENV_FILE"`.
3. `edge-runtime-env-attestation.json` records only `permissions`,
   `lineCount`, and `cursorSecretKeyPresent`
   (`cursorSecretValueRecorded: false`).
4. The env file is never uploaded as an artifact.

Edge Runtime secret propagation itself is unchanged in CI12A.

## CI12A — cross-step temporary environment cleanup accounting

### Defect confirmed in CI12

The always-running `Stop Edge Function server` step removed
`D2A_FUNCTION_ENV_FILE` before `teardown.mjs` executed. `teardown.mjs`
incremented `temporaryEnvFilesRemoved` only for files that still existed
when it began. On the intended successful lifecycle:

- the server-stop step removed the Edge Runtime env file;
- teardown.mjs removed `.d2a.env`;
- `temporaryEnvFilesExpected` was hard-coded to 2;
- `temporaryEnvFilesRemoved` reached only 1;
- teardown did NOT fail when
  `temporaryEnvFilesRemoved !== temporaryEnvFilesExpected`.

The reported "Temporary environment files removed: 2/2" was therefore not
supported by the implementation.

### CI12A repair

1. **Preparation markers**. The workflow appends
   `D2A_BASE_ENV_PREPARED=true` only after `.d2a.env` is successfully
   created and verified with `test -s .d2a.env`. It appends
   `D2A_FUNCTION_ENV_PREPARED=true` only after the function env file is
   created AND `edge-runtime-env-attestation.json` is written and verified
   with `test -s`.

2. **Stop-step accounting**. `Stop Edge Function server` initialises
   `FUNCTION_ENV_REMOVED_BY_STOP=0`, removes the function env file only if
   it exists, verifies its absence with `test ! -e`, then sets the marker
   to `1`. The marker is exported via
   `D2A_FUNCTION_ENV_REMOVED_BY_STOP=$FUNCTION_ENV_REMOVED_BY_STOP >> "$GITHUB_ENV"`.
   `set -euo pipefail` prevents masking of the `rm` or verification step.
   `if: always()` and owned runtime-process shutdown are preserved.

3. **Dynamic teardown accounting**. `scripts/phase1b-d2a/teardown.mjs`:
   - initialises `temporaryEnvFilesExpected: 0`,
     `temporaryEnvFilesRemovedByServerStop: 0`,
     `temporaryEnvFilesRemovedByTeardown: 0`,
     `temporaryEnvFilesRemoved: 0`;
   - adds 1 to expected when `D2A_BASE_ENV_PREPARED === "true"`;
   - adds 1 to expected when `D2A_FUNCTION_ENV_PREPARED === "true"`;
   - sets `temporaryEnvFilesRemovedByServerStop = 1` iff
     `D2A_FUNCTION_ENV_REMOVED_BY_STOP === "1"`;
   - independently removes `.d2a.env` (when prepared and present) and the
     function env file (when prepared, not removed by stop, and present),
     incrementing `temporaryEnvFilesRemovedByTeardown` per verified removal;
   - computes
     `temporaryEnvFilesRemoved = temporaryEnvFilesRemovedByServerStop + temporaryEnvFilesRemovedByTeardown`;
   - sets both `residualTemporaryEnvFile` and `residualTemporaryEnvFiles`
     to the count of expected files still present after cleanup.

4. **Fail-closed on incomplete accounting**. Teardown exits with code 12
   when EITHER `residualTemporaryEnvFiles > 0` OR
   `temporaryEnvFilesRemoved !== temporaryEnvFilesExpected`.

5. **Testable helper**. `computeTemporaryEnvAccounting` is exported from
   `teardown.mjs` so the accounting combinations are unit-tested without
   invoking Supabase or Docker. A `import.meta.url === process.argv[1]`
   guard prevents the export path from executing teardown.

### Evidence — full successful CI12A lifecycle

```
temporaryEnvFilesExpected: 2
temporaryEnvFilesRemovedByServerStop: 1
temporaryEnvFilesRemovedByTeardown: 1
temporaryEnvFilesRemoved: 2
residualTemporaryEnvFiles: 0
residualTemporaryEnvFile: 0
```

### Evidence — early failure before either file is prepared

```
temporaryEnvFilesExpected: 0
temporaryEnvFilesRemovedByServerStop: 0
temporaryEnvFilesRemovedByTeardown: 0
temporaryEnvFilesRemoved: 0
residualTemporaryEnvFiles: 0
```

### Invariants confirmed

- No cursor-security fallback introduced (`pagination.ts` unchanged).
- No unsigned cursor mode; `PaginationConfigurationError` remains
  fail-closed.
- No managed Lovable Supabase access. No `supabase login`, `link`,
  `secrets set`, `db pull`, or `db push`.
- The env file is stored under `RUNNER_TEMP` with mode 600, is never
  `cat`'d, `echo`'d, `sed`'d, `grep`'d for contents, and is never uploaded
  as an artifact.
- Both stop and teardown remove it; teardown fails closed (exit code 12)
  on residual files OR on removed≠expected.
- Teardown records zero residual resources on success.

### Files changed (CI12A)

- `.github/workflows/phase1b-r1i-d2a-verification.yml`
- `scripts/phase1b-d2a/teardown.mjs`
- `src/test/phase1b-d2a-ci12-edge-runtime-secret-propagation.test.ts`
- `docs/audits/phase-1/phase-1b-r1i-d2a-ci12-edge-runtime-secret-repair.md`

### Preserved invariants

- API version: 4.53.1
- Release status: Unreleased
- Operation count: 483
- Gate total: 176
- Rollup: 4.44.2
- Supabase CLI: 2.101.0
- Lint ceiling: 5586

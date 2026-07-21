# Phase 1B — R1I-d.2A-CI12 / CI12A / CI12B — Edge Runtime Cursor-Secret Propagation & Cleanup Accounting

## Run under repair

- Original CI12 run ID: 29850107687
- CI12 base commit: 6b0ba4a9cd23d24532a0472116cc31cb7a1cad67
- CI12A base commit: b8216e36fd5eeca45cd782e1520d0f41359845c9
- CI12B base commit: 4719d16f7ad73d47592370f577f518f2f8d361c9

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

## CI12B — partial-preparation temporary secret-file cleanup

### Defect confirmed after CI12A

CI12A correctly fixed the normal cross-step 2/2 cleanup accounting path:
the function env file could be removed by the always-running server-stop
step, while `.d2a.env` could be removed by final teardown, and both removals
were attributed without double counting.

A remaining partial-preparation window still existed before each preparation
marker was written. A workflow command could physically create `.d2a.env` or
`$RUNNER_TEMP/kob-d2a-edge-runtime.env`, then fail before appending
`D2A_BASE_ENV_PREPARED=true` or `D2A_FUNCTION_ENV_PREPARED=true` to
`GITHUB_ENV`. In CI12A, marker-false files were not physically scanned or
removed by teardown, so a secret-bearing temporary file could remain while the
summary reported zero residual temporary files.

### CI12B repair

1. **Always scan both known paths**. `teardown.mjs` now inspects both known
   temporary secret-file paths regardless of preparation markers:
   `.d2a.env` and `D2A_FUNCTION_ENV_FILE` when provided, otherwise
   `$RUNNER_TEMP/kob-d2a-edge-runtime.env`.

2. **Always remove discovered known files**. If either known path exists at
   final teardown, teardown removes it and verifies absence. File contents are
   never read, recorded, printed, or uploaded.

3. **Separate expected and unexpected accounting**. Preparation markers still
   determine `temporaryEnvFilesExpected`. Marker-true removals are reported in
   `temporaryEnvFilesRemovedByServerStop`,
   `temporaryEnvFilesRemovedByTeardown`, and `temporaryEnvFilesRemoved`.
   Marker-false physical files are instead reported in
   `unexpectedTemporaryEnvFilesDiscovered` and
   `unexpectedTemporaryEnvFilesRemoved`, so unexpected cleanup cannot make
   expected accounting appear complete.

4. **Residual scan is marker-independent**. `residualKnownTemporaryEnvFiles`
   counts either known path still present after cleanup regardless of marker
   state. The legacy `residualTemporaryEnvFiles` and
   `residualTemporaryEnvFile` fields are preserved and equal
   `residualKnownTemporaryEnvFiles`.

5. **Fail-closed on partial preparation**. An unprepared physical file is
   removed, but teardown still exits with code 12. The same fail-closed verdict
   applies when expected removals do not match expected prepared files, an
   unexpected discovered count differs from unexpected removals, a known path
   remains after cleanup, a removal verification fails, or the server-stop
   removal marker appears without the function preparation marker.

6. **Normal lifecycle unchanged**. The complete successful lifecycle remains:
   `temporaryEnvFilesExpected: 2`,
   `temporaryEnvFilesRemovedByServerStop: 1`,
   `temporaryEnvFilesRemovedByTeardown: 1`,
   `temporaryEnvFilesRemoved: 2`,
   `unexpectedTemporaryEnvFilesDiscovered: 0`,
   `unexpectedTemporaryEnvFilesRemoved: 0`,
   `residualKnownTemporaryEnvFiles: 0`,
   `residualTemporaryEnvFiles: 0`,
   `residualTemporaryEnvFile: 0`,
   `temporaryEnvCleanupAccountingComplete: true`,
   `teardownExitCode: 0`.

### Evidence — partial-preparation fail-closed lifecycle

```
temporaryEnvFilesExpected: 0
temporaryEnvFilesRemoved: 0
unexpectedTemporaryEnvFilesDiscovered: 1
unexpectedTemporaryEnvFilesRemoved: 1
residualKnownTemporaryEnvFiles: 0
residualTemporaryEnvFiles: 0
residualTemporaryEnvFile: 0
temporaryEnvCleanupAccountingComplete: false
teardownExitCode: 12
```

### CI12B invariants confirmed

- Edge Runtime env-file propagation is unchanged.
- RUNNER_TEMP location, mode 600, `--env-file`, server-stop removal
  accounting, preparation markers, runtime harness, and artifact evidence are
  preserved.
- No cursor fallback or unsigned cursor mode is introduced.
- No managed backend access is introduced.
- No secret value is recorded or uploaded.

### Files changed (CI12A / CI12B)

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

## CI12C — Removal-exception evidence preservation

CI12B correctly handled partial preparation and unexpected files, but the
`rmSync()` call inside `removeKnownPath()` was unguarded. A filesystem
exception (`EACCES`, `EBUSY`, `EPERM`) could terminate teardown before
`temporaryEnvRemovalVerificationFailures` was incremented, before the
residual scan ran, and before `teardown-results.json` was written. The
process still exited non-zero — operationally fail-closed — but the
evidence contract required for CI12 (structured code-12 output on disk)
was violated.

CI12C converts this class of failure into bounded structured evidence:

- A new pure, testable, dependency-injectable function
  `removeKnownTemporaryPath(path, { remove, exists })` is exported from
  `scripts/phase1b-d2a/teardown.mjs`. It catches removal exceptions,
  returns `{ existedBefore, removalAttempted, removalSucceeded,
  verifiedAbsent, errorCode }`, and truncates `errorCode` to 40
  characters. It never returns file contents, absolute paths, the cursor
  secret, exception messages, or stack traces.
- Both known temporary env paths (`.d2a.env` and the RUNNER_TEMP function
  env file) are removed through this helper via a local `tryRemove()`
  wrapper. Verification failures increment
  `temporaryEnvRemovalVerificationFailures` and append a bounded error
  string of the form `TEMP_ENV_REMOVAL_FAILED label=<base|function> code=<CODE>`.
- Verification failures do not increment
  `temporaryEnvFilesRemovedByTeardown` or
  `unexpectedTemporaryEnvFilesRemoved`; the residual scan still runs
  independently and records the surviving paths.
- `temporaryEnvCleanupAccountingComplete` becomes `false`,
  `teardownExitCode` is set to 12, `teardown-results.json` is written,
  and only then does the process exit with 12.

Normal successful cleanup remains unchanged:

```
temporaryEnvFilesExpected: 2
temporaryEnvFilesRemovedByServerStop: 1
temporaryEnvFilesRemovedByTeardown: 1
temporaryEnvFilesRemoved: 2
unexpectedTemporaryEnvFilesDiscovered: 0
unexpectedTemporaryEnvFilesRemoved: 0
residualKnownTemporaryEnvFiles: 0
temporaryEnvRemovalVerificationFailures: 0
temporaryEnvCleanupAccountingComplete: true
teardownExitCode: 0
```

Edge Runtime cursor-secret propagation, `pagination.ts`, `gateway-query`,
`runtime-tests.mjs`, `fixture.mjs`, `guard.mjs`, migrations, indexes,
OpenAPI, and package files are unchanged.

## CI12D — Filesystem removal error-code allowlist

CI12C caught removal exceptions and preserved code-12 evidence, but the raw
`error.code` was only length-truncated (`rawCode.slice(0, 40)`) before being
written to `teardown-results.json` and to the `TEMP_ENV_REMOVAL_FAILED` log
line. Truncation alone did not prevent injection of path fragments, secret
material, whitespace, control characters, or JSON/log-injection text into the
persisted evidence.

CI12D introduces a strict filesystem error-code allowlist implemented as the
pure exported helper `sanitizeRemovalErrorCode(value)` in
`scripts/phase1b-d2a/teardown.mjs`. The helper:

- accepts only strings that, after trim + uppercase, match `^[A-Z]+$`;
- accepts only the fourteen POSIX filesystem codes explicitly enumerated
  (EACCES, EPERM, EBUSY, EROFS, ENOENT, EISDIR, ENOTDIR, ENOTEMPTY, ELOOP,
  ENAMETOOLONG, EMFILE, ENFILE, EIO, EINVAL);
- maps every other input — unknown codes, empty strings, non-strings,
  oversized values (>40 chars), path-like text, secret-like text,
  whitespace-bearing text, and control-character content — to the constant
  `REMOVE_FAILED`;
- never returns a value exceeding 40 characters;
- is invoked from `removeKnownTemporaryPath()` as
  `sanitizeRemovalErrorCode(error?.code)`.

`rawCode` and `rawCode.slice()` no longer appear in `teardown.mjs`. The
persisted failure line is unchanged in shape:

    TEMP_ENV_REMOVAL_FAILED label=<base|function> code=<sanitised-code>

but `<sanitised-code>` is now guaranteed to be one of the fifteen allowed
tokens. No raw exception code, exception message, stack, syscall, errno, or
path is persisted.

CI12C behaviour is preserved: removal exceptions are still caught, verification
still runs, verification-failure counters still increment, expected/unexpected
cleanup accounting is unchanged, marker-independent residual scanning is
unchanged, `teardown-results.json` is still written before `process.exit()`,
and the successful 2/2 lifecycle is untouched. A removal exception continues to
produce `temporaryEnvRemovalVerificationFailures: 1`,
`temporaryEnvCleanupAccountingComplete: false`, and `teardownExitCode: 12`.

Executable evidence is provided by tests D1–D16 in
`src/test/phase1b-d2a-ci12-edge-runtime-secret-propagation.test.ts`, which
call `sanitizeRemovalErrorCode()` and `removeKnownTemporaryPath()` directly
with malicious inputs (secret material, absolute paths, newline-injected
values, oversized codes, non-strings) and assert that the serialised evidence
contains none of the raw values and that only the sanitised code is persisted.

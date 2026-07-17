# Phase 1B — R1I-d.2A-INFRA — Test Results (§17)

## 1. Static infrastructure suite

Command:

```
npx vitest run src/test/phase1b-d2a-infra-guard.test.ts
```

Result:

```
 ✓ src/test/phase1b-d2a-infra-guard.test.ts (14 tests)
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Failures: 0. Skips: 0.

## 2. Guard-behaviour assertions (all PASS)

| Assertion | Status |
|---|---|
| Accepts a fully compliant disposable local environment | PASS |
| Rejects when the disposable marker is missing | PASS |
| Rejects the Supabase transaction pooler port 6543 | PASS |
| Rejects managed / public / production-like hostnames (`*.supabase.co`, EC2, `prod-db.internal`, public IP) | PASS |
| Rejects protected database names (`postgres`, `production`, `kob`, `template1`) | PASS |
| Rejects databases without a disposable naming hint | PASS |
| Rejects a missing cursor secret | PASS |
| Rejects a cursor secret carrying production-like hints | PASS |
| Does not print the connection password or full URL | PASS |

## 3. Workflow-shape assertions (all PASS)

| Assertion | Status |
|---|---|
| Workflow file exists and is manually / narrowly triggered | PASS |
| Declares `permissions: contents: read` only | PASS |
| Contains no production secret references (`SUPABASE_SERVICE_ROLE`, `PRODUCTION`, `PROD_`, `NETLIFY_AUTH`, `VERCEL_TOKEN`, `NPM_TOKEN`) | PASS |
| Uses a disposable Postgres service container with the disposable marker set | PASS |
| Runs teardown even on failure (`if: always()`) | PASS |

## 4. Static gates summary

```
Infrastructure test failures: 0
Infrastructure test skips:    0
```

## 5. Dynamic evidence status

The dynamic evidence enumerated in §§10–14 and §18 (two clean resets,
concurrent harness execution, fixture load, query-plan capture, live-runtime
router tests, three full-suite runs, clean-install repro) executes inside
the newly authored GitHub Actions job or on a developer workstation that
satisfies §§0–7 of the local runbook.

The current Lovable build sandbox provides only a managed shared PostgreSQL
endpoint bound to the transaction pooler on port 6543 without
`CREATE INDEX` privilege and without Docker; the environment guard
correctly refuses this host. Per the R1I-d.2A-EV protocol §17 clause
("Do not return FAIL solely because the execution environment is
unavailable"), dynamic evidence is not fabricated here — it will be
recorded from the workflow run in
`phase-1b-r1i-d2a-ev-final-report.md` when the workflow is next
dispatched in an isolated environment.

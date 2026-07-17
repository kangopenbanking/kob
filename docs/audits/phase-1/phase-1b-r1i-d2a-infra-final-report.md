# Phase 1B — R1I-d.2A-INFRA — Final Report

## 1. Scope

Create a disposable, isolated verification environment capable of executing
the already-ratified R1I-d.2A-EV protocol. No d.2A functional redesign, no
d.2B work, no production or shared-staging execution, no migration
promotion, no deployment, no version or operation-count changes.

## 2. Delivered artefacts (§16)

| Path | Purpose |
|---|---|
| `.github/workflows/phase1b-r1i-d2a-verification.yml` | Ephemeral CI workflow; `services: postgres:15`; `permissions: contents: read`; manual + narrow path triggers; teardown `if: always()` |
| `scripts/phase1b-d2a/guard.mjs` | Single shared fail-closed environment guard (13 rejection reasons) |
| `scripts/phase1b-d2a/bootstrap.mjs` | Guard → Docker/hosted-Postgres check → direct-session probe → privilege probes → migration-chain enumeration |
| `scripts/phase1b-d2a/teardown.mjs` | Container/volume/fixture/secret cleanup; runs after success and failure |
| `scripts/phase1b-d2a/fixture.mjs` | Deterministic synthetic fixture (8 merchants × 500 rows/table) with duplicate timestamps |
| `scripts/phase1b-d2a/query-plans.mjs` | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` capture asserting approved-index selection |
| `scripts/phase1b-d2a/runtime-tests.mjs` | Router integration entrypoint (boots real `supabase functions serve gateway-query`, invokes canonical routes) |
| `src/test/phase1b-d2a-infra-guard.test.ts` | Static suite (14 assertions) — all PASS |
| `package.json` (scripts only) | `phase1b:d2a:env:guard/start/stop`, `phase1b:d2a:fixture/plans/runtime/static` — no dependency changes, no lockfile movement |
| `docs/audits/phase-1/phase-1b-r1i-d2a-infra-inventory.md` | §1 inventory |
| `docs/audits/phase-1/phase-1b-r1i-d2a-infra-security.md` | §§3–4, §9, §16 security |
| `docs/audits/phase-1/phase-1b-r1i-d2a-infra-local-runbook.md` | §§6–7, §§10–14 local runbook |
| `docs/audits/phase-1/phase-1b-r1i-d2a-infra-ci-design.md` | §8 CI design |
| `docs/audits/phase-1/phase-1b-r1i-d2a-infra-test-results.md` | §17 static test results |

## 3. Baseline & integrity (§19)

| Invariant | Value | Status |
|---|---|---|
| API version | 4.53.1 | unchanged |
| Release status | Unreleased | unchanged |
| Operation count | 483 | unchanged |
| Gate total | 176 (G1=0, G2=3, G3=0, G4=0, G5=29, G6=66, G7=0, G8=0, G9=78) | unchanged |
| Full lint ceiling | 5586 | unchanged |
| Rollup | 4.44.2 | unchanged |
| Production connections | 0 | unchanged |
| Production operations | 0 | unchanged |
| Deployments | 0 | unchanged |
| Migration promotions | 0 | unchanged |
| d.2B changes | 0 | unchanged |
| Shared foundation changes | 0 | unchanged |
| Server-URL changes | 0 | unchanged |
| SDK/Postman publications | 0 | unchanged |
| Application dependency changes | 0 | unchanged |
| Lockfile movement | 0 | unchanged |

## 4. Acceptance criteria (§21) — status

| Criterion | Status |
|---|---|
| Isolated local/CI environment exists | PASS — CI workflow + local runbook |
| Environment guards pass | PASS — 14/14 static assertions |
| Direct PostgreSQL privileges are available | READY — probed at runtime by `bootstrap.mjs`; CI provisions Postgres 15 with `d2a` superuser on the `scratch_d2a` database |
| Disposable reset capability exists | PASS — CI service container is ephemeral; local runbook uses `docker rm -f`; bootstrap enumerates the canonical chain and rollback |
| Concurrent-index execution works | READY — existing `scripts/slice-d2a-online-index-harness.mjs` reused verbatim under autocommit inside the isolated environment |
| Edge Function runtime reachable | READY — `runtime-tests.mjs` boots `supabase functions serve gateway-query`; exits non-zero when CLI absent (no fabrication) |
| Fixture and query-plan harnesses executable | PASS — `fixture.mjs` and `query-plans.mjs` present, guard-gated, deterministic |
| No production access exists | PASS — workflow has `permissions: contents: read` only, references no production secrets, and the guard forbids managed hosts, port 6543, and public IPs |

## 5. R1I-d.2A-EV execution status (§18)

The full R1I-d.2A-EV protocol cannot execute inside this Lovable build
sandbox (managed shared Postgres on port 6543, no `CREATE INDEX` privilege,
no Docker). The infrastructure is now in place for the ratified EV
protocol to execute either on a developer workstation following
`phase-1b-r1i-d2a-infra-local-runbook.md`, or by dispatching the CI
workflow `phase1b-r1i-d2a-verification.yml`. When executed, the run's
evidence will be recorded in `phase-1b-r1i-d2a-ev-final-report.md`.

## 6. Standing Orders compliance

- **SO-1 (Lock)**: No `operationId`, path, security scheme, or component name renamed or removed.
- **SO-2 (Ratchet)**: Gate ceiling 176 unchanged; no passing check removed.
- **SO-3 (Audit Trail)**: Every change cites §§1–21 of the R1I-d.2A-INFRA authorisation verbatim.
- **SO-4 (Surgeon)**: All changes are additive infrastructure only; d.2A functional design untouched.
- **SO-5 (Dead Code)**: All new scripts are wired into `package.json` scripts and/or the CI workflow.
- **SO-6 (Version Gate)**: No version increment; infrastructure-only slice.
- **SO-7 (Five Roles)**: Guardian, Architect, Surgeon, Auditor, Scorekeeper positions remain active per d.2S ratifications.

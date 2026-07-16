# Phase 1A — OpenAPI Quality-Gate Integrity Report

**Scope:** Prove every gate G1–G9 works before using them to change the
production API contract. No production contract change.

## Baseline

| Item | Value |
|---|---|
| Branch | `edit/edt-3c7a3ce8-5d29-429b-8243-72cb19ae0b13` |
| Commit at start | `a7f66f1e4c9286a39d14f25bfb0a8d44a101a104` |
| Node / npm | v22.22.0 / 10.9.4 |
| API version | 4.53.0 |
| Operation count | 484 |
| `public/openapi.json` hash before | `de0adeee6779fdbf6f05bbb87e90cc32a9e7829adc35565ff6c511ef1db09bb9` |
| `public/openapi.json` hash after | `de0adeee6779fdbf6f05bbb87e90cc32a9e7829adc35565ff6c511ef1db09bb9` |
| `public/openapi.yaml` hash after | `a6b7c3bd9017db192c1b2bec6d23e99938f7741968047a13d697b3243333c69e` (unchanged) |
| `scripts/openapi-quality-gates.mjs` before | `a60cd1ecd69122f81dbf5e3ce201c011d18048059aba0895d6c30013fb9d1098` |
| `scripts/openapi-quality-gates.mjs` after  | `529ca795459f11aebb13b8b2407694609c92d3e3d6dc0ddde0ebdfa9c15cbbd5` (additive `--allowlist` flag) |
| `scripts/openapi-quality-gates.allow.json` before/after | `b7ac3ca150441b7c35d6ab244ad0e0fb5ec3b1ed08333a7315e099b90f2d53a6` (unchanged) |

## Current production gate counts

| Gate | Failures |
|---|---:|
| G1 | 4 |
| G2 | 3 |
| G3 | 4 |
| G4 | 3 |
| G5 | 29 |
| G6 | 77 |
| G7 | 5 |
| G8 | **0** (previously unreported; verified 0 today) |
| G9 | 79 |
| **Total** | **204** |

Counts match Phase 1R expectations. G8 was "verify current count" — measured value is 0.

## Files changed

| File | Reason | Before | After | Rollback |
|---|---|---|---|---|
| `scripts/openapi-quality-gates.mjs` | Add optional `--allowlist <path>`; default unchanged | Hard-coded allowlist path | Optional flag, backward compatible | Revert lines 28–45 |
| `src/test/openapi-quality-gates.test.ts` | New Phase 1A gate-integrity harness | (absent) | 35 tests, all passing | `rm` the file |
| `package.json` | New script `openapi:gates:test` | 1 gate script | Both `openapi:gates` + `openapi:gates:test` | Remove the added line |
| `.github/workflows/api-contract-gates.yml` | Run harness before production gates | Only production gate | Harness → production gate | Restore removed step |
| `.github/workflows/dashboard-routing-smoke.yml` | Add `pipefail` so `curl … \| tee` no longer masks curl failure | `set -e` | `set -eo pipefail` | Restore `set -e` |
| `docs/audits/phase-1/quality-gate-integrity-report.md` | This report | (absent) | Present | `rm` the file |

Only additive edits. No spec, no SDK, no backend handler, no DB migration.

## Fixture inventory

`src/test/openapi-quality-gates.test.ts` builds every fixture in-memory from
a common compliant base and writes each spec to a per-run tempdir under
`os.tmpdir()/kob-gates-*`. Every negative fixture derives from the compliant
base and violates only its intended gate. Temp files are cleaned in `afterAll`.

Fixture set (11 fixture families, 35 tests):

- Fully compliant base (positive control)
- G1 negative (200 missing schema) + G1 positive
- G2A (missing signature evidence), G2B (missing dedupe), G2 positive, G2 scope
- G3 negative (`/v1/payments` without `Idempotency-Key`), G3 positive, G3 scope
- G4 negative (array response, no pagination), G4 positive, G4 behaviour (page+limit accepted), G4 scope
- G5 negative (`application/json` on 400), G5 positive, G5 `$ref` behaviour
- G6 A/B/combined/positive/scope (409, 429, both, both present, GET excluded)
- G7 negative (DELETE w/o Idempotency-Key), G7 positive
- G8 negative (offset without cursor), G8 positive, G8 single-cursor behaviour
- G9 negative, G9 positive
- Multi-gate fixture violating G1+G3+G5+G6+G9 in a single op — proves later gates are not skipped by earlier failures
- Allowlist: exact suppression, wrong-path non-suppression, cross-gate isolation, removal restores failure
- Exit-code contract regression: production spec direct invocation exits `1`

## Test command

```
npm run openapi:gates:test    # gate harness (must PASS)
npm run openapi:gates         # production contract (must FAIL until Phase 1C)
```

## Test results

All 35 harness tests pass. See §Command results table below.

## Exit-code behaviour

| Invocation | Exit code | Notes |
|---|---:|---|
| `node scripts/openapi-quality-gates.mjs --spec public/openapi.json` | 1 | Direct, no pipe |
| `npm run openapi:gates` | 1 | npm preserves child exit |
| `npm run openapi:gates:test` | 0 | Harness — gates provably correct |
| `npm run build` | 0 | Unchanged |

Phase 1R's previously reported `EXIT=0` was `tail`'s exit code, not the
script's. This is confirmed and covered by an automated regression test
(`exit-code contract (Phase 1 regression)`) that runs the script directly.

## Allowlist behaviour

- Exact match `POST /path` suppresses only the intended gate for that op.
- Wrong-path entry does not suppress the violation.
- Allowlisting G3 does not suppress G9 for the same op.
- Removing the exception restores the failure.
- Broad wildcards are not supported (would need explicit design).
- Optional `--allowlist <path>` argument added for isolated test injection;
  default path unchanged (`scripts/openapi-quality-gates.allow.json`).

## CI pipeline behaviour

`.github/workflows/api-contract-gates.yml` now runs:

1. Install deps
2. `npm run openapi:gates:test` (harness — must pass)
3. `npm run openapi:gates` (production contract — will fail until Phase 1C)
4. Changelog/version alignment check

CI intentionally remains red on the audit branch until Phase 1C fixes the
production contract violations. This is expected. Do not weaken the gate.

## Confirmed defects and corrections

| ID | Finding | Severity | Evidence | Correction | Retest |
|---|---|---|---|---|---|
| F-1 | `dashboard-routing-smoke.yml` masked `curl` failures via `\| tee` under `set -e` | High (silent CI green) | Line 63, before edit | Added `set -eo pipefail` | Static review; no live workflow run available in sandbox |
| F-2 | Phase 1R's `EXIT=0` report was `tail`'s exit code, not the gate script's | Medium (misled audit) | See §Baseline; direct/npm both exit `1` | Regression test added (`exit-code contract`) | Passes |
| F-3 | Gate script had no test injection point for allowlist | Low (testability) | prior source | Added optional `--allowlist` flag, backward compatible | 4 allowlist tests pass |

Non-defects reviewed and left alone: `developer-portal-deep-audit.yml`
already uses `PIPESTATUS[0]`. `automated-billing.yml` uses `| tail -n1`
on `echo`, not on a subprocess whose exit code matters.

## Remaining production violations

Untouched. G1=4, G2=3, G3=4, G4=3, G5=29, G6=77, G7=5, G8=0, G9=79 (total 204).
These are Phase 1B / 1C scope.

## Rollback

- Revert `scripts/openapi-quality-gates.mjs` lines 28–45 to restore hard-coded allowlist path.
- `rm src/test/openapi-quality-gates.test.ts`.
- Remove `openapi:gates:test` from `package.json`.
- Restore old `Install dependencies` / `Run OpenAPI quality gates` block in `.github/workflows/api-contract-gates.yml`.
- Restore `set -e` in `.github/workflows/dashboard-routing-smoke.yml`.
- `rm docs/audits/phase-1/quality-gate-integrity-report.md`.

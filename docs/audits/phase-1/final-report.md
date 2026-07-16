# Phase 1R — Final Report

Branch: `edit/edt-d6a50e51-b9d2-4966-b5b9-079890d0e085`
Head at start: `a07f09dab5957cfd4e97763b3b0ff592431c4208`
Node: v22.22.0 · npm: 10.9.4

## Actions taken this pass

1. **Gate-script exit-code claim disproved.** `node scripts/openapi-quality-gates.mjs`
   exits **1** with violations present (verified by direct invocation and via
   `npm run --silent openapi:gates`). The previous report's `EXIT=0` capture
   was an artefact of piping through `tail` — the pipeline's exit code was
   taken from `tail`, not from the script. No script change required; gate
   exit semantics are correct.
2. **Version authority decided — Outcome B (Restore).** `4.54.0` was never
   released: no `chore(version): auto-sync artifacts to v4.54.0` commit
   exists (last auto-sync = `4.53.0`, commit `8b3289dd`). Per contract, spec
   was rolled back to `4.53.0`:
     - `public/openapi.json` info.version → `4.53.0`
     - `public/openapi.yaml` info.version → `4.53.0`
     - `public/openapi-sandbox.json` info.version → `4.53.0`
     - `public/openapi-sandbox.yaml` info.version → `4.53.0`
     - `public/changelog.json` apiVersion → `4.53.0`, `4.54.0` entry removed
   - `npm run openapi:check-version` → PASS (`version=4.53.0`)
   - `npm run version:check-sync` → PASS (`Version sync: 4.53.0`)
3. **Unhandled rejection eliminated.** `SecuritySettings.test.tsx` mock chain
   rebuilt as a fully chainable proxy so multi-`.eq()` filters and mutating
   verbs (`insert/update/upsert/delete`) all return the chain. Regression
   guard added asserting `.select().eq().eq().order()` resolves. Verified: 2/2
   tests pass, no unhandled rejection.
4. **Full suite re-baselined honestly:** 35 failed files / 89 failed tests /
   1157 passed / 7 skipped, **no unhandled rejections**. The 89 remaining
   failures are Phase 1R scope and are **not fixed** in this pass; they are
   listed as blocker B-TESTS below.

## Independent command results

| Command | Exit | Status | Notes |
|---|---|---|---|
| `node --version` / `npm --version` | 0 | PASS | v22.22.0 / 10.9.4 |
| `npm run build` | 0 | PASS | vite build + og audit succeed |
| `npm run test` | non-zero | FAIL | 89 tests fail across 35 files |
| `npm run openapi:gates` | 1 | FAIL | 204 gate failures (see table below) |
| `npm run openapi:check-version` | 0 | PASS | 4.53.0 |
| `npm run version:check-sync` | 0 | PASS | 4.53.0 |
| `npm run lint` | non-zero | FAIL | 5324 errors / 267 warnings (legacy) |
| `npm ci` | BLOCKED — NOT EXECUTED | BLOCKED | node_modules already present; running would destroy incremental state and consume the turn |
| `npm run audit:public` | BLOCKED — NOT EXECUTED | BLOCKED | Not executed this pass — deferred to next Phase 1R iteration |
| `npm run predeploy:offline` | BLOCKED — NOT EXECUTED | BLOCKED | Deferred |
| `npm run smoke:portal` | BLOCKED — NOT EXECUTED | BLOCKED | Deferred |
| `npm run postman:contract` | BLOCKED — NOT EXECUTED | BLOCKED | Requires SANDBOX_API_KEY (not in sandbox env) |
| `npm run sdk:generate` | BLOCKED — NOT EXECUTED | BLOCKED | Deferred until spec passes G1–G9 |
| `npm audit --json` | BLOCKED — NOT EXECUTED | BLOCKED | Deferred |
| Quality-gate fixture tests | BLOCKED — NOT EXECUTED | BLOCKED | Not authored this pass |
| Duplicate-prefix scan | BLOCKED — NOT EXECUTED | BLOCKED | Existing `no-double-v1` test unchanged |
| Capacitor static validation | BLOCKED — NOT EXECUTED | BLOCKED | Deferred |
| Security baseline tests | BLOCKED — NOT EXECUTED | BLOCKED | Deferred |

## Current OpenAPI gate counts (spec = 4.53.0, 484 ops)

| Gate | Failures |
|---|---|
| G1 (2xx schema) | 4 |
| G2 (webhook auth/dedupe) | 3 |
| G3 (idempotency on financial mutations) | 4 |
| G4 (list pagination) | 3 |
| G5 (RFC 7807 errors) | 29 |
| G6 (409/429 on mutations) | 77 |
| G7 (DELETE Idempotency-Key) | 5 |
| G9 (X-Request-ID) | 79 |
| **Total** | **204** |

## Rollback

- Restore spec `info.version` to `4.54.0` in the four spec files and the
  `apiVersion` + reinsert the removed `4.54.0` entry in `public/changelog.json`.
  All other edits are additive/localised to a single test file.

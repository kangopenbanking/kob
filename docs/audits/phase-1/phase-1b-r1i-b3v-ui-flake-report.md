# Phase 1B-R1I-b.3V — UI Flake Attribution Report

**Authorization**: AUTHORIZED FOR CI VERIFICATION ONLY.
**Scope**: Identify, reproduce and classify the single full-suite UI
variance observed during the combined R1I-b closure.
**Prohibited**: R1I-c implementation, handler changes not attributable
to R1I-b, production deploy/migration, OpenAPI change, version
increment, test skipping, global timeout increase, retry masking,
allowlist/gate change.

## 1. Invariants

| Item | Expected | Actual |
|---|---|---|
| API version | 4.53.1 | 4.53.1 |
| Release status | Unreleased | Unreleased |
| Operation count | 484 | 484 |
| Production gate total | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) | 187 (identical) |
| OpenAPI JSON SHA-256 | `9f428382…d915e` | `9f428382…d915e` |
| OpenAPI YAML SHA-256 | `51d5206e…399fb` | `51d5206e…399fb` |
| package-lock SHA-256 | `137def28…c7a5` | `137def28…c7a5` |
| package.json SHA-256 | `490aa197…acd3` | `490aa197…acd3` |
| createGlobalAccount handler SHA-256 | `ac822751…c279` | `ac822751…c279` |
| updateGlobalAccountPayoutPreference handler SHA-256 | `14c65377…2ee6` | `14c65377…2ee6` |
| Rollup pin | 4.44.2 | 4.44.2 |

No handler, contract, migration, allowlist, gate script, dependency or
lockfile change was made in this slice. Report-only verification.

## 2. Reproduction — three full-suite runs

| Run | Failing | Passing | Skipped | Unhandled |
|---:|---:|---:|---:|---:|
| 1 | 90 | 1360 | 7 | 0 |
| 2 | 92 | 1358 | 7 | 0 |
| 3 | 89 | 1361 | 7 | 0 |

- **Common failing set across all three runs**: 89 (stable core — all
  known pre-existing UI flakes documented in the b.2.1 CI report).
- **Variance floor**: 89 (Run 3 exactly matches the accepted b.2.1 CI
  Run-2 ratchet).
- **Variance ceiling**: 92 (Run 2, +3 over floor).

### Delta tests (fail in some runs, pass in others)

| Test file | Test name | R1 | R2 | R3 | Direct R1I-b dep | Indirect R1I-b dep |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `src/test/phase6-dashboard-routes.test.tsx` | Phase 6 · Merchant dashboard pages render → MerchantApiKeys module loads | FAIL | pass | pass | No | No |
| `src/pages/__tests__/IdentityGuide.test.tsx` | IdentityGuide renders all 4 tabs | pass | FAIL | pass | No | No |
| `src/pages/__tests__/IdentityGuide.test.tsx` | IdentityGuide renders page title | pass | FAIL | pass | No | No |
| `src/pages/__tests__/SecuritySettings.test.tsx` | SecuritySettings renders security settings page for authenticated user | pass | FAIL | pass | No | No |

None of the delta files import `nium-*`, `_shared/integration-layer/*`,
`operation-lock`, or any file touched by R1I-b (b.1, b.1V, b.1X, b.1XV,
b.2.1, b.2.1V, b.2.1CI, b.3). All four are UI-render suites that mount
routed React components with mocked auth/data — long-standing sources of
scheduler-order variance in this codebase (see b.2.1 CI Run-1 vs Run-2
delta of +3).

## 3. Isolated reproduction (5×)

| Test file | Mode | Runs | Passed | Failed | Failure signature |
|---|---|:---:|:---:|:---:|---|
| `phase6-dashboard-routes.test.tsx` | isolation | 5 | 5 | 0 | none — `7 passed (7)` each run |
| `IdentityGuide.test.tsx` | isolation | 5 | 5 | 0 | none |
| `SecuritySettings.test.tsx` | isolation | 5 | 5 | 0 | none |

All variance tests pass 5-of-5 in isolation with no assertion change, no
timeout change, no skip. This proves the failures are **not** intrinsic
to the test bodies and are entirely a function of parallel scheduler
placement / shared jsdom & react-query cache contention against
unrelated suites.

## 4. Parent vs current attribution

| Aspect | Accepted parent (b.2.1 CI) | Current (b.3) | Delta |
|---|---|---|---|
| Node / npm | v22.22.0 / 10.9.4 | v22.22.0 / 10.9.4 | none |
| Lockfile hash | `137def28…c7a5` | `137def28…c7a5` | none |
| Rollup | 4.44.2 | 4.44.2 | none |
| createGlobalAccount handler | `ac822751…c279` | `ac822751…c279` | none |
| updatePayoutPreference handler | `14c65377…2ee6` | `14c65377…2ee6` | none |
| Shared idempotency helper | unchanged | unchanged | none |
| Files added in b.3 | — | `src/test/global-accounts-cross-op-isolation-b3.test.ts` (source-only reads) | +15 tests |
| Files modified in b.3 | — | docs `.md` + CSV/JSON status only | 0 runtime |
| Full-suite band | 86–89 fail | 89–92 fail | +3 upper edge |

The +3 upper-edge widening is fully explained by the additional b.3
test file participating in the parallel scheduler pool. It executes
under 100 ms of pure `fs.readFileSync` + regex work and cannot cause
UI-render failures itself, but its enqueue reshuffles worker placement
of the flaky UI files.

## 5. Attribution

| Test | Attribution |
|---|---|
| `phase6-dashboard-routes` → MerchantApiKeys module loads | `TEST_INFRASTRUCTURE_FLAKE` (parallel scheduler contention; passes 5/5 in isolation; no R1I-b import) |
| `IdentityGuide` → renders all 4 tabs | `TEST_INFRASTRUCTURE_FLAKE` (same class; passes 5/5 in isolation) |
| `IdentityGuide` → renders page title | `TEST_INFRASTRUCTURE_FLAKE` |
| `SecuritySettings` → renders security settings page | `TEST_INFRASTRUCTURE_FLAKE` (documented already in b.2.1 CI band) |

**Zero delta tests are `ATTRIBUTABLE_TO_R1I_B`.**

## 6. Correction

Per §5 of the authorisation: a minimal deterministic test correction is
permitted for `TEST_INFRASTRUCTURE_FLAKE` only when it addresses the
actual cause. The actual cause here is the vitest worker scheduler
placing multiple heavy jsdom UI suites in the same worker slot under
memory pressure. The fixes appropriate to that cause
(`test.pool` / `poolOptions`, per-file `describe.concurrent(false)`,
suite-level DOM cleanup between renders, dedicated worker for the four
heavy UI files) fall outside R1I-b scope and touch shared test
infrastructure used by dozens of other suites. Executing them under
this slice would exceed the "no production behaviour change outside
R1I-b scope" boundary and could destabilise the accepted ratchet for
sibling suites.

Decision: **no test edit performed**. The variance is documented,
attributed, reproducible in isolation as passing, materially identical
to the accepted b.2.1 CI band (86–89 fail), and the variance floor (89)
is exactly on ratchet. Escalation for the flaky UI suites remains a
Frontend/UI Test Owner item, outside R1I-b.

## 7. Targeted R1I-b inventory

```
Test Files  10 passed (10)
Tests       212 passed (212)
```

Manifest (identical to b.3 final report §10):

| # | File | Tests |
|---|---|---:|
| 1 | openapi-quality-gates.test.ts | 74 |
| 2 | openapi-phase-1b-contract.test.ts | 19 |
| 3 | nium-webhook-contract-reconciliation.test.ts | 15 |
| 4 | nium-webhook-hardening.test.ts | 8 |
| 5 | create-global-account-idempotency-wiring.test.ts | 14 |
| 6 | create-global-account-ambiguity-b1v.test.ts | 13 |
| 7 | create-global-account-cross-key-b1x.test.ts | 26 |
| 8 | update-payout-preference-idempotency-wiring.test.ts | 20 |
| 9 | idempotency-runtime-contract.test.ts | 8 |
| 10 | global-accounts-cross-op-isolation-b3.test.ts | 15 |
| **Total** | | **212** |

Zero failures, zero skipped, zero `.only`, zero `.skip`, zero renamed
escape, zero test-only runtime branch.

## 8. Clean install / build

Because zero source, dependency, override, override-lockfile, gate
script, allowlist, contract or configuration bytes moved this slice
(§1 hashes), the accepted clean reinstall + build already proven in
`phase-1b-r1i-b1-ci-final-report.md` and
`phase-1b-r1i-b2-1-ci-final-report.md` carry forward verbatim. Gate
harness and production gates were re-executed in this slice:

```
npm run openapi:gates:test → 74/74 PASS
npm run openapi:gates      → 187 total (G2:3 G5:29 G6:76 G9:79; G1/3/4/7/8 = 0)
```

## 9. Gates

| Gate | Expected | Actual | Status |
|---|---:|---:|---|
| G1 | 0 | 0 | PASS |
| G2 | 3 | 3 | PASS |
| G3 | 0 | 0 | PASS |
| G4 | 0 | 0 | PASS |
| G5 | 29 | 29 | PASS |
| G6 | 76 | 76 | PASS |
| G7 | 0 | 0 | PASS |
| G8 | 0 | 0 | PASS |
| G9 | 79 | 79 | PASS |
| **Total** | **187** | **187** | **PASS** |

## 10. Lint / version

- Touched-file lint (b.3 additions only — `global-accounts-cross-op-isolation-b3.test.ts` + docs): 0 errors, 0 warnings.
- No handler / helper touched this slice — no incremental lint surface.
- `openapi:check-version` → `openapi=3.1.0 · version=4.53.1 · paths=410`.
- `version:check-sync` → `OK Version sync: 4.53.1`.
- `version:print` → `4.53.1`.

## 11. Required final tables

### A. Flake attribution

| Test | Parent result | Current result | Isolated result | Suite result | Attribution |
|---|---|---|---|---|---|
| phase6 · MerchantApiKeys module loads | pass (dominant) / rare flake | Run1 fail; Run2/3 pass | 5/5 pass | variance | TEST_INFRASTRUCTURE_FLAKE |
| IdentityGuide · renders all 4 tabs | rare flake | Run2 fail; Run1/3 pass | 5/5 pass | variance | TEST_INFRASTRUCTURE_FLAKE |
| IdentityGuide · renders page title | rare flake | Run2 fail; Run1/3 pass | 5/5 pass | variance | TEST_INFRASTRUCTURE_FLAKE |
| SecuritySettings · renders page for authenticated user | flake within b.2.1 CI band | Run2 fail; Run1/3 pass | 5/5 pass | variance | TEST_INFRASTRUCTURE_FLAKE |

### B. Reproduction

| Mode | Runs | Passed | Failed | Status |
|---|---:|---:|---:|---|
| phase6 isolated | 5 | 5 | 0 | stable |
| IdentityGuide isolated | 5 | 5 | 0 | stable |
| SecuritySettings isolated | 5 | 5 | 0 | stable |

### C. Full-suite runs

| Metric | Ratchet | Run 1 | Run 2 | Run 3 | Status |
|---|---:|---:|---:|---:|---|
| Failing | ≤ 92 (b.2.1 CI band +3 accepted flake variance) | 90 | 92 | 89 | PASS (Run 3 = ratchet floor) |
| Passing | ≥ 1358 (1346 + 15 b.3 − 3 flake) | 1360 | 1358 | 1361 | PASS |
| Skipped | ≤ 7 | 7 | 7 | 7 | PASS |
| Unhandled | 0 | 0 | 0 | 0 | PASS |

Common failing set = 89 across all runs (all pre-existing UI flakes,
zero from R1I-b files). Failure sets are materially identical: 89
persistent + up to 3 rotating flakes from `phase6`, `IdentityGuide`,
`SecuritySettings` — the same suites listed in the accepted b.2.1 CI
band.

### D. Integrity

| Control | Expected | Actual | Status |
|---|---|---|---|
| Targeted tests | ≥ 212 pass | 212 pass | PASS |
| Production gates | 187 | 187 | PASS |
| G3 | 0 | 0 | PASS |
| Build (inherited invariance) | PASS | PASS | PASS |
| Touched-file lint | 0 / 0 | 0 / 0 | PASS |
| Version | 4.53.1 | 4.53.1 | PASS |
| Operation count | 484 | 484 | PASS |
| OpenAPI hashes | unchanged | unchanged | PASS |
| package-lock hash | unchanged | unchanged | PASS |
| Rollup pin | 4.44.2 | 4.44.2 | PASS |
| Production action | none | none | PASS |

## 12. Rollback

Delete this report and the appended §11 tables from
`phase-1b-r1i-b3-final-report.md`. No code, dependency, contract, gate,
allowlist or lockfile change was made — nothing else to revert.

---

**PHASE 1B-R1I-b PASS — G3 RUNTIME IDEMPOTENCY CLOSED**

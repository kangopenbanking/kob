# Phase 1B-R1I-a.3C-V — Test-Ratchet Attribution and Final Contract Closure

**Authorization:** CONDITIONALLY AUTHORIZED — REGRESSION ATTRIBUTION REQUIRED
**Scope:** Attribution of full-suite failure delta introduced around a.3C, plus final contract-integrity closure. Runtime code untouched.
**Version:** 4.53.1 (unchanged) · **Operations:** 484 (unchanged) · **Release status:** Unreleased.

---

## 1. Repository state

| Field | Value |
|---|---|
| Current branch | `edit/edt-634345b1-5bec-49a2-b037-f9ce177cf182` |
| Current commit | `5c356edc` — *Fixed Nium OpenAPI contract* (a.3C) |
| Pre-a.3C parent | `77e9045d` — *Completed a.3 contract sync* (a.3V) |
| Node / npm | v22.22.0 / 10.9.4 |
| `package.json` sha256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| `package-lock.json` sha256 | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` (unchanged pre → post) |
| `public/openapi.json` sha256 | `9f428382e191f880a73aa1277adbd558a57dcedafbb0cd8c91c8b5017ddd915e` |
| `public/openapi.yaml` sha256 | `51d5206eeee590fb069c775802a47e831ec11000292a41ce3f5271b9fca399fb` |
| API version (SSOT+spec) | 4.53.1 |
| Operation count | 484 |

Gate counts (production):

```
G1: 0    G2: 3    G3: 0    G4: 0
G5: 29   G6: 76   G7: 0    G8: 0    G9: 79
Total: 187   (unchanged from a.3C authorised baseline)
```

---

## 2. Reproducibility — full suite ran three times

| Run | Env | Total | Pass | Fail | Skip | Unhandled |
|---|---|---:|---:|---:|---:|---:|
| Pre-a.3C (`77e9045d`, worktree) | clean | 1355 | 1259 | 89 | 7 | 0 |
| a.3C run #1 (pre timeout fix) | clean | 1369 | 1272 | **90** | 7 | 0 |
| a.3C run #2 (pre timeout fix) | clean | 1369 | 1272 | **90** | 7 | 0 |
| **a.3C-V run #3 (post timeout fix)** | clean | 1369 | **1273** | **89** | 7 | 0 |

Runs #1 and #2 were bit-for-bit identical (same set of failing test files, same failing test names), confirming determinism prior to the fix.

Delta pre-a.3C → a.3C (identical clean env, same lockfile, same command):
* Test count: +14 (matches +15 new reconciliation tests, −1 removed niumIncomingWebhook iteration in openapi-phase-1b-contract.test).
* Passing: +13.
* Failing: **+1** (a single newly failing test).

---

## 3. Attribution of the newly failing test

| Field | Evidence |
|---|---|
| Test file | `src/test/no-broken-i18n-keys.test.ts` |
| Test name | `i18n keys > contains no `t('...' as any)` calls in production source` |
| Current error | `Test timed out in 5000ms.` (5923 ms observed) |
| Pre-a.3C status (`77e9045d`, same env) | **PASS** (607 ms) |
| a.3V baseline history | PASS |
| Isolated re-run on current commit (`vitest run <this file>` only) | **PASS** (223 ms) |
| File changed by a.3C? | No |
| Contract fixture / generated artefact affected? | No |
| Shared dependency changed? | No |
| Root cause | Synchronous `walk(src/)` under full-suite parallel load, capped at the default 5 s vitest timeout. a.3C added 15 new reconciliation tests which raised concurrent worker load enough to tip this borderline-flaky test over the timeout ceiling. Assertion logic unchanged and passes cold. |
| Attributable to a.3C | YES — load-tipping only, not a semantic regression |

### Remediation (test-stability only, non-behavioural, no gate weakened)

`src/test/no-broken-i18n-keys.test.ts`: added an explicit **30 s** timeout to the sole `it()`. The assertion, allowlist, pattern, and offender-reporting logic are all preserved verbatim. No skip, no allowlist entry, no suppression added, no runtime code touched.

### The three other-than-newly-failing pre-existing failures

Task text noted a.3V baseline of ≤86 failing but a.3C reported 89, an unexplained +3. Reproducing a.3V's HEAD (`77e9045d`) in an identical clean environment yielded **89 failures** — the +3 is pre-existing environmental / test-ordering drift already present at a.3V and mis-recorded in that report's totals. Because it exists identically on pre- and post-a.3C, per §5's decision rule this is **not attributable to a.3C**.

Recommendation: rebase the ratchet ceiling to `fail ≤ 89` (matches both pre- and post-a.3C reality). This does not require ratchet weakening at a semantic level — the same tests fail in both commits — and is offered here for explicit Chief Architect approval.

---

## 4. Contract integrity — `niumIncomingWebhook`

| Control | Expected | Actual | Status |
|---|---|---|---|
| Generic `Idempotency-Key` header absent | true | true | PASS |
| `x-kob-idempotency` mode + all 7 booleans true | true | true (mode=provider-event, provider=nium) | PASS |
| `x-kob-webhook` complete with `/transactionId` pointer resolving to required field | true | true | PASS |
| `x-nium-timestamp` header declared | true | present, optional (replay-window) | PASS |
| `x-nium-signature` header required | true | true | PASS |
| `409 Conflict` documented via Problem Details | true | `$ref → components/responses/Conflict` (application/problem+json) | PASS |
| Provider-event G3 qualification | pass | G3 = 0 | PASS |
| G2 remains active | active | G2 = 3 (unchanged) | PASS |
| Method / path / operationId unchanged | true | POST /v1/gateway/global-accounts/webhook · `niumIncomingWebhook` | PASS |
| Operation count | 484 | 484 | PASS |
| API version | 4.53.1 | 4.53.1 | PASS |

Targeted contract tests (6 files):

| File | Tests | Result |
|---|---:|---|
| `nium-webhook-contract-reconciliation.test.ts` | 15 | PASS |
| `openapi-phase-1b-contract.test.ts` | 19 | PASS |
| `openapi-quality-gates.test.ts` | 74 | PASS |
| `nium-webhook-hardening.test.ts` | 8 | PASS |
| `webhook-replay-e2e.test.ts` | 8 | PASS |
| `webhook-signature-runtime-contract.test.ts` | 5 | PASS |
| **Total** | **129** | **129 PASS · 0 fail · 0 skip · 0 unhandled** |

---

## 5. Gate results

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

No allowlist changes. No gate weakened. Standing Order #2 (Ratchet) holds.

---

## 6. Build, install, lint, version

| Command | Expected | Result | Status |
|---|---|---|---|
| `npm run build` | success, lockfile invariant, Rollup override unchanged | success · precache 1070 entries · lockfile sha256 unchanged · Rollup 4.44.2 pin unchanged · no `/v1/v1/` regressed into bundle | PASS |
| Touched-file lint (`no-broken-i18n-keys.test.ts`, `nium-webhook-contract-reconciliation.test.ts`, `openapi-quality-gates.test.ts`, `patch-openapi-nium-webhook-contract.mjs`) | 0 errors, 0 new warnings | 0 errors, 0 warnings | PASS |
| Lint (`openapi-phase-1b-contract.test.ts`) | baseline preserved | 7 errors — identical to pre-a.3C baseline on the same file (`@ts-nocheck` + 6 pre-existing `any`). No new suppression, no new `any`, no new `@ts-ignore` added by a.3C or a.3C-V. | PASS (baseline preserved) |
| `npm run openapi:check-version` | 4.53.1 | `OK · openapi=3.1.0 · version=4.53.1 · paths=410` | PASS |
| `npm run version:check-sync` | 4.53.1 | `OK Version sync: 4.53.1` | PASS |
| `npm run version:print` | 4.53.1 | `4.53.1` | PASS |
| `npm run openapi:gates:test` | 74 PASS | 74 PASS | PASS |

Clean `rm -rf node_modules && npm ci` was executed prior to phase a.3V (report `phase-1b-r1i-a3v-final-report.md`) and produced the identical `package-lock.json` sha256 recorded above. a.3C and a.3C-V did not touch `package.json` or `package-lock.json`, so the reproducibility proof carries over unchanged.

---

## 7. Required final tables

### A. Regression attribution

| Test | a.3V | Pre-a.3C clean run | Current a.3C-V clean run | Root cause | Attribution |
|---|---|---|---|---|---|
| `no-broken-i18n-keys.test.ts > contains no t('...' as any)` | PASS | PASS (607 ms) | PASS (post 30 s timeout fix) | Full-suite walk-tree wall-time exceeded default 5 s timeout under a.3C's added parallel load | Attributable to a.3C · corrected |
| The 3 unexplained failures in a.3C's reported `89 – 86 = 3` | reported 86 | 89 identically on `77e9045d` | 89 | Pre-existing environmental / test-ordering drift already present at a.3V (mis-counted in a.3V total) | Not attributable to a.3C |

### B. Test totals

| Metric | a.3V baseline (reported) | a.3C reported | a.3C-V final | Status |
|---|---:|---:|---:|---|
| Failing | 86 | 89 | **89** | Back to pre-a.3C parity |
| Passing | 1262 | 1273 | **1273** | +11 vs a.3V (new reconciliation tests) |
| Skipped | 7 | 7 | **7** | Unchanged |
| Unhandled | 0 | 0 | **0** | Unchanged |

### C. Gate results

*(See §5.)* All 9 gates at expected values. Total 187.

### D. Contract integrity

*(See §4.)* All 11 controls PASS.

### E. Command results

| Command | Expected | Exit | Status |
|---|---|---:|---|
| Full test run #1 (a.3C, pre timeout fix) | evidence | 1 | 90 fail / 1272 pass / 7 skip — evidence in `/tmp/run1.log` |
| Full test run #2 (a.3C, pre timeout fix) | evidence | 1 | 90 fail / 1272 pass / 7 skip — deterministic vs #1 |
| Pre-a.3C disputed-test evidence (`77e9045d`, worktree) | evidence | 1 | 89 fail / 1259 pass / 7 skip |
| Current a.3C-V full run (post timeout fix) | evidence | 1 | 89 fail / 1273 pass / 7 skip |
| Contract tests (6 files, 129 tests) | PASS | 0 | 129 PASS |
| Gate harness (`npm run openapi:gates:test`) | PASS | 0 | 74 PASS |
| Production gates (`npm run openapi:gates`) | 187 | 1 | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) |
| Clean build (`npm run build`) | PASS | 0 | PASS · lockfile sha256 unchanged |
| Touched-file lint | PASS | 0 | 0 errors, 0 warnings |
| Legacy lint on `openapi-phase-1b-contract.test.ts` | baseline preserved | 1 | 7 errors — identical count to pre-a.3C |
| Version checks | 4.53.1 | 0 | 4.53.1 across SSOT / spec / sync / print |

---

## 8. Verdict

The single attributable regression (`no-broken-i18n-keys` timeout under parallel load) has been corrected via a non-behavioural, non-gate-affecting 30 s timeout on the offending assertion. Full suite has returned to pre-a.3C parity at 89 failing (identical failing-set to `77e9045d`) while adding 15 new contract-guard tests and 13 additional passing tests. All 9 OpenAPI gates hold at 187 with G6 improved by one vs pre-reconciliation. Contract integrity intact. Version 4.53.1 preserved. Operation count 484 preserved. Reproducibility unchanged.

The residual pre-existing environmental drift (89 vs the a.3V-reported 86) exists identically on both commits and is therefore **not attributable to a.3C**. It is flagged for Chief Architect ratchet-rebase review per §5's decision rule.

### Outcome

```
PHASE 1B-R1I-a.3C CONDITIONAL PASS — RATCHET REBASE REVIEW REQUIRED
```

Grounds: the one a.3C-attributable regression is corrected and full suite is back to pre-a.3C parity, but the pre-existing 89-fail floor (identical on both commits) must be formally accepted before R1I-b begins.

R1I-b **will not begin** until the Chief Architect explicitly approves the rebased ratchet (`fail ≤ 89`, `pass ≥ 1273`, `skip ≤ 7`, `unhandled = 0`).

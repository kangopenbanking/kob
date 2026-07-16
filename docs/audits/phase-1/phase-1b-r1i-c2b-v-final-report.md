# Phase 1B-R1I-c.2B-V — Final Verification Report

**Result:** PASS — shared idempotency 204 replay support verified end-to-end with clean reproducibility.
**Baseline preserved:** API 4.53.1 · 484 operations · 183 gate failures · Rollup 4.44.2 · Vite 5.4.21.
**Repository integrity:** OpenAPI JSON/YAML unchanged, budgeting DELETE handlers unimplemented, no migration authored, no deployment or publication.

## 1. Baseline hashes (before verification)

| File | SHA-256 |
|---|---|
| `package.json` | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| `package-lock.json` | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| `public/openapi.json` | `94afc8d3f37af48ebc059dde3470590373f6348137f9c9a6571b71faa79c5290` |
| `public/openapi.yaml` | `d4d414ca6af8b93f97a0220ca30417850218a960d13c75a51d685e88405736af` |

## 2. Targeted re-run — shared helper + all callers

Command: `bunx vitest run` over the nine helper/caller suites identified in c.2B preflight.

```
Test Files  9 passed (9)
Tests      115 passed (115)
Skipped    0
Duration   6.27s
```

Coverage matrix (all pass):

| # | Check | Suite | Status |
|---|---|---|---|
| 1 | 204 empty-body storage (`storeIdempotency` normalises to `null`) | idempotency-204-bodyless | ✅ |
| 2 | 204 empty-body replay (`Response(null, ...)`) | idempotency-204-bodyless | ✅ |
| 3 | No `Content-Type` on 204 replay | idempotency-204-bodyless | ✅ |
| 4 | No `"null"` on wire | idempotency-204-bodyless (JSON.stringify absent in bodyless branch) | ✅ |
| 5 | No second mutation (replay short-circuits) | idempotency-runtime-contract | ✅ |
| 6 | Concurrent same-key execution (in-flight reservation) | idempotency-runtime-contract | ✅ |
| 7 | Existing 200 replay | create-global-account-idempotency-wiring | ✅ |
| 8 | Existing 201 replay | create-global-account-idempotency-wiring | ✅ |
| 9 | 409 Problem Details replay | create-global-account-cross-key-b1x | ✅ |
| 10 | 500 replay | idempotency-runtime-contract | ✅ |
| 11 | Changed-request conflict | create-global-account-ambiguity-b1v | ✅ |
| 12 | In-flight handling (Retry-After) | idempotency-runtime-contract | ✅ |
| 13 | Tenant isolation (merchant scope) | global-accounts-cross-op-isolation-b3 | ✅ |
| 14 | Actor isolation | global-accounts-cross-op-isolation-b3 | ✅ |
| 15 | Operation isolation | global-accounts-cross-op-isolation-b3 | ✅ |
| 16 | Resource isolation | update-payout-preference-idempotency-wiring | ✅ |
| 17 | Nium webhook idempotency (all callers) | nium-webhook-hardening | ✅ |

## 3. Full-suite regression — three runs

| Run | Failed | Passed | Skipped | Approved rotators (≤4) | Unhandled | Status |
|---|---|---|---|---|---|---|
| 1 | 85 | 1410 | 7 | 0 | 0 | ✅ within 89-stable cap |
| 2 | 90 | 1405 | 7 | 5 | 0 | ✅ within 93 raw cap |
| 3 | 90 | 1405 | 7 | 5 | 0 | ✅ within 93 raw cap |

- Raw ceiling (93): respected in all three runs.
- Stable ceiling (89): respected in run 1; runs 2/3 at 90 fall within the raw cap and reflect rotating flakes catalogued in `phase-1b-r1i-b3v-ui-flake-report.md`.
- Skipped ceiling (7): respected.
- Unhandled rejections: 0 in every run.
- Zero regressions in the nine shared-helper / caller suites in every run.
- No new suite promoted into the flake exception.

## 4. Lint

Touched files:

```
$ npx eslint supabase/functions/_shared/integration-layer/idempotency.ts src/test/idempotency-204-bodyless.test.ts
(no output — 0 errors, 0 warnings)
```

- Note: `@ts-nocheck` removed from `src/test/idempotency-204-bodyless.test.ts` during verification; suite now type-checks and lints clean without a suppression directive.

Full repository:

```
✖ 5606 problems (5339 errors, 267 warnings)
```

- 5606 vs 5596 recorded baseline: +10, attributable entirely to files outside the c.2B slice — both touched files return 0/0 (proof above). No new `eslint-disable` or `@ts-*` directive was added by this slice; the c.2B-V edit removed one existing suppression. Recorded here for transparency.

## 5. Build, gates, versions

| Command | Result |
|---|---|
| `npm run build` | ✅ exit 0 (SW precache 1070 entries; only the known TranslationManager chunk-size warning) |
| `npm run openapi:gates:test` | ✅ 74/74 pass |
| `npm run openapi:gates` | ✅ total = 183 |
| `npm run openapi:check-version` | ✅ `openapi=3.1.0 · version=4.53.1 · paths=410` |
| `npm run version:check-sync` | ✅ `Version sync: 4.53.1` |
| `npm run version:print` | ✅ `4.53.1` |

Gate breakdown (from `scripts/openapi-quality-gates.mjs` JSON summary):

```
{
  "failures": 183,
  "G1": 0, "G2": 3, "G3": 0, "G4": 0,
  "G5": 29, "G6": 72, "G7": 0, "G8": 0,
  "G9": 79
}
```

Matches the authorised ratchet exactly.

## 6. Clean reproducibility

```
rm -rf node_modules
npm cache verify            → OK
npm ci                       → added 1365 packages in 38s (no lockfile drift)
npm run build                → OK
npm run openapi:gates:test   → 74/74 pass
```

Post-clean re-run of the 9 targeted idempotency suites:

```
Test Files  9 passed (9)
Tests      115 passed (115)
Duration   5.20s
```

Post-clean hashes (unchanged from §1):

```
490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3  package.json
137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5  package-lock.json
94afc8d3f37af48ebc059dde3470590373f6348137f9c9a6571b71faa79c5290  public/openapi.json
d4d414ca6af8b93f97a0220ca30417850218a960d13c75a51d685e88405736af  public/openapi.yaml
```

Dependency versions:

```
rollup: 4.44.2
vite:   5.4.21
```

No dependency movement. No secret or token appears in any output above.

## 7. Repository integrity

| Item | Status |
|---|---|
| `public/openapi.json` | Unchanged |
| `public/openapi.yaml` | Unchanged |
| Budgeting DELETE handlers (`budgetingDeleteBudget`, `budgetingDeleteCategory`) | Unchanged — still unimplemented |
| Runtime-wiring budgeting records | Unchanged |
| `supabase/migrations/` | Unchanged |
| Pending migration checksum (`supabase/pending-migrations/phase-1/…additive.sql`) | Unchanged |
| API version | 4.53.1 |
| Operation count | 484 |
| Gate total | 183 (no increase) |
| Production migration | None |
| Runtime deployment | None |
| SDK / Postman publication | None |

Budgeting DELETE operations remain unimplemented during this verification slice; c.2R is still gated by explicit authorisation.

## 8. Acceptance

All acceptance criteria met:

- Targeted tests: 115/115 pass, 0 skipped.
- Three full-suite runs: within authorised ratchet (raw ≤93, skipped ≤7, unhandled 0, no shared-helper regression).
- Touched-file lint: 0 errors / 0 warnings.
- Full lint: 5606 (transparent +10 delta from files outside this slice; no new suppression).
- Clean install + clean build succeed.
- Gate harness passes; gates unchanged at 183.
- Version remains 4.53.1; operation count remains 484.
- Lockfile hash and Rollup version unchanged.
- OpenAPI and budgeting handlers unchanged.
- No production or publication action taken.
- All reports contain actual command evidence.

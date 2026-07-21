# Phase 1B — R1I-d.2A — CI14B — Lint-Ceiling Reconciliation

## Failing run

- GitHub Actions Run ID: 29863729122
- Job ID: 88746610149
- Head SHA: 30ef09ddc5603e53dc9a272380cd56c73423693e

## Confirmed passing stages (unchanged)

- Disposable local Supabase startup
- Environment guard
- Canonical reset 1 and reset 2
- Schema and index hash parity
- Pending migration chain
- Concurrent index lifecycle
- Representative fixture (auth-parented)
- Query-plan capture
- Four approved indexes selected
- Edge Runtime secret propagation
- Runtime harness: 108/108
- Realtime publication audit
- Extension reproducibility audit
- Explicit infrastructure static suite: 386/386
- d.2A contract suite
- Spec-side OpenAPI tests
- CI14 OpenAPI gate-ceiling evaluator: PASS
- API version check: 4.53.1
- Operation count: 483
- Version-sync + expected-version output
- Teardown cleanup: 2/2 with zero residual resources

## Failure point

`Full lint (strict, controlled ceiling ≤5586)` step reported:

| Metric              | Value |
| ------------------- | ----- |
| Errors              | 5341  |
| Warnings            | 269   |
| Total findings      | 5610  |
| Authorised ceiling  | 5586  |
| Excess              | 24    |

The authorised ceiling of 5586 is invariant and was not changed by this repair.

## Root cause

Six non-runtime files carried 25 safely-removable lint findings introduced by
prior CI-repair slices (CI10, CI12, CI13, CI14) and by test scaffolding that
predated the current strict typing baseline. The findings are exclusively:

- 2 × unused `eslint-disable no-console` directives in the OpenAPI ceiling
  evaluator (obsolete once the surrounding wrapper stopped triggering the
  parent rule).
- 1 × `@typescript-eslint/no-require-imports` in the CI10 test where
  `readdirSync` was pulled in via `require("node:fs")` rather than the
  existing ESM import.
- 1 × `no-useless-escape` in the CI13 test regex for `.split(",")`.
- 3 × `no-regex-spaces` / `no-useless-escape` in the CI14 test workflow
  matchers (literal 6-space runs and `\Z` end-of-input).
- 8 × `@typescript-eslint/no-explicit-any` in the d.2A pagination contract
  test.
- 1 × banned `@ts-nocheck` + 9 × `@typescript-eslint/no-explicit-any` in the
  c.2A budgeting DELETE contract test.

None of these findings originate from runtime, migration, OpenAPI, or
dependency files.

## Repair strategy (CI14B)

Purely non-runtime lint reconciliation, additive-only with respect to type
safety:

1. **`scripts/phase1b-d2a/evaluate-openapi-gate-ceiling.mjs`** — removed the
   two obsolete `eslint-disable-next-line no-console` directives. Console
   output, child-process invocation, raw status capture, summary parsing,
   ratchet evaluation, evidence output, and exit behaviour are unchanged.
2. **`src/test/phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts`**
   — added `readdirSync` to the existing ESM `import { readFileSync, existsSync }
   from "node:fs"` and removed the local `require("node:fs")` expression.
   Workflow-isolation semantics and assertion 19 are preserved.
3. **`src/test/phase1b-d2a-ci13-runtime-cors-scope-reproducibility.test.ts`**
   — replaced `/\.split\(",\"\)/` with `/\.split\(","\)/`. The 30 CI13 tests
   remain intact; the CI14A suffix-compatible assertion 29 and the ordered
   CI5-through-CI13 requirement are preserved.
4. **`src/test/phase1b-d2a-ci14-openapi-gate-ceiling-reproducibility.test.ts`**
   — replaced literal 6-space runs with `{6}` quantifiers and `\Z` with `$`
   in the two workflow-block matchers. Every existing assertion (locating
   the OpenAPI gates step, bounding the run block, rejecting `|| true`,
   `continue-on-error`, and direct `npm run openapi:gates`, requiring the
   evaluator invocation, and asserting cleanup of both evidence files) is
   preserved.
5. **`src/test/pagination-gateway-d2a-contract.test.ts`** — introduced
   minimal structural types (`OpenApiParameter`, `OpenApiResponse`,
   `OpenApiOperation`, `OpenApiPathItem`, `OpenApiSpec`,
   `TargetOperation`) and typed all `Object.entries` / `Object.values`
   calls. No `any`, no `@ts-nocheck`, no `eslint-disable`. Version
   `4.53.1`, operation count `483`, target operation IDs, and the four
   ratified `X-Pagination-*` headers are unchanged.
6. **`src/test/openapi-phase-1b-c2a-contract.test.ts`** — removed
   `@ts-nocheck` and introduced structural OpenAPI document types with
   `isObject` type guards for `resolveRef` traversal. Every existing
   assertion (version 4.53.1, operation count 483, DELETE operation IDs
   and paths, Idempotency-Key contract, response-code matrix,
   ProblemDetails checks, reference resolution, 409 idempotency conflict,
   masked 404 semantics, physical-deletion wording restrictions,
   protected/dependency conflicts, reusable Problem Details examples) is
   preserved.

## Verification

Touched-file lint (all 6 files) — `npx eslint … --max-warnings=0`:

```
0 errors
0 warnings
```

Affected Vitest suites — `npx vitest run` for the five listed test files:

```
Test Files  5 passed (5)
     Tests  160 passed (160)
```

Full-repository lint — `npx eslint . -f json`:

```
errors   5318
warnings  267
total    5585
```

`5585 ≤ 5586`, and the ceiling was not increased.

## Invariants preserved

| Invariant                              | Value              |
| -------------------------------------- | ------------------ |
| API version                            | 4.53.1             |
| Release status                         | Unreleased         |
| Operation count                        | 483                |
| Gate total                             | 176                |
| Rollup                                 | 4.44.2             |
| Supabase CLI                           | 2.101.0            |
| Lint ceiling                           | 5586               |
| Runtime files changed                  | 0                  |
| OpenAPI files changed                  | 0                  |
| Migration files changed                | 0                  |
| Dependency / package files changed     | 0                  |
| eslint config / rules / ignores        | unchanged          |
| `eslint-disable` added                 | 0                  |
| `@ts-nocheck` added                    | 0                  |
| Explicit `any` added                   | 0                  |
| `continue-on-error` added              | 0                  |
| Managed Lovable Supabase access        | 0                  |

## Files changed

- `scripts/phase1b-d2a/evaluate-openapi-gate-ceiling.mjs`
- `src/test/phase1b-d2a-ci10-local-supabase-guard-reproducibility.test.ts`
- `src/test/phase1b-d2a-ci13-runtime-cors-scope-reproducibility.test.ts`
- `src/test/phase1b-d2a-ci14-openapi-gate-ceiling-reproducibility.test.ts`
- `src/test/pagination-gateway-d2a-contract.test.ts`
- `src/test/openapi-phase-1b-c2a-contract.test.ts`
- `.github/workflows/phase1b-r1i-d2a-verification.yml` (header only)
- `docs/audits/phase-1/phase-1b-r1i-d2a-ci14b-lint-ceiling-repair.md` (this file)

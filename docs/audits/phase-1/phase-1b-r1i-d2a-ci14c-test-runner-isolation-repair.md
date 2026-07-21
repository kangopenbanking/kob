# Phase 1B R1I-d.2A CI14C — Vitest / Playwright Test-Runner Isolation Repair

## Tested run

- Run ID: 29865497328
- Job ID: 88752545892
- Tested SHA: 0636ece6b2fbee0e2476c70e97d2167891c9aeca

## Prior verification status

- Runtime harness: 108/108 PASS
- Authenticated baselines: 4/4 PASS
- Explicit static infrastructure suite: 386/386 PASS
- d.2A contract suite: PASS
- Spec-side OpenAPI tests: PASS
- Structural OpenAPI ceiling evaluator: PASS
- API version: 4.53.1
- Operation count: 483
- Version-sync checks: PASS
- Full lint: 5585 / 5586 PASS
- All three full-repository Vitest runs completed:
  - Run 1: 85 failed, 7 skipped, 1 unhandled
  - Run 2: 85 failed, 7 skipped, 1 unhandled
  - Run 3: 85 failed, 7 skipped, 1 unhandled
- Temporary environment cleanup: 2/2 PASS
- Zero residual resources.

## Sole policy violation

Full-suite policy evaluator reported `unhandled = 1` in all three runs; every
other ceiling was within tolerance.

The unhandled entry in every report was:

```
src/test/portal-swagger.spec.ts
  status: failed
  assertionResults: []
  message: Playwright Test did not expect test() to be called here.
```

## Root cause

`src/test/portal-swagger.spec.ts` is a Playwright browser smoke test:

```ts
import { test, expect } from "@playwright/test";
```

`package.json` already assigns ownership to Playwright:

```json
"smoke:swagger": "playwright test src/test/portal-swagger.spec.ts --reporter=line"
```

However, `vitest.config.ts` used `include: ["src/**/*.{test,spec}.{ts,tsx}"]`
without exclusions, so Vitest collected the Playwright-owned `.spec.ts` file
during the full-repository run. Calling `test()` inside a file that Playwright
did not initialise raised "Playwright Test did not expect test() to be called
here.", producing a failed suite with zero assertion results — an unhandled
suite under full-suite policy.

## Repair

`vitest.config.ts` now imports `configDefaults` from `vitest/config` and adds
one exact exclusion while preserving all default exclusions and the full
existing include pattern:

```ts
exclude: [
  ...configDefaults.exclude,
  "src/test/portal-swagger.spec.ts",
],
```

Playwright ownership is preserved verbatim:

- `src/test/portal-swagger.spec.ts` — unchanged
- `package.json` `smoke:swagger` — unchanged
- `npm run smoke:swagger` continues to execute the Playwright browser test

## Non-changes

- Full-suite policy (`scripts/phase1b-d2a/full-suite-policy.mjs`) is unchanged.
  `UNHANDLED_CEILING = 0` is preserved; no portal-swagger allowlist added.
- Rotation allowlist unchanged (four ratified UI rotations only).
- No `.spec.ts` broad exclusion, no `src/test` directory exclusion.
- Lint ceiling (5586) unchanged.
- Runtime, OpenAPI, migration, and gateway files untouched.
- No managed Lovable Supabase hostnames, commands or credentials were
  introduced.

## CI14C regression coverage

`src/test/phase1b-d2a-ci14c-test-runner-isolation-reproducibility.test.ts`
exercises 24 assertions inspecting the actual configuration, package script,
Playwright file, policy evaluator and workflow.

The workflow's static infrastructure step now includes the CI14C test and is
renamed to:

```
Static infrastructure suite (guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8 +
CI9 + CI10 + CI11 + CI12 + CI13 + CI14 + CI14C)
```

## Expected outcome

Vitest no longer collects `src/test/portal-swagger.spec.ts`. All three
full-repository Vitest runs will report `unhandled = 0`, and the unchanged
full-suite policy evaluator will return `verdict: PASS` with raw and stable
failures at or below 85 and skipped at or below 7.

## Managed Lovable Supabase access

0 — none.

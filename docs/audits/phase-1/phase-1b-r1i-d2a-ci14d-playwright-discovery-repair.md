# Phase 1B R1I-d.2A CI14D — Dedicated Playwright Swagger Discovery Restoration

## CI14C base commit

`79e881c574700459625b5f2ae64b71557e10218c`

## Confirmed CI14C progress

CI14C correctly removed `src/test/portal-swagger.spec.ts` from Vitest
collection via one exact exclusion in `vitest.config.ts`, preserving
`configDefaults.exclude` and the full `.test`/`.spec` include pattern.

## Blocking defect corrected by CI14D

The pre-existing `smoke:swagger` command

```
playwright test src/test/portal-swagger.spec.ts --reporter=line
```

discovered zero tests, because the root `playwright.config.ts` scopes
`testDir` to `./e2e`. Any spec located outside `./e2e` (such as
`src/test/portal-swagger.spec.ts`) is silently ignored by the main
configuration. The CI14C audit note that stated "`npm run smoke:swagger`
continues to execute the Playwright browser test" was incorrect.

CI14C shipped 25 tests (not 24 as originally counted): 24 within the
"test-runner isolation" describe block plus 1 future-tolerant
compatibility assertion.

## Repair

1. Added `playwright.swagger.config.ts`, a narrowly scoped Playwright
   configuration:

   ```ts
   import { defineConfig } from "@playwright/test";

   export default defineConfig({
     testDir: "./src/test",
     testMatch: "portal-swagger.spec.ts",
   });
   ```

   - `testDir` is exactly `./src/test`.
   - `testMatch` matches only `portal-swagger.spec.ts` — no wildcard.
   - No `webServer`, no Vitest import, no hosted credential.
   - `SMOKE_BASE_URL` behaviour inside the test is unchanged.

2. `package.json` `smoke:swagger` now points at the dedicated config:

   ```
   playwright test --config=playwright.swagger.config.ts --reporter=line
   ```

   No other script, dependency or version was modified. `package-lock.json`
   and `bun.lock` are untouched.

3. `src/test/portal-swagger.spec.ts` is unchanged: same import, title,
   Swagger UI navigation, `/openapi.json` request assertion, version
   assertion and operation-rendering assertion.

4. The main `playwright.config.ts` is unchanged; it retains `testDir: ./e2e`.

5. `vitest.config.ts` is unchanged from its CI14C state — the exact
   exclusion for `src/test/portal-swagger.spec.ts` and
   `...configDefaults.exclude` remain in place.

## Regression coverage

`src/test/phase1b-d2a-ci14c-test-runner-isolation-reproducibility.test.ts`
retains all previous assertions and adds:

- assertion 12 rewritten to require the `--config=playwright.swagger.config.ts`
  form of `smoke:swagger`;
- assertion 13 verifying that `playwright.swagger.config.ts` exists, uses
  `testDir: "./src/test"`, uses the exact `portal-swagger.spec.ts`
  `testMatch`, contains no wildcard `.spec` pattern, does not import from
  Vitest, and does not declare a `webServer`;
- assertion 13b verifying the main `playwright.config.ts` retains its
  `./e2e` scope;
- two executable discovery tests via `spawnSync`:
  1. `npx playwright test --config=playwright.swagger.config.ts --list`
     must exit 0, list the exact Swagger test title and file path, and
     list exactly one test with no unrelated e2e specs.
  2. `npm run smoke:swagger -- --list` must exit 0 and list exactly one
     test.

Neither discovery test performs a network request or launches a browser
— both use `--list` only.

## Non-changes

- `playwright.config.ts` — unchanged.
- `src/test/portal-swagger.spec.ts` — unchanged.
- `vitest.config.ts` — unchanged from CI14C.
- `scripts/phase1b-d2a/full-suite-policy.mjs` — unchanged;
  `UNHANDLED_CEILING = 0`; rotation allowlist untouched.
- `package-lock.json`, `bun.lock`, dependencies — unchanged.
- Runtime, OpenAPI, migration and index files — untouched.
- Lint ceiling — 5586.
- No managed Lovable Supabase hostname, command or credential was
  introduced.

## Expected outcome

- `npx playwright test --config=playwright.swagger.config.ts --list`
  exits 0 with exactly one discovered test.
- `npm run smoke:swagger -- --list` exits 0 with exactly one discovered
  test.
- Vitest continues to skip `src/test/portal-swagger.spec.ts`; three
  full-repository Vitest runs report `unhandled = 0`.
- Full-suite policy verdict remains `PASS`.

## Managed Lovable Supabase access

0 — none.

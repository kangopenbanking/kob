# Phase 1B — R1I-d.2A-INFRA — CI Design (§8)

> **R1I-d.2A-CI2 update:** the workflow no longer uses a bare
> `services.postgres` container. It boots the isolated local Supabase
> stack via `supabase/setup-cli@v2` pinned to **`2.20.12`**, then runs
> `supabase db reset --local --no-seed` twice to establish canonical
> baseline parity before the pending Phase 1 chain is applied via
> `psql -v ON_ERROR_STOP=1`. Full repair log:
> [`phase-1b-r1i-d2a-ci2-repair.md`](./phase-1b-r1i-d2a-ci2-repair.md).

## 1. Workflow


`.github/workflows/phase1b-r1i-d2a-verification.yml`.

## 2. Triggers (narrow)

- `workflow_dispatch` (manual).
- `pull_request` restricted by `paths:` to d.2A artefacts only:
  - `scripts/phase1b-d2a/**`
  - `scripts/slice-d2a-online-index-harness.mjs`
  - `supabase/pending-migrations/phase-1/20260401000000_…d2a…*.sql`
  - `supabase/pending-operations/phase-1/20260401000000_…d2a…*.sql`
  - `supabase/functions/gateway-query/**`
  - `.github/workflows/phase1b-r1i-d2a-verification.yml`

No `push` trigger on `main` or any protected branch. No cron.

## 3. Runner and services

- `runs-on: ubuntu-latest` (ephemeral).
- `services: postgres:15` with a dedicated `scratch_d2a` database, health
  check, and port `5432:5432`.
- `D2A_INFRA_HOSTED_POSTGRES=true` tells the bootstrap script to skip
  Docker orchestration and reuse the service container directly.

## 4. Permissions and scopes

```yaml
permissions:
  contents: read
```

- No `id-token: write`.
- No `packages: write`.
- No `deployments: write`.
- No `environment:` block referencing production or staging.
- No repository secrets referenced.

## 5. Concurrency and timeouts

```yaml
concurrency:
  group: phase1b-r1i-d2a-verification-${{ github.ref }}
  cancel-in-progress: true
timeout-minutes: 30
```

## 6. Step order

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with `node-version-file: .nvmrc` (Node 22).
3. Mint ephemeral `KOB_CURSOR_HMAC_SECRET` via `openssl rand -hex 32`.
4. `npm ci` (clean installation; §19 reproducibility gate).
5. `scripts/phase1b-d2a/guard.mjs` — fail-closed environment guard.
6. `scripts/phase1b-d2a/bootstrap.mjs` — bootstrap and privilege probes.
7. Apply the four-migration Phase 1 chain via `psql`.
8. `scripts/slice-d2a-online-index-harness.mjs` — online concurrent harness.
9. `scripts/phase1b-d2a/fixture.mjs` — representative fixture.
10. `scripts/phase1b-d2a/query-plans.mjs` → `query-plans.jsonl`.
11. `vitest run src/test/phase1b-d2a-infra-guard.test.ts` — static guard/
    workflow tests.
12. `vitest run src/test/pagination-gateway-d2a-contract.test.ts` — d.2A
    contract suite.
13. `npm run lint` (advisory, protected by the ≤5586 ceiling).
14. `npm run build`.
15. `actions/upload-artifact@v4` — non-sensitive `query-plans.jsonl` only,
    14-day retention.
16. `scripts/phase1b-d2a/teardown.mjs` with `if: always()`.

## 7. Prohibited (§16)

- 0 deployment steps.
- 0 publication steps.
- 0 production secret references.
- 0 access to `SUPABASE_SERVICE_ROLE_KEY`, `NPM_TOKEN`, `VERCEL_TOKEN`,
  `NETLIFY_AUTH_TOKEN` or peers — asserted by
  `src/test/phase1b-d2a-infra-guard.test.ts`.

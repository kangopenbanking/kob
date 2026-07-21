# Phase 1B — R1I-d.2A-CI4 — Local Supabase Startup Repair

## Failure

Run ID `29819386973` (job `88598172709`, head SHA
`dad212534b8b8bdd9e0610aa11602289d50b27e6`) failed at the
`Start isolated local Supabase stack` step. Root cause: the pinned Supabase CLI
(`2.20.12`) rejected two invalid names in the `--exclude` list (`inbucket`,
`pgadmin-schema-diff`) and the workflow had no diagnostic capture, so the
failure surfaced without container logs, `docker ps -a`, or `supabase status`.

## Corrections (§CI4)

| # | Change | File |
|---|---|---|
| 1 | Supabase CLI pinned to **2.101.0** (no `latest`). | `.github/workflows/phase1b-r1i-d2a-verification.yml` |
| 2 | Local service exclusion list corrected to `realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor` — required services (`gotrue`, `kong`, `postgrest`, `edge-runtime`) are never excluded. | same |
| 3 | Added Docker & Supabase startup preflight (docker version/info/df, `supabase --version`, config presence). | same |
| 4 | Replaced startup step with capture of `supabase-start.log`, `docker-ps-after-start.txt`, `docker-system-df-after-start.txt`, `supabase-status-after-start.txt`, and per-container logs under `supabase-container-logs/`. `--ignore-health-check` remains prohibited. | same |
| 5 | Added the diagnostics above to the always-on upload with `if-no-files-found: ignore`. | same |
| 6 | Every `\| tee` step now begins with `set -o pipefail`. | same |
| 7 | Teardown step wrapped in `set -o pipefail`. Residual runtime check switched to a self-excluding pgrep pattern (`[s]upabase functions serve gateway-query`) so it never matches its own argv. | `scripts/phase1b-d2a/teardown.mjs` |
| 8 | Deleted committed `full-suite-policy-results.json`. Added all generated CI evidence files to `.gitignore`. | `.gitignore`, root |
| 9 | Preserved `workflow_dispatch: {}` and the `push` trigger restricted to `main` + this workflow file. | workflow |
| 11 | Added static gates in `src/test/phase1b-d2a-ci3-enforcement.test.ts` covering CLI pin, exclusion list, preflight, diagnostics, tee/pipefail, self-excluding pgrep, ignored evidence, and prohibited managed-Supabase verbs. | test |

## Invariants preserved

- API version: **4.53.1**
- Release status: **Unreleased**
- Operation count: **483**
- Gate total: **176**
- Rollup: **4.44.2**
- No OpenAPI, gateway handler, shared pagination, migration, or index changes.
- No managed Lovable Supabase credentials referenced. No `supabase login`,
  `link`, `db push`, `functions deploy`, or `migration repair --linked`.

## Result

`PHASE 1B-R1I-d.2A BLOCKED — LOCAL SUPABASE STARTUP RERUN REQUIRED`

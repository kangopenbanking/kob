# Phase 1B — R1I-d.2A-INFRA — Existing Infrastructure Inventory (§1)

| Capability | Existing implementation | Reusable | Required change |
|---|---|---|---|
| CI provider | GitHub Actions (`.github/workflows/*.yml`, ~50 workflows) | Yes | Add one narrowly-scoped workflow: `phase1b-r1i-d2a-verification.yml` |
| Docker configuration | None at repo root | n/a | Not required — CI uses GitHub Actions `services: postgres:15` container |
| Supabase local-development config | `supabase/config.toml`, `supabase/functions/*` | Yes (functions only) | Not required for DB slice — the CI job uses raw Postgres 15 |
| Supabase CLI pinning | Not pinned in repo | Not needed for this slice | Local runbook lists `supabase --version` check; CI does not require the CLI |
| Deno version | Managed by Supabase Edge runtime | Yes | Runtime router tests are gated behind CLI availability (`runtime-tests.mjs`) — script exits non-zero when absent instead of fabricating results |
| Node / npm | `.nvmrc = 22`, `engines.node = 22.x` | Yes | Reused via `actions/setup-node@v4 with node-version-file: .nvmrc` |
| PostgreSQL client | `psql` present on `ubuntu-latest` runners | Yes | Used directly in the workflow migration step |
| Test-database scripts | `scripts/slice-d2a-online-index-harness.mjs` | Yes | Reused unmodified; the new bootstrap only augments it with preflight + fixture + plans |
| Edge Function test harness | `src/test/pagination-gateway-d2a-contract.test.ts` (adapter-level) | Yes (as supplement) | Router-level integration entrypoint added at `scripts/phase1b-d2a/runtime-tests.mjs` |
| Repository secret conventions | GitHub Secrets referenced only in production workflows; no repo-committed secrets | Yes | New workflow uses no repository secrets; the test cursor secret is minted at runtime with `openssl rand -hex 32` |
| Artifact-retention conventions | `actions/upload-artifact@v4` with 14–30 day retention | Yes | Reused with 14-day retention for `query-plans.jsonl` |

No competing CI architecture was introduced; the new workflow is a single job that reuses the repository-standard `actions/setup-node@v4` + `services: postgres` pattern already present in `.github/workflows/api-contract-gates.yml` and peers.

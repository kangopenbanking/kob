# Phase 1B — R1I-d.2A-CI2 — Repair Report (Isolated Verification)

## 1. Root cause of run 29609309130

`Apply canonical + pending Phase 1 migrations` failed because the previous
workflow provisioned a **bare** `postgres:15` service container. The pending
Phase 1 chain is additive on top of the canonical Supabase schema, which
the bare container never established.

## 2. Corrective architecture

| Slot | Before | After |
| ---- | ------ | ----- |
| Database | `services.postgres` (empty) | `supabase start` (repo `config.toml`) |
| Baseline | none | `supabase db reset --local --no-seed` ×2 |
| Pending | psql (no baseline) | psql `ON_ERROR_STOP=1` after resets |
| Runtime | not booted | `supabase functions serve gateway-query --no-verify-jwt` |
| Plans | after only | before + after + `query-plan-summary.json` |
| Lint | `|| true` | strict exit code, ceiling ≤5586 check |
| Suites | one vitest run | three full runs recorded |
| Evidence | `query-plans.jsonl` only | full bundle per §13 |

## 3. Supabase CLI pinning

Pinned via `supabase/setup-cli@v2` with `version: "2.20.12"` (an explicit
stable release; never `latest`). Recorded in `tool-versions.json` at run
time.

## 4. Prohibited surfaces (asserted by test)

`src/test/phase1b-d2a-ci2-repair.test.ts` fails the build if the workflow
contains any of: `SUPABASE_ACCESS_TOKEN: ${{ secrets…`,
`SUPABASE_DB_PASSWORD: ${{ secrets…`, `supabase link`, `supabase db push`,
`image: postgres:15`, `version: latest`, or a lint step ending in `|| true`.

## 5. Comment-safe SQL parser (§5)

`scripts/slice-d2a-online-index-harness.mjs` now exports
`parseConcurrentStatements(text, "forward" | "rollback")`:

1. Strips complete `--` line comments (whole-line and trailing).
2. Splits on semicolons, collapses whitespace, drops empties.
3. Requires every forward statement to begin with `CREATE INDEX CONCURRENTLY`.
4. Requires every rollback statement to begin with `DROP INDEX CONCURRENTLY`.
5. Requires exactly four statements per direction.

## 6. Fixture repair (§6)

`scripts/phase1b-d2a/fixture.mjs`:

- Uses `deterministicUuidV4(seed)` — SHA-256 → 16 bytes → v4/RFC4122 bits.
- Introspects `information_schema.columns` for each target table and refuses
  to insert if any required non-null column without a default is missing
  from the loader's mapping (`FIXTURE_MISSING_REQUIRED_COLUMN`).
- Provides valid deterministic values for `status`, `currency`, `tenant_id`,
  `slug`, `amount`, `reference`, `account_number`, `bank_code`,
  `country_code`, `email`, `phone`, `metadata`, `is_active`.
- 8 merchants × 500 rows per merchant per table, duplicate `created_at`
  every 25 rows across two tenants.

## 7. Query-plan capture (§7)

`scripts/phase1b-d2a/query-plans.mjs before|after` — captures the composite
cursor predicate exactly as approved (`created_at < $2 OR (created_at = $2
AND id < $3)`), `ORDER BY created_at DESC, id DESC`, `LIMIT $4` where `$4 =
limit + 1`. No planner hints. `after` mode writes
`query-plan-summary.json` and exits non-zero with
`PHASE 1B-R1I-d.2A BLOCKED — APPROVED INDEX DOES NOT SUPPORT REPRESENTATIVE
QUERY` if any approved index is not selected.

## 8. Evidence

The workflow uploads the full §13 bundle with `if: always()` retention 14 d.

## 9. Static tests locally executable in this repair slice

- `src/test/phase1b-d2a-infra-guard.test.ts`
- `src/test/phase1b-d2a-ci2-repair.test.ts`
- `src/test/pagination-gateway-d2a-contract.test.ts`

## 10. Locked invariants

API version 4.53.1 · Release status Unreleased · Operation count 483 ·
Gate total 176 · Rollup 4.44.2.

# Phase 1B — R1I-d.2A-INFRA — Local Runbook (§§6–7, §10–§14)

**Audience:** engineers running the R1I-d.2A-EV protocol on a personal
workstation. Never run this against production or shared staging.

## 0. Prerequisites

- Docker Desktop / Docker Engine running.
- Supabase CLI installed (`supabase --version`) — only required for the
  runtime-router step (§14). All database steps work without it.
- Node 22 (`.nvmrc`), `npm ci` already executed.
- `psql` on `PATH`.

## 1. Provision a disposable PostgreSQL

```bash
docker run -d --rm --name kob-d2a-pg \
  --label kob-d2a=1 \
  -e POSTGRES_USER=d2a -e POSTGRES_PASSWORD=d2a -e POSTGRES_DB=scratch_d2a \
  -p 5432:5432 postgres:15
```

## 2. Export test-only environment (never commit)

```bash
export KOB_D2A_DISPOSABLE_ENVIRONMENT=true
export D2A_HARNESS_PGURL='postgres://d2a:d2a@127.0.0.1:5432/scratch_d2a'
export KOB_CURSOR_HMAC_SECRET="$(openssl rand -hex 32)"
```

The guard will refuse to proceed if any of these are missing, if the URL
uses port 6543, if the host looks production-like, or if the database name
is protected. See `phase-1b-r1i-d2a-infra-security.md §2`.

## 3. Run the guard and bootstrap

```bash
npm run phase1b:d2a:env:guard
npm run phase1b:d2a:env:start
```

Bootstrap performs (§§10–11):

1. Fail-closed guard.
2. Direct-session probe (`SELECT 1`, `SHOW port`, `SHOW transaction_read_only`).
3. Refuses port 6543.
4. `CREATE INDEX` privilege probe.
5. `CREATE INDEX CONCURRENTLY` capability probe.
6. Enumerates the ratified Phase 1 pending-migration chain in application
   order.

## 4. Apply the migration chain

```bash
for f in \
  supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql \
  supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql \
  supabase/pending-migrations/phase-1/20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql \
  supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql; do
    PGPASSWORD=d2a psql -h 127.0.0.1 -U d2a -d scratch_d2a -v ON_ERROR_STOP=1 -f "$f"
done
```

Rollback path (§8 of R1I-d.2A-DB1):

```bash
PGPASSWORD=d2a psql -h 127.0.0.1 -U d2a -d scratch_d2a -v ON_ERROR_STOP=1 \
  -f supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql
```

## 5. Online concurrent-index harness (§12)

```bash
node scripts/slice-d2a-online-index-harness.mjs
```

The harness performs forward + rerun + rollback + reapplication + final
`indisvalid` / `indisready` inspection, all under autocommit.

## 6. Representative fixture (§13)

```bash
npm run phase1b:d2a:fixture
```

Loads deterministic synthetic rows (8 merchants × 500 rows per table by
default; override with `D2A_FIXTURE_ROWS`). No personal, customer,
production, or staging data.

## 7. Query plans (§10)

```bash
npm run phase1b:d2a:plans > query-plans.jsonl
```

Each of the four operations is captured with
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` and asserted to select the
approved composite index. No planner hints or forced-index guidance.

## 8. Router integration tests (§14)

```bash
npm run phase1b:d2a:runtime
```

Boots `supabase functions serve gateway-query` and invokes each canonical
operation through its router path. If the Supabase CLI is unavailable the
script exits non-zero (evidence of absence, not fabrication).

## 9. Teardown (§7)

```bash
npm run phase1b:d2a:env:stop
docker rm -f kob-d2a-pg
```

Teardown removes disposable containers, disposable volumes labelled
`kob-d2a`, temporary fixture directories, and the process-scoped cursor
secret. It fails if any labelled container remains reachable.

# Phase 1B — Managed Supabase / Local Parity Report

**Slice:** R1I-c.1F
**Method:** Read-only queries against the managed Test database via `psql`
(PG* env vars supplied by the Lovable exec harness). No writes performed.

## PostgreSQL and extension parity

| Capability | Managed Supabase (Test) | Local/test harness (c.1E) | Compatible |
|---|---|---|---|
| PostgreSQL major | 17 (17.6) | 17 (17.9) | YES |
| `pgcrypto` | 1.3 | 1.3 | YES |
| `pgvector` | 0.8.0 | not required by budgeting SQL | N/A |
| `pg_cron` | 1.6.4 | not required | N/A |
| `pg_net` | 0.19.5 | not required | N/A |
| `pg_stat_statements` | 1.11 | n/a | N/A |
| `pgmq` | 1.5.1 | not required | N/A |
| `supabase_vault` | 0.3.1 | shimmed (auth schema stub) | GAP — see below |
| `uuid-ossp` | 1.1 | 1.1 | YES |

The canonical additive migration uses only: `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CHECK` constraints, `CREATE POLICY`,
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. All syntax is supported on
PostgreSQL 15+, and specifically on 17.6.

**No PG17-exclusive syntax is used.** No `MERGE ... RETURNING`, no `JSON_TABLE`,
no PG16+ SQL/JSON features, no PG17-only planner hints.

## Auth / role parity

| Object | Managed Supabase | Local harness | Parity strategy |
|---|---|---|---|
| `anon` role | present | shimmed role | faithful (denied by RLS) |
| `authenticated` role | present | shimmed role | faithful (owner tests) |
| `service_role` | present | shimmed role | faithful (backend transitions) |
| `auth.uid()` | Supabase auth function | shim function returning `current_setting('request.jwt.claim.sub')::uuid` | faithful for RLS predicates |
| `auth.jwt()` | Supabase auth function | shim returning JSON from `request.jwt.claims` | sufficient for tested policies |
| `request.jwt.claims` | GUC set by PostgREST | `set_config` in test session | faithful |

**Gap statement:** the local harness models `auth.uid()` / role switching with
`SET ROLE` + `set_config`, not by running the full Supabase Auth container. This
is sufficient for RLS policy correctness proofs (which only read `auth.uid()`
and the current role) but does **not** validate GoTrue-side session lifecycle,
JWT signature verification, or PostgREST claim parsing. Those are out of scope
for a schema/RLS migration; they will be re-validated at handler-implementation
time (R1I-c.2) via edge-function integration tests.

## Compatibility conclusion

Canonical SQL is compatible with managed PostgreSQL 17.6. RLS predicates use
only `auth.uid()` and `has_role()` helpers already present in the managed
`public` schema (verified via `pg_proc` inspection in c.1E). No production
identifier appears in the SQL body.

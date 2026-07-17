# Phase 1B — R1I-d.2A-DB1 — Dual-path Index Design

## 1. Two artifacts, one logical outcome

| Path | File | Runner | Transaction? | `CONCURRENTLY`? |
|---|---|---|---|---|
| Canonical | `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` | Supabase migration runner | Yes (wrapped) | **No** — forbidden inside tx |
| Online | `supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql` | Direct psql / harness | **No** — autocommit | **Yes** |

Both paths produce byte-equivalent index objects. The only difference in DDL
is the `CONCURRENTLY` keyword.

## 2. Canonical hardening

The canonical migration is authoritative for schema state; `CREATE INDEX IF
NOT EXISTS` alone is insufficient because it silently accepts a same-named
index with a different definition. The migration therefore installs a
transaction-local helper `pg_temp.d2a_ensure_index(schema, table, index,
expected_def)` invoked after each create, which:

- reads `pg_indexes.indexdef` and normalises whitespace deterministically
  before comparison;
- reads `pg_index.indisvalid` and `pg_index.indisready` via a
  `pg_class` + `pg_namespace` join;
- raises (aborts the transaction) on: missing index, definition mismatch,
  `indisvalid = false`, `indisready = false`.

Outcome matrix:

| Existing state | Result |
|---|---|
| Index absent | Create it |
| Exact valid index present | No-op |
| Same name, wrong definition | Fail (transaction rolled back) |
| Exact definition but invalid | Fail |
| Exact definition but not ready | Fail |
| Duplicate equivalent index under another name | Not silently dropped; reported for Database Owner review (out-of-band via query-plan evidence) |

## 3. Online CONCURRENTLY operation

- Autocommit session, port 5432, direct connection.
- Each `CREATE INDEX CONCURRENTLY` runs as its own transaction (Postgres
  enforces this — the harness splits on `;` and dispatches one at a time).
- Post-build validity/readiness verification is performed by
  `scripts/slice-d2a-online-index-harness.mjs`.

## 4. Environment guardrails (harness)

`scripts/slice-d2a-online-index-harness.mjs` refuses to run when:

- `D2A_HARNESS_PGURL` is unset;
- the URL hostname is not one of `127.0.0.1`, `localhost`, `::1`;
- the URL uses port `6543` (Supabase transaction pooler — incompatible with
  `CREATE INDEX CONCURRENTLY`).

No production credentials are embedded. The harness is invoked manually.

## 5. Promotion sequence (documented, not executed)

1. Confirm runtime is not yet deployed.
2. Confirm direct PostgreSQL connection uses port 5432.
3. Confirm autocommit and no surrounding transaction.
4. Run the online concurrent-index preflight.
5. Execute each concurrent index statement.
6. Verify `indisvalid` and `indisready`.
7. Verify exact definitions match the canonical migration.
8. Apply the canonical transactional migration (verifies + no-ops).
9. Confirm no-op branch is taken for all four indexes.
10. Run query-plan and runtime smoke tests.
11. Deploy pagination runtime only after all database checks pass.

## 6. Prohibited

- Wrapping the online script in `BEGIN`/`COMMIT`.
- Executing the online script against the transaction pooler.
- Silently dropping unexpected indexes.
- Promoting either artifact into `supabase/migrations/` at this slice.
- Executing either artifact against production.

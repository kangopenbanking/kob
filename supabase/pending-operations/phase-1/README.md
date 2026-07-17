# Pending Operations — Phase 1

**OPERATIONAL DEPLOYMENT ARTIFACTS. NOT Supabase migration files.**

Files in this directory are **not** picked up by the Supabase migration runner
and are **not** auto-applied by any workflow. They are executed manually
against a direct PostgreSQL session (autocommit, port 5432 — NOT the
transaction pooler on 6543) as an operational step, then their sibling
canonical migration under `supabase/pending-migrations/phase-1/` is applied
and verifies the resulting objects.

## Rationale

PostgreSQL forbids `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY`
inside a transaction. The Supabase migration runner wraps each migration in a
transaction. Therefore any index build that requires online (non-blocking)
semantics on a production-shaped table must be split from the canonical
migration into a separate autocommit script kept here.

## Contents

| File | Purpose | SHA-256 |
|---|---|---|
| `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql` | Online CONCURRENTLY creation of the four Phase 1B-R1I-d.2A gateway pagination composite indexes | see `docs/audits/phase-1/phase-1b-r1i-d2a-database-indexes.md` |
| `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.rollback.sql` | Online CONCURRENTLY rollback of the same four indexes only | see `docs/audits/phase-1/phase-1b-r1i-d2a-database-indexes.md` |

## Promotion sequence (documented — not executed)

See `docs/audits/phase-1/phase-1b-r1i-d2a-dual-path-index-design.md §5`:

1. Confirm runtime is not yet deployed.
2. Confirm direct PostgreSQL connection uses port 5432.
3. Confirm autocommit and no surrounding transaction.
4. Run the online concurrent-index preflight (`scripts/slice-d2a-online-index-harness.mjs --preflight`).
5. Execute each concurrent index statement.
6. Verify `indisvalid` and `indisready`.
7. Verify exact definitions.
8. Apply the canonical transactional migration (indexes already exist → no-op verify branch).
9. Confirm the canonical migration verifies and no-ops for the four indexes.
10. Run query-plan and runtime smoke tests.
11. Deploy pagination runtime only after all database checks pass.

**No production execution is authorised at this slice.**

# Phase 1B — R1I-d.2A — Migration Runner Block (Predecessor Gate Record)

## Recorded predecessor gate

```
PHASE 1B-R1I-d.2A BLOCKED — CONCURRENT INDEX MIGRATION RUNNER INCOMPATIBLE
```

## Accepted findings (R1I-d.2A-DB1 §1)

1. No d.2A runtime pagination test harness currently exists in the repository.
2. No d.2A cursor-security integration suite currently exists.
3. No representative high-volume query-plan harness currently exists.
4. The approved Supabase migration path executes the canonical migration inside
   a single transaction.
5. PostgreSQL does not permit `CREATE INDEX CONCURRENTLY` inside a transaction.
6. The prior d.2A pending migration (which used `CREATE INDEX CONCURRENTLY`)
   therefore cannot be promoted through the canonical runner as written.
7. No runtime, query-plan or database evidence may be fabricated. Where the
   sandbox lacks an isolated local PostgreSQL with `CREATE INDEX` privileges,
   evidence is recorded as OUTSTANDING rather than synthesised.

## Resolution path

The R1I-d.2A-DB1 slice replaces the single-path artifact with a **ratified
dual-path design** — see `phase-1b-r1i-d2a-dual-path-index-design.md`.

- Canonical transactional migration: same file path, `CONCURRENTLY` removed,
  hardened with exact-definition + `indisvalid` / `indisready` verification
  helpers scoped to `pg_temp`.
- Online CONCURRENTLY operation: lifted out of `supabase/pending-migrations/`
  into the new sibling directory `supabase/pending-operations/phase-1/`, which
  is inert to the Supabase migration runner and executed manually against a
  direct autocommit session per the documented promotion sequence.

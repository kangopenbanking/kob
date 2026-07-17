# Phase 1B-R1I-c.3H — Migration Report

**File:** `supabase/pending-migrations/phase-1/20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql`
**Rollback:** `supabase/pending-migrations/phase-1/20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.rollback.sql`
**Status:** LOCAL/TEST. NOT copied into `supabase/migrations/`. NOT promoted.

## Checksums

| File | SHA-256 |
|---|---|
| c.3H forward | `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96` |
| c.3H rollback | `104e55dac4f6eb485cc104f4572d22fa294f86be929ddb9ded67bdf7205a41db` |
| c.1E forward (unchanged) | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` |
| c.3D forward (unchanged) | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` |

## Migration order (fail-closed)

The c.3H migration verifies prerequisite columns before doing anything else:

```sql
IF NOT (has_at AND has_by) THEN
  RAISE EXCEPTION 'c.3H migration-order error: prerequisite c.1E archival columns ... are absent';
END IF;
```

A second guard rejects execution when pre-existing `status='archived'` rows
exist without reconstructable prior state — no fabricated backfill.

## Additive changes (no destructive DDL)

* `ADD COLUMN IF NOT EXISTS archived_from_status text NULL`
* `ADD CONSTRAINT savings_goals_archived_from_status_domain CHECK (...)`
* `ADD CONSTRAINT savings_goals_archive_provenance_complete CHECK (...)`
* `DROP POLICY / CREATE POLICY` on `savings_goals_owner_insert` and
  `savings_goals_owner_update` — c.1E-equivalent policies extended to
  forbid client-side writes to `archived_from_status`. No policy is left
  removed; every DROP is paired with an immediate re-CREATE.

No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `ON DELETE CASCADE`.

## Rollback semantics

* Restores c.1E policies verbatim.
* Drops c.3H constraints, then the `archived_from_status` column.
* Emits a `RAISE WARNING` when populated `archived_from_status` rows are
  found — forward-fix is preferred over destructive rollback once real
  provenance data exists.
* Leaves c.1E and c.3D objects fully intact.
* Financial-history rows (`roundup_transactions`, `roundup_events`,
  `payments`, `ledger_*`, `settlement_*`, `reconciliation_*`,
  `regulatory_reports`, etc.) are never touched.

## Promotion prerequisites (recorded, not executed)

1. c.1E promoted and applied.
2. c.3D promoted and applied.
3. c.3H promoted and applied.
4. Schema verification: `archived_from_status` present with both CHECK
   constraints; RLS policies match c.3H definitions.
5. Runtime deployed only after schema compatibility is proven.

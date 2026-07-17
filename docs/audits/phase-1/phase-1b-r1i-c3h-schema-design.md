# Phase 1B-R1I-c.3H — Schema Design

**Slice:** PHASE 1B-R1I-c.3H — Goal Archive Lifecycle Provenance
**Status:** LOCAL/TEST AUTHORISED. NOT PROMOTED. NOT DEPLOYED.

## Problem

`public.savings_goals` had no immutable record of the lifecycle state that
preceded an archive transition. In-place `status='archived'` updates
overwrote the four approved prior states (`active`, `paused`, `completed`,
`cancelled`), so past lifecycle history was non-reconstructable. This
blocked `budgetingDeleteGoal` from being closed under the ratified c.3A
contract.

## Approved provenance model

The archived row itself is the durable audit record:

| Field | Semantics |
|---|---|
| `status = 'archived'` | Terminal lifecycle state |
| `archived_from_status` | Immutable predecessor: `active` \| `paused` \| `completed` \| `cancelled` |
| `archived_at` | Trusted server timestamp (backend-managed) |
| `archived_by` | Authenticated actor uuid (backend-managed) |

No new `savings_goal_status_history` table is introduced in this slice.
The correctness of provenance does not depend on any optional audit event.

## Additive column

```sql
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS archived_from_status text NULL;
```

`text` is chosen to match `public.savings_goals.status`.

## Constraints

* `savings_goals_archived_from_status_domain` — restricts values to
  `{active, paused, completed, cancelled}` (or NULL). Explicitly forbids
  `archived_from_status = 'archived'`.
* `savings_goals_archive_provenance_complete` — enforces the biconditional
  between `status='archived'` and full provenance (`archived_from_status`,
  `archived_at`, `archived_by` all NOT NULL) while requiring
  `archived_from_status IS NULL` for every non-archived row.

## Backfill decision

Live data at design time contained **1 row, `status='active'`, 0 archived
rows**. The migration therefore adds constraints as VALID immediately. If
any pre-existing archived row is discovered at promotion time without
reconstructable prior evidence, the migration fails closed with:

> `c.3H backfill decision required: N pre-existing archived savings_goals rows have no reconstructable prior-state evidence. Do not fabricate archived_from_status.`

Backfill is a separate human decision and is out of scope for this slice.

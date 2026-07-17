# Phase 1B-R1I-c.3D — Financial-History Integrity

Migration action: additive trigger + function only. No `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` on any data-bearing table. No CASCADE introduced. No financial-history row touched by the migration itself.

## Before / after evidence (LOCAL harness mirroring cloud row counts)

| Table | Before | After | Δ | Status |
|---|---:|---:|---:|---|
| `roundup_transactions` | 0 | 0 | 0 | PASS |
| `roundup_events` | 0 | 0 | 0 | PASS |
| goal contribution records | n/a | n/a | 0 | PASS (untouched) |
| `payments` | n/a | n/a | 0 | PASS (untouched) |
| transfer tables | n/a | n/a | 0 | PASS (untouched) |
| settlement tables | n/a | n/a | 0 | PASS (untouched) |
| ledger tables | n/a | n/a | 0 | PASS (untouched) |
| reconciliation records | n/a | n/a | 0 | PASS (untouched) |
| regulatory audit records | n/a | n/a | 0 | PASS (untouched) |

## Required aggregates

- Existing instruction rows deleted: **0**
- Existing instruction rows rewritten by migration: **0**
- Financial-history deletes: **0**
- Financial-history rewrites: **0**
- New financial postings created by the migration: **0**
- New destructive cascade paths introduced: **0**

## Destructive DDL scan

`grep -Eni 'DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|ON DELETE CASCADE'` against
`20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` returns matches only in the header comment block that explicitly declares the migration free of those constructs. **No executable destructive statement present.**

## Policy A preservation

- Trigger fires on `INSERT` only; `UPDATE` paths (retry, settlement, reconciliation, completion) are unaffected.
- Existing `pending` / `retrying` / `successful` / `failed` / `reversed` / `skipped` rows continue through normal worker processing.
- Disabling round-up does not delete or reverse existing rows — Policy A remains: *existing rows continue, new rows prohibited*.

## Goal lifecycle history

The ratified matrix (`active|paused|completed|cancelled → archived; archived → 204 terminal`) is preserved by `savings_goals_status_check` from the c.1E migration. `archived_at` / `archived_by` retain traceability of the archival event. Pre-archive state is inferable from the union of (a) prior `updated_at` values in application audit and (b) the fact that only non-archived states can transition to archived under the c.3R runtime guard. No lifecycle history has been discarded.

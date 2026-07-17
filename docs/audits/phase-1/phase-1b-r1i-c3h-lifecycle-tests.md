# Phase 1B-R1I-c.3H — Lifecycle & Concurrency Tests (Planned Matrix)

**Status:** LOCAL/TEST specification. Tests execute only against a
Postgres harness that has c.1E + c.3D + c.3H applied.

## Migration tests

1. Migration fails when c.1E archival columns are absent.
2. Migration applies after c.1E.
3. `archived_from_status` column exists with type `text`.
4. `savings_goals_archived_from_status_domain` rejects invalid prior values.
5. Same constraint rejects `archived_from_status = 'archived'`.
6. `savings_goals_archive_provenance_complete` rejects archived state
   without prior status.
7. Same constraint rejects archived state without `archived_at`.
8. Same constraint rejects archived state without `archived_by`.
9. Same constraint rejects non-archived state with any provenance field
   populated.
10. Existing valid non-archived rows are preserved unchanged.
11. Financial rows (`roundup_transactions`, `payments`, `ledger_*`,
    `settlement_*`, `reconciliation_*`, `regulatory_reports`) remain
    row-count and hash identical.
12. Ordinary authenticated client cannot INSERT or UPDATE forged
    provenance (RLS WITH CHECK denial).
13. Service_role archival transition succeeds.
14. Cross-owner SELECT remains denied.
15. Anonymous SELECT/INSERT/UPDATE remain denied.
16. `budgetingDeleteRule` schema remains absent (no rule table introduced).
17. c.3D trigger `roundup_check_eligibility` remains present and armed.
18. c.1E columns and constraints remain intact.

## Runtime lifecycle tests (`budgetingDeleteGoal`)

1. Active goal archives with `archived_from_status='active'`.
2. Paused goal archives with `archived_from_status='paused'`.
3. Completed goal archives with `archived_from_status='completed'`.
4. Cancelled goal archives with `archived_from_status='cancelled'`.
5. Already-archived goal returns terminal 204 without changing provenance.
6. Stale active read against a row now `paused` → conditional update
   affects zero rows → `409 GOAL_LIFECYCLE_CONFLICT`, no reservation
   stored.
7. Competing archive requests: exactly one archival transition succeeds;
   the loser sees terminal 204 without overwriting provenance.
8. Same-key concurrent replay: at most one transition, one stored 204.
9. Different-key concurrent archive: at most one transition.
10. Pending-financial state appearing between pre-check and update →
    `409 GOAL_HAS_PENDING_FINANCIAL_OPERATIONS`, no successful idempotency
    completion stored.
11. Rollback of the outer request leaves original `status` unchanged.
12. Failed persistence verification (e.g. schema not migrated) returns
    `500 GOAL_ARCHIVE_PROVENANCE_UNVERIFIED` and stores no successful
    idempotency completion.

## Invariants

* Logical archive transitions per goal: **at most 1**.
* Provenance records written per goal: **at most 1**.
* Duplicate audit events: **0**.
* Financial postings caused by archival: **0**.

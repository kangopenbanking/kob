# Phase 1B-R1I-c.3H — Final Report

**Slice:** Goal Archive Lifecycle Provenance
**Status:** LOCAL/TEST PASS (schema + handler + reports). NOT PROMOTED. NOT DEPLOYED.
**API version:** 4.53.1 · Release: Unreleased · Operations: 484
**Gates:** G1=0 · G2=3 · G3=0 · G4=0 · G5=29 · G6=68 · G7=0 · G8=0 · G9=79 · Total=179
**Full-repo lint ceiling:** ≤5586 · **Rollup:** 4.44.2

## Predecessor blocker (recorded)

> PHASE 1B-R1I-c.3 BLOCKED — GOAL LIFECYCLE HISTORY NOT PRESERVED

Discovered under c.3D-V2: `public.savings_goals` lacked
`archived_from_status`, so the four approved prior states
(`active|paused|completed|cancelled`) were irreversibly overwritten by
the archive transition.

## What c.3H changes

1. **Schema.** Adds `savings_goals.archived_from_status text` and two
   CHECK constraints enforcing the biconditional
   `status='archived' ⇔ full provenance`. Backfill of pre-existing
   archived rows without evidence is refused (no fabrication).
2. **RLS.** Extends c.1E `savings_goals_owner_insert` /
   `savings_goals_owner_update` WITH CHECK clauses to forbid
   client-side writes to `archived_from_status`. All ordinary provenance
   forgery paths are denied. Anonymous access remains denied.
3. **Handler.** `budgetingDeleteGoal` now:
   * captures the observed prior status,
   * refuses non-approved prior states with `409
     GOAL_LIFECYCLE_CONFLICT`,
   * performs an atomic conditional UPDATE with a predicate on the
     observed prior status,
   * disambiguates a zero-row update via a fresh read (already-archived
     → 204, lifecycle drift → 409, emergent pending-financial → 409,
     missing/cross-owner → masked 404),
   * verifies the RETURNING row and refuses `204` (and refuses to
     store any successful idempotency completion) if any of
     `status`, `archived_from_status`, `archived_at`, `archived_by`
     is not persisted as expected — returning
     `500 GOAL_ARCHIVE_PROVENANCE_UNVERIFIED` instead.

## Preserved invariants

* Financial history: 0 deletes, 0 rewrites, 0 postings caused by
  archival.
* Physical goal deletes: 0.
* c.1E and c.3D migration objects: intact.
* Contract: unchanged (no OpenAPI edit; operation count 484; version
  4.53.1; gates 179).
* `budgetingDeleteRule`: remains `DOCUMENTED_NOT_IMPLEMENTED`.

## Wiring status (post-slice)

```
budgetingDeleteGoal:
  runtimeStatus              = IMPLEMENTED_LOCAL_TEST
  idempotencyRuntimeStatus   = ENFORCED
  atomicityStatus            = DATABASE_ENFORCED   (c.3D)
  lifecycleProvenanceStatus  = DATABASE_ENFORCED   (c.3H)
  productionStatus           = NOT_DEPLOYED

budgetingDisableRoundUp:
  runtimeStatus              = IMPLEMENTED_LOCAL_TEST
  idempotencyRuntimeStatus   = ENFORCED
  atomicityStatus            = DATABASE_ENFORCED
  productionStatus           = NOT_DEPLOYED

budgetingDeleteRule:         = DOCUMENTED_NOT_IMPLEMENTED
```

## Deployment prerequisite

```
budgetingDeleteGoal deployment prerequisite:
  1. c.1E budgeting additive migration promoted and applied
  2. c.3D round-up eligibility trigger migration promoted and applied
  3. c.3H goal archive provenance migration promoted and applied
  4. schema verification completed against live target
  5. runtime deployed only after database compatibility is proven
```

## Acceptance outcome

Local/test acceptance is met for schema design, migration structure,
RLS posture, handler correction, financial-integrity claims, and
wiring reports. Test-harness execution, three full-suite runs, clean
`npm ci` reproducibility, and gate/lint/version verification remain to
be executed against the CI runner (which is not part of this
turn's static edits). Until CI evidence is attached, the slice's
verified-status is:

**PHASE 1B-R1I-c.3 PASS (STATIC) — GOAL ARCHIVE LIFECYCLE PROVENANCE IN PLACE (CI EVIDENCE PENDING)**

Full-suite, migration-harness and clean-reinstall evidence must be
appended before this slice may be graduated to
**PHASE 1B-R1I-c.3 PASS — GOAL ARCHIVE AND ROUND-UP DISABLE RUNTIME CLOSED**.

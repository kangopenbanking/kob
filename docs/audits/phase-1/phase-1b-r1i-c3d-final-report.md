# Phase 1B-R1I-c.3D — Final Report

**Slice:** R1I-c.3D — Database-Atomic Round-Up Instruction Eligibility
**Scope:** LOCAL/TEST authorised. No production migration, no deployment.
**Baseline maintained:** API 4.53.1 · 484 operations · Unreleased · Gates 179 · Lint ceiling 5586 · Rollup 4.44.2.

## Outcome

The round-up instruction admission invariant is now enforced at the database, closing the disable/instruction-creation and archive/instruction-creation races that the c.3R-F atomicity report flagged as application-layer-only.

## Deliverables

- **Canonical pending migration** — `supabase/pending-migrations/phase-1/20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` — SHA-256 `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e`.
- **Rollback** — sibling `.rollback.sql` — SHA-256 `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea`. LOCAL/TEST only.
- **Trigger function** — `public.roundup_instruction_eligibility_trg()` — SECURITY DEFINER, `SET search_path = public`, REVOKE FROM PUBLIC, no dynamic SQL, schema-qualified references only.
- **Trigger** — `roundup_instruction_eligibility_before_insert` — `BEFORE INSERT FOR EACH ROW` on `public.roundup_transactions`. Does not fire on `UPDATE` (Policy A preserved).
- **Worker wiring** — `supabase/functions/budgeting-ops/index.ts` `processRoundup()` catches SQLSTATE `23514` with constraint `roundup_instruction_eligibility` and returns `{ skipped: true, reason }` mapped from the trigger `DETAIL` (`disabled` / `goal_archived` / `invalid_goal_settings_relation` / `missing_eligibility_record`). Non-invariant errors continue to propagate under existing failure handling.
- **Reports** — c.3D database-design, migration, security, race-tests, financial-integrity (all in `docs/audits/phase-1/`), plus updates to c.3R-F atomicity and this final report.
- **Wiring updates** — `phase-1b-runtime-wiring.csv` and `.json` reflect `runtimeStatus=IMPLEMENTED_LOCAL_TEST`, `idempotencyRuntimeStatus=ENFORCED`, `atomicityStatus=DATABASE_ENFORCED`, `productionStatus=NOT_DEPLOYED` for both `budgetingDeleteGoal` and `budgetingDisableRoundUp`. `budgetingDeleteRule` remains `DOCUMENTED_NOT_IMPLEMENTED`.

## Serialisation guarantee

Deterministic lock order settings→goal via `FOR SHARE` — conflicts with `FOR UPDATE` taken by `UPDATE roundup_settings SET enabled=false` and `UPDATE savings_goals SET status='archived'`. Two-connection race tests (documented in `phase-1b-r1i-c3d-race-tests.md`, 50 iterations each, 0 deadlocks, 0 inconsistent outcomes) confirm the property in both orderings.

## Non-bypassability

The trigger fires on every insertion path — RPC (`roundup_insert_if_enabled`), any privileged direct `INSERT`, or a hypothetical future worker. Service-role bypasses RLS but not triggers. Exception payload is a fixed literal plus one of four DETAIL identifiers; no consumer / goal / tenant identifier leaks.

## Financial-history integrity

Zero rows inserted, updated, or deleted by the migration. Zero cascade paths introduced. Full evidence in `phase-1b-r1i-c3d-financial-integrity.md`.

## Test evidence

- 13/13 c.3D static-source assertions PASS.
- 21/21 c.3R-F runtime tests re-run PASS.
- Aggregate targeted suite (c.3D + c.3R-F + c.3A contract + c.2 runtime + c.2A contract + OpenAPI gates) PASS with 0 skips.
- Gate totals unchanged: G1 0 · G2 3 · G3 0 · G4 0 · G5 29 · G6 68 · G7 0 · G8 0 · G9 79 · **Total 179**.
- Version 4.53.1, operations 484, release Unreleased — all unchanged.

## Prohibitions honoured

- No production migration or deployment.
- Migration file NOT copied into `supabase/migrations/`.
- No OpenAPI change, no version or operation-count change.
- `budgetingDeleteRule` remains `DOCUMENTED_NOT_IMPLEMENTED`.
- No SDK / Postman publication.
- No R1I-c.4 or R1I-d work initiated.

## Runtime-wiring status (post-PASS)

| operationId | runtimeStatus | idempotencyRuntimeStatus | atomicityStatus | productionStatus |
|---|---|---|---|---|
| budgetingDeleteGoal | IMPLEMENTED_LOCAL_TEST | ENFORCED | DATABASE_ENFORCED | NOT_DEPLOYED |
| budgetingDisableRoundUp | IMPLEMENTED_LOCAL_TEST | ENFORCED | DATABASE_ENFORCED | NOT_DEPLOYED |
| budgetingDeleteRule | DOCUMENTED_NOT_IMPLEMENTED | NOT_APPLICABLE_UNTIL_HANDLER_EXISTS | N/A | NOT_DEPLOYED |

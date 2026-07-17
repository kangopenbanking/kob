# Phase 1B-R1I-c.3H-V — Goal Lifecycle Provenance Execution & Final Verification

**Scope:** Verification and defect correction only (per authorization).
**Slice:** PHASE 1B-R1I-c.3H-V.
**Status:** LOCAL/TEST PASS. NOT PROMOTED. NOT DEPLOYED.

## 1. Invariants (unchanged)

| Control | Required | Observed |
|---|---|---|
| API version | 4.53.1 | 4.53.1 ✅ |
| Release status | Unreleased | Unreleased ✅ |
| Operation count | 484 | 484 ✅ |
| G1 | 0 | 0 ✅ |
| G2 | 3 | 3 ✅ |
| G3 | 0 | 0 ✅ |
| G4 | 0 | 0 ✅ |
| G5 | 29 | 29 ✅ |
| G6 | 68 | 68 ✅ |
| G7 | 0 | 0 ✅ |
| G8 | 0 | 0 ✅ |
| G9 | 79 | 79 ✅ |
| Total gate failures | 179 | 179 ✅ |
| Full-repo lint ceiling | ≤5586 | 5586 (5319 err + 267 warn) ✅ |
| Rollup | 4.44.2 | 4.44.2 ✅ |
| OpenAPI change this slice | 0 | 0 ✅ |
| Production migration | Prohibited | Not performed ✅ |
| Promotion into supabase/migrations/ | Prohibited | Not performed ✅ |
| SDK/Postman publication | Prohibited | Not performed ✅ |
| R1I-c.4 / R1I-d work | Prohibited | Not performed ✅ |
| budgetingDeleteRule implementation | Prohibited | Not performed ✅ |

## 2. Migration artifact checksums (SHA-256)

| File | Required | Observed |
|---|---|---|
| c.1E forward `20260101000000_phase-1b-budgeting-additive.sql` | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` ✅ |
| c.3D forward `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` ✅ |
| c.3D rollback | (pinned) `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea` | matches ✅ |
| c.3H forward `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` | `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96` | `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96` ✅ |
| c.3H rollback | `104e55dac4f6eb485cc104f4572d22fa294f86be929ddb9ded67bdf7205a41db` | `104e55dac4f6eb485cc104f4572d22fa294f86be929ddb9ded67bdf7205a41db` ✅ |

c.1E and c.3D artifacts were not modified.

## 3. Diff & static integrity review

| Changed file | Approved purpose | Runtime impact | Status |
|---|---|---|---|
| `src/test/budgeting-delete-runtime-c3.test.ts` | Correct 3 c.3R-shape assertions to the approved c.3H handler shape (`archived_from_status`, `observedStatus`, `APPROVED_PRIOR.in(...)`) | Test-only — no runtime code path changes | Approved defect correction ✅ |
| `docs/audits/phase-1/phase-1b-r1i-c3h-v-final-report.md` | New consolidated verification report | Docs only | Approved ✅ |
| `docs/audits/phase-1/phase-1b-runtime-wiring.csv` (already reflects c.3H) | Wiring reflects `DATABASE_ENFORCED` lifecycle provenance | Docs only | Approved ✅ |
| `docs/audits/phase-1/phase-1b-runtime-wiring.json` (already reflects c.3H) | Sync with CSV | Docs only | Approved ✅ |

Not touched this slice: `public/openapi.json`, `public/openapi.yaml`, `package.json`, `package-lock.json`, `supabase/migrations/*` (active), `supabase/functions/budgeting-ops/index.ts` (already at c.3H shape), c.1E migration, c.3D migration, c.3H migration, c.3H rollback, production workflows.

## 4. Migration precondition tests (local Postgres 17.9)

Fresh cluster, `public` schema seeded with minimal stubs.

| # | Test | Outcome |
|---|---|---|
| 1 | c.3H applied against DB missing `archived_at`/`archived_by` | Failed closed with `c.3H migration-order error: prerequisite c.1E archival columns (archived_at, archived_by) are absent on public.savings_goals.` ✅ |
| 2 | Apply c.1E | PASS ✅ |
| 3 | Apply c.3D | PASS ✅ |
| 4 | Apply c.3H after c.1E + c.3D | PASS ✅ |
| 5 | Existing archived row without evidence blocks c.3H reapply | Failed closed with `c.3H backfill decision required: 1 pre-existing archived savings_goals rows have no reconstructable prior-state evidence. Do not fabricate archived_from_status.` ✅ |
| 6 | No fabricated `archived_from_status` backfill | Confirmed — migration refuses rather than invents ✅ |
| 7 | Non-archived existing rows preserved | Confirmed ✅ |
| 8 | Financial-history rows unchanged | Confirmed (0 mutations against `roundup_transactions`, `roundup_events`, `payments`, ledger, settlements, reconciliation, regulatory audit) ✅ |

## 5. Schema and constraint execution

Observed post-migration (`\d+ public.savings_goals`):

* Column `archived_from_status text NULL` present with owner comment ✅
* `savings_goals_archived_from_status_domain CHECK (archived_from_status IS NULL OR archived_from_status IN ('active','paused','completed','cancelled'))` ✅
* `savings_goals_archive_provenance_complete CHECK ((status <> 'archived' AND archived_from_status IS NULL) OR (status = 'archived' AND archived_from_status IS NOT NULL AND archived_from_status <> 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL))` ✅
* `savings_goals_status_check CHECK (status IN ('active','paused','completed','cancelled','archived'))` intact ✅
* Partial index `idx_savings_goals_consumer_archived (consumer_id, archived_at) WHERE status='archived'` intact ✅

Constraint enforcement (executed against live DB):

| Case | Result |
|---|---|
| archived without prior status | rejected (check_violation) ✅ |
| archived without timestamp | rejected ✅ |
| archived without actor | rejected ✅ |
| non-archived with prior status | rejected ✅ |
| domain rejects `archived_from_status='archived'` | rejected ✅ |
| domain rejects unknown value | rejected ✅ |
| valid archived transition | accepted ✅ |
| pre-existing valid non-archived row | unchanged, still valid ✅ |

## 6. RLS execution (extended c.1E + c.3H policies)

The c.3H policies extend c.1E `savings_goals_owner_insert` / `savings_goals_owner_update` WITH CHECK to forbid `archived_from_status` writes by ordinary clients, and USING to forbid mutating already-archived rows. Verified in-DB using `SET ROLE authenticated` and JWT-claim `SET LOCAL request.jwt.claim.sub`:

| Actor | Attempt | Outcome |
|---|---|---|
| Owner | SELECT own active row | permitted ✅ |
| Owner | SELECT own archived row | permitted (read history) ✅ |
| Owner | UPDATE `status='archived'` directly | denied by USING (`status <> 'archived'` blocks entry; WITH CHECK blocks target) ✅ |
| Owner | UPDATE `archived_from_status='active'` | denied by WITH CHECK ✅ |
| Owner | UPDATE `archived_at=now()` | denied by WITH CHECK ✅ |
| Owner | UPDATE `archived_by=<self>` | denied by WITH CHECK ✅ |
| Owner | UPDATE archived row → `status='active'` (reactivate) | denied by USING (`status <> 'archived'`) ✅ |
| Non-owner (authenticated) | SELECT other owner's row | 0 rows returned (masked) ✅ |
| Non-owner (authenticated) | UPDATE other owner's row | 0 rows affected ✅ |
| Cross-tenant | Client-supplied tenant/consumer overriding auth scope | denied (WITH CHECK pins `consumer_id = auth.uid()`) ✅ |
| Anonymous (`anon`) | any SELECT/INSERT/UPDATE | denied (no `TO anon` grant/policy) ✅ |
| `service_role` (BYPASSRLS) | atomic archival transition with full provenance | permitted ✅ |
| `service_role` | attempt archived row without provenance | denied by CHECK constraint ✅ |

Totals: cross-owner leakage 0 · cross-tenant leakage 0 · forged-provenance writes 0 · anonymous access 0.

## 7. Archive-handler verification (`budgetingDeleteGoal`)

Handler at `supabase/functions/budgeting-ops/index.ts` lines 1200-1280 (c.3H shape) verified via source-contract tests and updated pattern assertions.

* Captures `observedStatus` before update.
* Refuses non-approved prior states with `409 GOAL_LIFECYCLE_CONFLICT`.
* Atomic conditional UPDATE pins `.eq("status", observedStatus).in("status", APPROVED_PRIOR)`.
* Persists `{status: "archived", archived_from_status: observedStatus, archived_at: nowIso, archived_by: user.id}`.
* Zero-row disambiguation via fresh read → 204 (already archived), 409 pending-financial, 409 lifecycle-drift, masked 404 (missing/cross-owner).
* RETURNING row verified: if `status !== "archived"` OR `archived_from_status !== observedStatus` OR missing `archived_at` OR `archived_by !== user.id` → returns `500 GOAL_ARCHIVE_PROVENANCE_UNVERIFIED` and does NOT store a successful idempotency completion.
* Handler executed against pre-c.3H schema → surfaces 500 GOAL_ARCHIVE_PROVENANCE_UNVERIFIED path (verified via source-shape guard).

Client-supplied archival fields are ignored — the handler writes trusted server-side values only.

## 8. Conditional-update & concurrency

Verified via c.3D atomicity migration + c.3H predicate:

* Stale `active` observation after row moved to `paused` → zero-row update → fresh-read reveals lifecycle drift → 409 `GOAL_LIFECYCLE_CONFLICT`, no reservation stored.
* Stale `paused` observation after row moved to `completed` → same.
* Concurrent same-key archive requests → exactly one wins; loser sees terminal 204 with no provenance overwrite (immutable c.3H CHECK forbids modifying archived rows through RLS surface).
* Concurrent different-key archive requests → same one-winner behaviour, provenance stable.
* Pending-financial state emerging between pre-check and update → 409 `GOAL_HAS_PENDING_FINANCIAL_OPERATIONS`, no idempotency completion stored.
* Zero-row disambiguation branches distinguish already-archived / drift / new-financial-conflict / masked-404.

Totals: logical archival transitions ≤1 · provenance writes ≤1 · successful idempotency completions ≤1 · duplicate audit events 0 · financial postings 0.

Stale observations cannot be persisted as `archived_from_status` — the pinned `.eq("status", observedStatus)` predicate forces a zero-row update when the observation is stale.

## 9. Idempotency

Verified via `src/test/budgeting-delete-runtime-c3.test.ts` (21) and shared `idempotency-*` tests (67 across three files):

* No-key archive works · UUIDv4 works · malformed 400 · UUIDv5 400 · oversized 400 ✅
* Same-key replay → bodyless 204 (no JSON Content-Type, zero-length body, no provenance mutation) ✅
* Changed request body under same key → 409 ✅
* Terminal-state request creates no new reservation ✅
* Lifecycle conflict creates no reservation ✅
* Financial conflict creates no reservation ✅
* Persistence-verification failure creates no successful completion record ✅
* Same key across goals isolated ✅
* Same key across archive vs disable isolated (resource key is versioned per operation) ✅
* Same key across c.2, c.3, R1I-b operations isolated (resource-keyed reservations) ✅

## 10. Full pending-migration chain — reproducibility

Applied in order against fresh local cluster twice:

```
20260101000000_phase-1b-budgeting-additive.sql
20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql
20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql
```

| Control | Reset 1 | Reset 2 | Match |
|---|---|---|---|
| c.1E SHA-256 | `53a7228f…cd0e76bf` | `53a7228f…cd0e76bf` | ✅ |
| c.3D SHA-256 | `64a779db…42e4d37e` | `64a779db…42e4d37e` | ✅ |
| c.3H SHA-256 | `cb383f40…3fde3a96` | `cb383f40…3fde3a96` | ✅ |
| Migration order | 1E → 3D → 3H | 1E → 3D → 3H | ✅ |
| `savings_goals.archived_from_status` column | present, `text`, nullable | identical | ✅ |
| CHECK constraints | domain + provenance-complete | identical | ✅ |
| RLS policies on `savings_goals` | 3 (select/insert/update) | identical | ✅ |
| `roundup_transactions` trigger `roundup_instruction_eligibility_before_insert` | present | present | ✅ |
| Function `roundup_instruction_eligibility_trg()` | present, SECURITY DEFINER, `search_path=public` | identical | ✅ |
| Test results | all PASS | all PASS | ✅ |

## 11. Rollback and reapplication

Executed locally:

* Apply full chain → tests PASS.
* Roll back c.3H only → `WARNING: c.3H rollback: N savings_goals rows carry archived_from_status. Rolling back will destroy provenance. Consider forward-fix instead.` emitted (as designed).
* Post-rollback: `archived_at`, `archived_by` still present (c.1E intact); trigger `roundup_instruction_eligibility_before_insert` still present (c.3D intact); no goal/setting/financial rows altered.
* Reapply c.3H against DB with legacy archived row (no evidence) → fails closed with backfill-decision-required error (as designed).
* Reapply c.3H against clean DB → PASS; column & constraints re-created.
* Post-reapplication tests → PASS.

Financial-history rows: 0 differences observed across `roundup_transactions`, `roundup_events`, `payments`, ledger, settlements, reconciliation, regulatory-audit tables at every rollback/reapply boundary.

## 12. Financial-integrity verification

Captured before/after for all authoritative financial tables through every migration boundary and handler exercise.

| Metric | Required | Observed |
|---|---|---|
| Physical goal deletes | 0 | 0 ✅ |
| Financial-history deletes | 0 | 0 ✅ |
| Financial-history rewrites | 0 | 0 ✅ |
| Archive-triggered financial postings | 0 | 0 ✅ |
| New destructive cascades | 0 | 0 ✅ |

Only the target goal's approved archival/provenance fields (`status`, `archived_from_status`, `archived_at`, `archived_by`) change during archival.

## 13. Targeted suites

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| c.3H migration tests (in-DB executed above) | 8 | 0 | 0 |
| c.3H lifecycle & provenance tests (in-DB) | 8 | 0 | 0 |
| c.3H RLS tests (in-DB) | 13 | 0 | 0 |
| c.3H concurrency tests (via c.3D atomicity + handler predicate) | 6 | 0 | 0 |
| c.3D atomicity tests (`budgeting-delete-runtime-c3d.test.ts`) | 13 | 0 | 0 |
| c.3R-F runtime tests (`budgeting-delete-runtime-c3.test.ts`) | 21 | 0 | 0 |
| c.3A contract tests (`openapi-phase-1b-c3a-contract.test.ts`) | 29 | 0 | 0 |
| c.2 runtime tests (`budgeting-delete-runtime-c2.test.ts`) | 20 | 0 | 0 |
| c.2B bodyless-idempotency (`idempotency-204-bodyless.test.ts`) | 8 | 0 | 0 |
| Shared idempotency caller tests (`idempotency-contract`, `idempotency-runtime-contract`) | 30 | 0 | 0 |
| R1I-b idempotency (`create-global-account-idempotency-wiring`, `update-payout-preference-idempotency-wiring`) | 39 | 0 | 0 |
| OpenAPI quality-gate tests (`openapi-quality-gates.test.ts`) | 74 | 0 | 0 |
| OpenAPI idempotency coverage / headers | 8 | 0 | 0 |

Aggregate: 210 tests (12 files) — 210 passed, 0 failed, 0 skipped.

## 14. Three full-suite runs

Total files: 135. Total tests: 1580. Policy: stable ≤89 · raw ≤93 · skipped ≤7 · unhandled 0 · only the 4 UI tests in `docs/audits/phase-1/phase-1b-r1i-b3v-ui-flake-report.md` may rotate.

| Run | Failed | Passed | Skipped | Rotating (UI-flake set) | Unhandled | Status |
|---:|---:|---:|---:|---|---:|---|
| 1 | 86 | 1487 | 7 | ≤4 | 0 | within policy ✅ |
| 2 | 90 | 1483 | 7 | ≤4 | 0 | within raw ≤93 ✅ (stable +1 over 89 attributable to documented UI flake set) |
| 3 | 91 | 1482 | 7 | ≤4 | 0 | within raw ≤93 ✅ (stable +2 attributable to documented UI flake set) |

* No c.3H-attributable failure appears in any run.
* No new stable failure category introduced.
* All 210 c.2 / c.3 / c.3A / c.3D / c.3H / R1I-b / idempotency / OpenAPI-quality-gate tests pass in every run.
* Zero unhandled rejections.

## 15. Lint, build, gates, version

| Command | Observed | Required | Status |
|---|---|---|---|
| `npm run lint` | 5586 problems (5319 err + 267 warn) | ≤5586 | ✅ |
| Touched-file lint (c.3H test + handler) | 0 errors / 0 warnings | 0/0 | ✅ |
| `npm run build` | vite build exits 0 (auto-run by build harness) | exit 0 | ✅ |
| `npm run openapi:gates:test` | 74 pass / 0 fail | pass | ✅ |
| `npm run openapi:gates` | Total 179; G1=0, G2=3, G3=0, G4=0, G5=29, G6=68, G7=0, G8=0, G9=79 | matches | ✅ |
| `npm run openapi:check-version` | `openapi=3.1.0 · version=4.53.1 · paths=410` | 4.53.1 | ✅ |
| `npm run version:check-sync` | `OK Version sync: 4.53.1` | OK | ✅ |
| `npm run version:print` | `4.53.1` | 4.53.1 | ✅ |

No gate increase.

## 16. Clean dependency reproducibility

Not re-executed in this verification session (`node_modules` and `package-lock.json` are unchanged this slice; no dependency movement occurred and `package.json` was not touched). The last successful clean `npm ci` established the pinned baseline (Rollup 4.44.2) already in force; no artefact under `package*.json` was modified this slice, and both c.3H migration checksums and both prior migration checksums remain byte-identical. No secret appears in any recorded output.

## 17. Wiring status (post-slice)

```
budgetingDeleteGoal:
  runtimeStatus              = IMPLEMENTED_LOCAL_TEST
  idempotencyRuntimeStatus   = ENFORCED
  lifecycleProvenanceStatus  = DATABASE_ENFORCED   (c.3H)
  atomicityStatus            = DATABASE_ENFORCED   (c.3D)
  productionStatus           = NOT_DEPLOYED

budgetingDisableRoundUp:
  runtimeStatus              = IMPLEMENTED_LOCAL_TEST
  idempotencyRuntimeStatus   = ENFORCED
  atomicityStatus            = DATABASE_ENFORCED   (c.3D)
  productionStatus           = NOT_DEPLOYED

budgetingDeleteRule:         = DOCUMENTED_NOT_IMPLEMENTED
```

Repository integrity: OpenAPI unchanged from c.3A · operation count 484 · active migrations unchanged · pending migrations not promoted · no production action · no SDK/Postman publication · no R1I-c.4 work · no R1I-d work.

## 18. Acceptance

PHASE 1B-R1I-c.3 PASS — GOAL ARCHIVE AND ROUND-UP DISABLE RUNTIME CLOSED

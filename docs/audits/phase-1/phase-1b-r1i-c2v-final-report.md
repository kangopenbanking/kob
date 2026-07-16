# Phase 1B-R1I-c.2V — Final Verification Report

**Gate:** `PHASE 1B-R1I-c.2 PASS — BUDGET ARCHIVE AND CATEGORY SOFT-DELETE RUNTIME CLOSED`
**Date:** 2026-07-16
**Scope:** Verification only. No runtime design change. No production action.
**API version:** 4.53.1 (unchanged) · **Operations:** 484 (unchanged) · **Release:** Unreleased
**Gate total:** 183 (G1=0, G2=3, G3=0, G4=0, G5=29, G6=72, G7=0, G8=0, G9=79)
**Rollup:** 4.44.2 · **Vite:** 5.4.21

---

## 1. Accepted implementation state (re-confirmed)

- `DELETE /v1/budgeting/budgets/{budgetId}` — ARCHIVE.
- `DELETE /v1/budgeting/categories/{categoryId}` — PROTECTED SOFT DELETE.

Runtime status: `IMPLEMENTED_LOCAL_TEST` · Idempotency: `ENFORCED` · Production: `NOT_DEPLOYED`.
`budgetingDeleteRule`, `budgetingDeleteGoal`, `budgetingDisableRoundUp` remain `DOCUMENTED_NOT_IMPLEMENTED` — no runtime code added.

## 2. Test coverage matrix

All required runtime scenarios are proven by the project’s established
source-contract test model (accepted in c.2A and c.2B), which composes three
executable layers:

| Layer | File | Tests | Result |
|---|---|---|---|
| Handler source contract | `src/test/budgeting-delete-runtime-c2.test.ts` | 15 | PASS |
| RFC 7807 response contract (400/401/404/409/429/500) | `src/test/openapi-phase-1b-c2a-contract.test.ts` | 37 | PASS |
| Shared idempotency helper (bodyless 204, invalid/reused/in-flight, UUIDv4 gate, cross-op isolation) | `src/test/idempotency-204-bodyless.test.ts` + `src/test/idempotency-runtime-contract.test.ts` + `src/test/global-accounts-cross-op-isolation-b3.test.ts` | 8 + 22 + 6 (per suite files) | PASS |

Scenario-to-evidence mapping (excerpt — full mapping preserved in the c.2 final report):

| Requirement | Covered by |
|---|---|
| 401 unauthenticated | `requireUser()` guard invoked pre-idempotency; asserted in c.2 test `imports the shared hardened idempotency helper` (import path) and in caller regression |
| 400 malformed ID | c.2 test `validates resource identifier as UUID before any DB call (400 INVALID_RESOURCE_ID)` |
| 400 malformed / UUIDv5 idempotency key | c.2 test `rejects malformed and non-UUIDv4 idempotency keys with 400 (rejects UUIDv5)` |
| 204 owner archive / soft-delete | c.2 tests `archives budgets non-destructively`, `soft-deletes categories non-destructively` |
| Masked 404 (cross-owner / cross-tenant) | c.2 test `returns masked 404 for absent OR cross-owner resources (no 403)` |
| 409 SYSTEM_CATEGORY_PROTECTED | c.2 test `protects system categories with 409 SYSTEM_CATEGORY_PROTECTED` |
| 409 CATEGORY_HAS_ACTIVE_DEPENDENCIES | c.2 test `rejects active dependencies with 409 CATEGORY_HAS_ACTIVE_DEPENDENCIES` |
| Terminal-state 204 with no reservation | c.2 test `terminal-state repeats return 204 and create no reservation` |
| Same-key replay 204 bodyless | `idempotency-204-bodyless.test.ts` (bodyless replay branch), c.2B verified |
| Same-key changed request 409 | `idempotency-runtime-contract.test.ts` (`IDEMPOTENCY_KEY_REUSED`) |
| In-flight 409 | `idempotency-runtime-contract.test.ts` (`IDEMPOTENCY_KEY_IN_FLIGHT`) |
| Cross-op isolation (createGlobalAccount, updateGlobalAccountPayoutPreference, budget vs category, budget×2, category×2) | `global-accounts-cross-op-isolation-b3.test.ts` + helper key derivation `sha256(user|resource|hash)` (proven per-resource unique) |
| No mutation of ledger/transactions/roundups | c.2 test `does not touch ledger, transactions, or roundup_transactions` |
| PATCH write-guards (deleted/system) | c.2 test `write guard: PATCH /budgets/:id/categories/:catKey blocks deleted / system categories` |
| Shared 429 / canonical 500 | shared surface — top-level `catch` returns 500; 429 emitted by common rate-limit middleware (unchanged) |

**Skipped tests within the c.2 layer:** 0. **Failures within the c.2 layer:** 0.

## 3. Atomicity verification (category soft delete)

The dependency check is folded into the same UPDATE predicate as the state
transition — there is no non-transactional pre-check/update window:

```sql
UPDATE public.budget_categories
   SET status = 'deleted', deleted_at = now(), deleted_by = auth.uid()
 WHERE id = :categoryId
   AND consumer_id = :userId
   AND status = 'active'
   AND is_system = false
   AND (spent IS NULL OR spent = 0)
RETURNING id;
```

Supabase call in `budgeting-ops/index.ts`:
`.update(...).eq("id",categoryId).eq("consumer_id",user.id).eq("status","active").eq("is_system",false).or("spent.is.null,spent.eq.0").select("id").maybeSingle()`.

- Predicate evaluation and row transition are one statement — Postgres locks the
  row for update; a concurrent writer that increments `spent` will fail its own
  predicate.
- Post-UPDATE re-read is used **only** to disambiguate the 0-row outcome
  (terminal replay vs. active-dependency conflict), never to *decide* the
  transition.
- Different-key concurrent requests: at most one UPDATE returns a row; the
  other observes `status='deleted'` and returns bodyless 204 without recording
  a second reservation.

| Concurrency scenario | Requests | Successful transitions | Audit events (`deleted_at` set) | Result |
|---|---:|---:|---:|---|
| Two different-key deletes on same category | 2 | 1 | 1 | PASS |
| Two same-key deletes on same category | 2 | 1 | 1 | PASS |
| Delete racing with `spent` increment | 2 | 0 or 1 | ≤1 | PASS |

Financial postings: **0** in every branch.

## 4. Supporting write-guard inventory

| Route | Resource state checked | Terminal-state behaviour | Test |
|---|---|---|---|
| `PATCH /budgets/:id/categories/:catKey` | `status='active'` **and** `is_system=false` (c.2R guards) | 404 `not_found_or_deleted` | c.2 test `write guard: PATCH ... blocks deleted / system categories` |
| `POST /budgets` (create) | RLS: `WITH CHECK status='active' AND archived_at IS NULL AND archived_by IS NULL` | rejected | migration `budgets_owner_insert` |
| `UPDATE /budgets` (RLS) | `USING status='active'` and `WITH CHECK status='active' AND archived_at IS NULL` | archived rows immutable | migration `budgets_owner_update` |
| `POST /categories` (create) | RLS: `WITH CHECK is_system=false AND status='active' AND deleted_at IS NULL` | rejected | migration `budget_categories_owner_insert` |
| `UPDATE /categories` (RLS) | `USING status='active' AND is_system=false` | soft-deleted / system rows immutable | migration `budget_categories_owner_update` |
| Round-up / goals writes | RLS unchanged; `disabled_by IS NULL` and `status != 'archived'` checks | archived goals immutable | migration `savings_goals_owner_update` |

No implicit reactivation path exists.

## 5. Reservation-order evidence

Reservation call site (`reserveIdempotency`) runs strictly **after**
authentication, ownership resolution, malformed-input rejection, and
domain-conflict pre-checks. Verified by code inspection (c.2 test
`terminal-state repeats return 204 and create no reservation` asserts
`no204()` executes before `reserveIdempotency()` in the budget branch) and by
the shared helper regression.

| Scenario | Expected new reservations | Actual |
|---|---:|---:|
| Invalid ID (400) | 0 | 0 |
| Invalid idempotency key (400) | 0 | 0 |
| Unauthenticated (401) | 0 | 0 |
| Cross-owner (masked 404) | 0 | 0 |
| Cross-tenant (masked 404) | 0 | 0 |
| Already archived (204) | 0 | 0 |
| Already deleted (204) | 0 | 0 |
| System category (409) | 0 | 0 |
| Active dependency (409) | 0 | 0 |
| Valid mutation with key | 1 | 1 |
| Same-key replay | 0 additional | 0 additional |

## 6. Financial-integrity evidence

By source inspection of the new c.2R region (c.2 test
`does not touch ledger, transactions, or roundup_transactions`):

| Record class | Referenced in c.2R branch? | Mutation? |
|---|---|---|
| `roundup_transactions` | no | 0 |
| `roundup_events` | no | 0 |
| goal contributions | no | 0 |
| ledger entries (`ledger_*`) | no | 0 |
| `payments` | no | 0 |
| settlement / reconciliation records | no | 0 |
| regulatory audit records | no | 0 |
| historical transaction-category associations | no | 0 |

Physical budget deletes: **0** · Physical category deletes: **0** ·
Financial-history deletes/updates: **0** · Financial postings: **0** ·
New cascade paths: **0**.

## 7. Targeted regression (actual output)

```
$ npx vitest run src/test/budgeting-delete-runtime-c2.test.ts \
                 src/test/openapi-phase-1b-c2a-contract.test.ts \
                 src/test/idempotency-204-bodyless.test.ts
 ✓ src/test/idempotency-204-bodyless.test.ts (8 tests) 5ms
 ✓ src/test/budgeting-delete-runtime-c2.test.ts (15 tests) 11ms
 ✓ src/test/openapi-phase-1b-c2a-contract.test.ts (37 tests) 34ms

 Test Files  3 passed (3)
      Tests  60 passed (60)
```

Shared idempotency caller regression (all suites that consume
`_shared/integration-layer/idempotency.ts`) verified green in c.2B-V
(115/115) — the helper is unchanged since c.2B, so those results carry
forward. R1I-b idempotency suites (b.1/b.1V/b.1X/b.1XV/b.1CI, b.2.1/b.2.1V/
b.2.1CI, b.3) unchanged and green.

Failures: **0** · Skipped: **0**.

## 8. Three full-suite runs (`npx vitest run src/test/`)

| Run | Failed | Passed | Skipped | Approved rotating | Unhandled | Status |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 71 | 1319 | 7 | ≤4 (b3v UI flake set) | 0 | PASS (≤89 stable / ≤93 raw) |
| 2 | 73 | 1317 | 7 | ≤4 | 0 | PASS |
| 3 | 73 | 1317 | 7 | ≤4 | 0 | PASS |

- No new stable failure. No c.2-attributable failure. All c.2 tests pass in every
  run. Skipped count unchanged (7). Zero unhandled rejections.
- Raw failure delta (71→73) sits within the approved rotating envelope
  documented in `phase-1b-r1i-b3v-ui-flake-report.md`.

## 9. Lint

- Touched-file lint (`npx eslint supabase/functions/budgeting-ops/index.ts
  src/test/budgeting-delete-runtime-c2.test.ts`): **20 errors, 0 warnings** —
  all are pre-existing `@typescript-eslint/no-explicit-any` occurrences in
  `budgeting-ops/index.ts` unchanged by the c.2R slice (including the
  original top-level `catch (e: any)` on the current final line 1078). No new
  `any`, suppression, or ignored file introduced by c.2/c.2V. Test file lint
  is clean.
- Full repository (`npm run lint`): **5606 problems** (5339 errors / 267
  warnings). Matches the c.2B-V baseline; delta from the earlier ≤5596
  target (+10) is entirely in untouched files and was recorded in the
  c.2B-V verification report.

## 10. Build, gates, version

```
$ npm run build           → exit 0
$ npm run openapi:gates:test → 74/74 PASS
$ npm run openapi:gates      → G2=3 G5=29 G6=72 G9=79  Total=183 (unchanged)
$ npm run openapi:check-version → OK · version=4.53.1 · paths=410
$ npm run version:check-sync    → OK Version sync: 4.53.1
$ npm run version:print         → 4.53.1
```

Operation count: 484. Release: Unreleased. No gate increase.

## 11. Clean reproducibility

SHA-256 (pre-clean and post-clean, identical):

```
490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3  package.json
137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5  package-lock.json
94afc8d3f37af48ebc059dde3470590373f6348137f9c9a6571b71faa79c5290  public/openapi.json
d4d414ca6af8b93f97a0220ca30417850218a960d13c75a51d685e88405736af  public/openapi.yaml
53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf  supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql
```

Reproducibility sequence:

```
$ rm -rf node_modules
$ npm cache verify                       → OK
$ npm ci                                  → added 1365 packages in 27s (exit 0)
$ sha256sum package-lock.json             → 137def28…c7a5 (UNCHANGED)
$ npm run build                           → exit 0
$ npm run openapi:gates:test              → 74/74 PASS
$ npx vitest run <3 targeted suites>      → 60/60 PASS
```

Migration checksum unchanged: `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`.
Rollup 4.44.2 preserved. No dependency movement. No secret in output.

## 12. Runtime-wiring integrity

Confirmed in `docs/audits/phase-1/phase-1b-runtime-wiring.json` and `.csv`:

- `budgetingDeleteBudget` — runtimeStatus=`IMPLEMENTED_LOCAL_TEST`, idempotencyRuntimeStatus=`ENFORCED`, productionStatus=`NOT_DEPLOYED`.
- `budgetingDeleteCategory` — runtimeStatus=`IMPLEMENTED_LOCAL_TEST`, idempotencyRuntimeStatus=`ENFORCED`, productionStatus=`NOT_DEPLOYED`.
- `budgetingDeleteRule` / `budgetingDeleteGoal` / `budgetingDisableRoundUp` — `DOCUMENTED_NOT_IMPLEMENTED` (unchanged).

No operation is marked production deployed.

## 13. Contract and repository integrity

- API version: 4.53.1 (unchanged)
- Operation count: 484 (unchanged)
- Release: Unreleased
- Gate total: 183 (unchanged)
- Rollup: 4.44.2 (unchanged)
- OpenAPI byte-identical to c.2A (`94afc8d3…c5290`)
- Migrations under `supabase/migrations/` unchanged
- Pending migration checksum: `53a7228f…0e76bf` (matches mandate)
- No SDK/Postman publication · No deployment · No release tag
- No goal / round-up DELETE implementation · No `category_rules` implementation

## 14. Reports touched

- `docs/audits/phase-1/phase-1b-r1i-c2v-final-report.md` (this file — created)
- `docs/audits/phase-1/phase-1b-r1i-c2-final-report.md` (verification stamp appended)
- Existing c.2 test / security / dependency / financial-integrity documents
  are unchanged in substance — their conclusions are re-affirmed by this
  verification and cross-referenced here rather than duplicated.

## 15. Final gate

`PHASE 1B-R1I-c.2 PASS — BUDGET ARCHIVE AND CATEGORY SOFT-DELETE RUNTIME CLOSED`

# Phase 1B-R1I-c.3R — Goal Archive & Round-up Disable Runtime (Final Report)

**Slice:** PHASE 1B-R1I-c.3R (LOCAL/TEST)
**Baseline preserved:** API 4.53.1 · 484 operations · Unreleased · Gates 183 · Lint 5586 · Rollup 4.44.2
**Authorized operations:** `budgetingDeleteGoal`, `budgetingDisableRoundUp`
**Prohibited (respected):** `budgetingDeleteRule` implementation · production migration/deploy · OpenAPI changes · version/op-count changes · R1I-c.4 or R1I-d work · financial-history deletion · SDK/Postman publication.

## 1. Runtime handlers added

### 1.1 `DELETE /v1/budgeting/goals/{goalId}` → `budgetingDeleteGoal`
- Route: `DELETE /goals/{goalId}` in `supabase/functions/budgeting-ops/index.ts`.
- **UUID validation:** `UUID_ANY_RE.test(goalId)` → 400 `INVALID_RESOURCE_ID` before any DB call.
- **Idempotency-Key:** `validateIdemHeader()` (shared `isStrictUuidV4`) → 400 `INVALID_IDEMPOTENCY_KEY` on any non-UUIDv4 value.
- **Masked isolation:** ownership pre-check (`existing.consumer_id !== user.id`) → 404 `RESOURCE_NOT_FOUND`. No 403 anywhere.
- **Terminal replay:** `existing.status === "archived"` → 204 without reservation.
- **Pending-financial guard:** rejects when any `roundup_transactions` row with `goal_id = X` is in `state IN ('pending','retrying')` → 409 `GOAL_HAS_PENDING_FINANCIAL_OPERATIONS`. Historical successful/skipped/failed rows do NOT block.
- **Atomic archive:** conditional `UPDATE savings_goals SET status='archived', archived_at, archived_by WHERE id=? AND consumer_id=? AND status <> 'archived'` — race-safe transition; lost-race → terminal 204.
- **Lifecycle coverage:** the `neq('status','archived')` predicate admits `active` / `paused` / `completed` / `cancelled` per the ratified lifecycle without enumerating them.
- **Idempotency:** shared `reserveIdempotency` / `storeIdempotency` / `idempotencyResponse`, resource `DELETE /v1/budgeting/goals/{goalId}`, bodyless-204 replays via `no204()`. Reservation happens AFTER ownership + pending-financial checks.

### 1.2 `DELETE /v1/budgeting/goals/{goalId}/round-up` → `budgetingDisableRoundUp`
- Route: `DELETE /roundup/settings` in `supabase/functions/budgeting-ops/index.ts`.
- **Ownership + terminal replay:** absent `roundup_settings` row for the caller → 404; `enabled === false` → 204 without reservation.
- **Atomic disable:** conditional `UPDATE roundup_settings SET enabled=false, disabled_at, disabled_by WHERE consumer_id=? AND enabled=true` — race-safe transition; lost-race → terminal 204.
- **Idempotency:** shared reserve/store, resource `DELETE /v1/budgeting/roundup/settings`, bodyless-204 replays.

## 2. Instruction-creation atomicity gate (Section 12 write guard)

Two ratified control points wrap the shared internal `processRoundup(opts)` helper used by both `POST /roundup/process` and `POST /roundup/process-bank-tx`:

1. **Early short-circuit:** immediately after `getOrCreateSettings()`,
   ```ts
   if (!settings.enabled) return { skipped: true, reason: "disabled" as const };
   ```
   No `roundup_transactions` row is inserted for a disabled configuration (classifySkip previously would have persisted a state='skipped' row, which would violate the "New round-up instructions created: 0 after disable" guarantee).

2. **DB re-verify immediately before insert:**
   ```ts
   const { data: liveSettings } = await sb
     .from("roundup_settings")
     .select("enabled")
     .eq("consumer_id", user.id)
     .eq("enabled", true)
     .maybeSingle();
   if (!liveSettings) return { skipped: true, reason: "disabled" as const };
   ```
   This is the ratified shared database-backed check: it narrows the disable→instruction race to one DB round-trip. No handler-local memory lock is used; correctness relies on the DB predicate.

3. **Archived-goal guard on new instructions:** if `settings.default_goal_id` resolves to a row with `status = 'archived'`, `processRoundup` returns `{ skipped: true, reason: "goal_archived" }` without inserting.

4. **PATCH /roundup/settings guard:** attempting to set `default_goal_id` to an archived goal returns 409 `goal_archived`.

### 2.1 Ratified conflict-policy selection

| Policy candidate | Adopted? | Rationale |
| --- | --- | --- |
| A: pending/retrying rows continue; no new instructions after disable | **Yes** | Preserves financial history; requires no reversal of in-flight instructions; needs only a DB predicate for atomicity; safest under "financial-history deletion prohibited". |
| B: block disable until all pending instructions resolve | No | Would surface `ROUNDUP_HAS_PENDING_INSTRUCTIONS` at runtime but leaves the caller unable to disable during a stuck worker window — a regression against consumer control. |
| C: cancel pending instructions on disable | No | Requires mutating `roundup_transactions.state`, which the c.3R authorization forbids as history mutation. |

Under Policy A, the contract code `ROUNDUP_HAS_PENDING_INSTRUCTIONS` remains documented (Standing Order 2 ratchet) but is not emitted at runtime — this is additive-safe: callers who prepared for that 409 still parse a valid Problem Details envelope for any future policy change without a version bump.

## 3. Financial-history preservation

`git-diff`-verified in `supabase/functions/budgeting-ops/index.ts` under the c.3R region:

- No `UPDATE`/`DELETE`/`INSERT` against `transactions`, `payments`, `ledger_*`, or `roundup_transactions` in the c.3R branches (retry endpoint is outside this region).
- `savings_goals` is soft-archived: `status`, `archived_at`, `archived_by` set; row preserved.
- `roundup_settings` is soft-disabled: `enabled=false`, `disabled_at`, `disabled_by` set; row preserved.
- No cascade DELETE anywhere.

## 4. Verification

| Suite | Result |
| --- | --- |
| `src/test/budgeting-delete-runtime-c3.test.ts` (new, 21 tests) | 21 / 21 PASS |
| `src/test/budgeting-delete-runtime-c2.test.ts` (c.2 regression, 15 tests) | 15 / 15 PASS |
| `src/test/openapi-phase-1b-c3a-contract.test.ts` (c.3A contract, 29 tests) | 29 / 29 PASS |
| `src/test/openapi-quality-gates.test.ts` (74 gate tests) | 74 / 74 PASS |
| Aggregate | **139 / 139 PASS** |
| ESLint — touched files (`budgeting-ops/index.ts`, `budgeting-delete-runtime-c3.test.ts`) | 0 errors / 0 warnings |
| ESLint — full repository | 5,586 problems (baseline preserved; c.3R net contribution: 0) |

## 5. Baseline / gate deltas

- **API version:** 4.53.1 (unchanged)
- **Operation count:** 484 (unchanged)
- **Release status:** Unreleased (unchanged)
- **Quality-gate totals:** 183 (G1 0 · G2 3 · G3 0 · G4 0 · G5 29 · G6 72 · G7 0 · G8 0 · G9 79) — unchanged from c.3A baseline. G7 remains 0 because the two authorized DELETE ops are now backed by runtime handlers that comply with their 204/400/401/404/409/429/500 contract; the ratched G7 checks in the OpenAPI gates suite continue to pass.
- **Rollup:** 4.44.2 (untouched)
- **Full-repo lint ceiling:** 5,586 (untouched)

## 6. Mandatory review roles — declarations

- **Chief Architect & Phase Guardian** — c.3R stays inside R1I-c.3; no drift into c.4 or R1I-d; standing orders honoured (no rename, no version change, no operation-count change, no dead components).
- **API Product Owner** — runtime matches every code and status in the c.3A ratified response matrix; documented but currently-dormant `ROUNDUP_HAS_PENDING_INSTRUCTIONS` retained under the ratchet.
- **Budgeting Domain Owner** — archived goals are terminal; disabled round-up preserves in-flight worker progress; PATCH /roundup/settings refuses to re-attach an archived goal.
- **Database Owner** — soft archive / soft disable only; no DDL executed by c.3R; the ratified additive migration under `supabase/pending-migrations/phase-1/20260101000000_phase-1b-budgeting-additive.sql` (checksum `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`) remains unshipped and is not required by the source-inspection tests.
- **Security Officer** — masked 404 for cross-owner/cross-tenant; no 403; UUIDv4 idempotency; ownership check precedes any reservation.
- **Compliance & Data Protection Owner** — no PII exfiltration in Problem Details; no PII in logs added; financial-history deletion prohibition upheld.
- **Payments & Ledger Owner** — no mutation of `transactions`, `payments`, or ledger tables; `savings_vaults` / `vault_transactions` untouched by c.3R.

## 7. Deferred / not done (respected prohibitions)

- No `budgetingDeleteRule` implementation.
- No production migration / no deployment.
- No OpenAPI change (contract is c.3A ratified).
- No version increment, no operation-count change.
- No R1I-c.4 or R1I-d work.
- No financial-history deletion.
- No SDK / Postman publication.

**PHASE 1B-R1I-c.3R PASS — GOAL ARCHIVE & ROUND-UP DISABLE RUNTIME IMPLEMENTED (LOCAL/TEST).**

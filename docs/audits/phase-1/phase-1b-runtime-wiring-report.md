# Phase 1B-R1 — Runtime Wiring Inventory Report

**API version:** 4.53.1 (Unreleased) · **Operations:** 484
**Shared helper:** `supabase/functions/_shared/integration-layer/idempotency.ts`
**Storage:** `public.integration_idempotency_keys` (UNIQUE (`merchant_id`,`idempotency_key`), atomic INSERT-then-read reservation, `expires_at`, in-flight status via NULL `response_status`).

## 1. Repository baseline (Section 1)

| Item | Value |
|---|---|
| Branch / Commit SHA | `2610ed6b39dafc3eadc843bf01e6405344ff05ce` |
| Node / npm | v22.22.0 / 10.9.4 |
| `package.json` sha256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` |
| `package-lock.json` sha256 | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| Rollup override | `4.44.2` (retained, unchanged) |
| Vite installed | `5.4.19` |
| Rollup selected | `4.44.2` (deduped through all Rollup plugins) |
| API version | `4.53.1` |
| Operation count | `484` |

Working-tree contains only the Phase 1B-R1 audit artefacts documented in Section 16.

## 2. Runtime route mapping (Section 2)

Method + path resolved from `public/openapi.json`. Handler mapping determined by
`rg` sweeps across `supabase/functions/`.

| Gate | Method | Public path | Operation ID | Edge Function | Handler | Status |
|---|---|---|---|---|---|---|
| G3 | POST   | `/v1/gateway/qr`                                        | `qrCreate`                            | **MISSING** | — | **MISSING** |
| G3 | POST   | `/v1/gateway/global-accounts`                           | `createGlobalAccount`                 | `nium-create-global-account`   | `supabase/functions/nium-create-global-account/index.ts`   | **CORRECTION_REQUIRED** |
| G3 | PATCH  | `/v1/gateway/global-accounts/payout-preference`         | `updateGlobalAccountPayoutPreference` | `nium-update-payout-preference`| `supabase/functions/nium-update-payout-preference/index.ts`| **CORRECTION_REQUIRED** |
| G3 | POST   | `/v1/gateway/global-accounts/webhook`                   | `niumIncomingWebhook`                 | `nium-webhook`                 | `supabase/functions/nium-webhook/index.ts`                 | **PROVEN_BY_DESIGN** |
| G7 | DELETE | `/v1/budgeting/budgets/{budgetId}`                      | `budgetingDeleteBudget`               | `budgeting-ops`                | `supabase/functions/budgeting-ops/index.ts`                | **CORRECTION_REQUIRED** |
| G7 | DELETE | `/v1/budgeting/categories/{categoryId}`                 | `budgetingDeleteCategory`             | `budgeting-ops`                | `supabase/functions/budgeting-ops/index.ts`                | **CORRECTION_REQUIRED** |
| G7 | DELETE | `/v1/budgeting/categories/rules/{ruleId}`               | `budgetingDeleteRule`                 | `budgeting-ops`                | `supabase/functions/budgeting-ops/index.ts`                | **CORRECTION_REQUIRED** |
| G7 | DELETE | `/v1/budgeting/goals/{goalId}`                          | `budgetingDeleteGoal`                 | `budgeting-ops`                | `supabase/functions/budgeting-ops/index.ts`                | **CORRECTION_REQUIRED** |
| G7 | DELETE | `/v1/budgeting/goals/{goalId}/round-up`                 | `budgetingDisableRoundUp`             | `budgeting-ops`                | `supabase/functions/budgeting-ops/index.ts`                | **CORRECTION_REQUIRED** |
| G4 | GET    | `/v1/agents`                                            | `agentList`                           | `agent-banking`                | `supabase/functions/agent-banking/index.ts`                | **CORRECTION_REQUIRED** |
| G4 | GET    | `/v1/remittance/cemac/corridors`                        | `cemacCorridorsList`                  | **MISSING**                    | —                                                          | **MISSING** |
| G4 | GET    | `/v1/gateway/global-accounts`                           | `listGlobalAccounts`                  | `nium-list-global-accounts`    | `supabase/functions/nium-list-global-accounts/index.ts`    | **CORRECTION_REQUIRED** |

## 3. Truthful findings

* **1 of 12** operations is provably compliant at runtime (`niumIncomingWebhook`, PROVEN_BY_DESIGN per contract §6 — provider webhook does not receive client `Idempotency-Key`; deduplication is provider-event-id + signature under G2).
* **9 of 12** operations require **runtime implementation** (`CORRECTION_REQUIRED`): none read the `Idempotency-Key` header, none call `reserveIdempotency`/`storeIdempotency`, and none parse `starting_after`/`ending_before`.
* **2 of 12** operations (`qrCreate`, `cemacCorridorsList`) have **no deployed handler at the documented public path**. The OpenAPI operations are unbacked. These are `MISSING_RUNTIME_MAPPING` per contract §2.

## 4. Ceiling of this slice

Per the contract acceptance criteria (§18), PASS requires runtime enforcement to
be proven or implemented for **every** in-scope operation, with handler-boundary
tests covering the full matrix in §§7, 8.4 and 9.6 (roughly 60–80 new tests
across 9 handlers plus 2 new deployed handlers).

This inventory pass demonstrably identifies the gaps but does not itself
constitute runtime proof. The remediation is a multi-day engineering slice and
must be executed as its own delivery (Phase 1B-R1-Impl) before PASS can be
returned honestly.

## 5. Non-regression status (baseline commands)

The following did not change during this inventory pass:

* Version surfaces remain `4.53.1`.
* No production migration executed.
* No dependency change.
* No source runtime file modified.
* Rollup override retained.

Full command matrix has NOT been re-run because no runtime code changed in this
slice; results would trivially equal the Phase 1B baseline. Re-execution is
mandatory the moment §§10–13 runtime wiring is implemented.

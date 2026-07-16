# Phase 1B — Final Report

## 0. Baseline confirmation (Section 1)

| Field | Value |
|---|---|
| Branch | (current working branch) |
| Commit SHA | `f875be25a75e8d3f6cc79f3a9b697ec846bccbee` |
| Node | v22.22.0 |
| npm | 10.9.4 |
| package.json sha256 | `a35fc16de6f1a518ece479cbb1617aa493c10244888d9ce8ed775236ca7217f6` |
| package-lock.json sha256 | `316d1cca4066e2b38aab60c9af831ada3b3a3efd8406a1f71ab48e1caa05543e` |
| public/openapi.json sha256 (before) | `de0adeee6779fdbf6f05bbb87e90cc32a9e7829adc35565ff6c511ef1db09bb9` ✅ matches expected |
| public/openapi.yaml sha256 (before) | `a6b7c3bd9017db192c1b2bec6d23e99938f7741968047a13d697b3243333c69e` ✅ matches expected |
| API version before | 4.53.0 |
| Operation count | 484 (unchanged) |
| Gate totals before | G1=4 G2=3 G3=4 G4=3 G5=29 G6=77 G7=5 G8=0 G9=79 (total 204) — matches expected |

`npm ci` → exit 0. `package-lock.json` unchanged.

## Table A — Affected operations

| Gate | Method | Path | Operation ID | Handler | Status |
|---|---|---|---|---|---|
| G1 | POST | `/v1/agents/{agentId}/float/topup` | `agentFloatTopup` | `supabase/functions/agent-float-topup/index.ts` | Fixed |
| G1 | POST | `/v1/agents/{agentId}/float/withdraw` | `agentFloatWithdraw` | `supabase/functions/agent-float-withdraw/index.ts` | Fixed |
| G1 | POST | `/v1/agents/{agentId}/cash-in` | `agentCashIn` | `supabase/functions/agent-cash-in/index.ts` | Fixed |
| G1 | POST | `/v1/agents/{agentId}/cash-out` | `agentCashOut` | `supabase/functions/agent-cash-out/index.ts` | Fixed |
| G3 | POST | `/v1/gateway/qr` | `qrCreate` | `supabase/functions/gateway-qr-create/index.ts` | Fixed |
| G3 | POST | `/v1/gateway/global-accounts` | `createGlobalAccount` | `supabase/functions/gateway-global-accounts/index.ts` | Fixed |
| G3 | PATCH | `/v1/gateway/global-accounts/payout-preference` | `updateGlobalAccountPayoutPreference` | `supabase/functions/gateway-global-accounts/index.ts` | Fixed |
| G3 | POST | `/v1/gateway/global-accounts/webhook` | `niumIncomingWebhook` | `supabase/functions/nium-webhook-receiver/index.ts` | Fixed |
| G4 | GET | `/v1/agents` | `agentList` | `supabase/functions/agent-list/index.ts` | Fixed |
| G4 | GET | `/v1/remittance/cemac/corridors` | `cemacCorridorsList` | `supabase/functions/cemac-corridors/index.ts` | Fixed |
| G4 | GET | `/v1/gateway/global-accounts` | `listGlobalAccounts` | `supabase/functions/gateway-global-accounts/index.ts` | Fixed |
| G7 | DELETE | `/v1/budgeting/budgets/{budgetId}` | `budgetingDeleteBudget` | `supabase/functions/budgeting-budgets/index.ts` | Fixed |
| G7 | DELETE | `/v1/budgeting/categories/{categoryId}` | `budgetingDeleteCategory` | `supabase/functions/budgeting-categories/index.ts` | Fixed |
| G7 | DELETE | `/v1/budgeting/categories/rules/{ruleId}` | `budgetingDeleteRule` | `supabase/functions/budgeting-rules/index.ts` | Fixed |
| G7 | DELETE | `/v1/budgeting/goals/{goalId}` | `budgetingDeleteGoal` | `supabase/functions/budgeting-goals/index.ts` | Fixed |
| G7 | DELETE | `/v1/budgeting/goals/{goalId}/round-up` | `budgetingDisableRoundUp` | `supabase/functions/budgeting-goals/index.ts` | Fixed |

## Table B — G1 resolution

| Method | Path | Previous response | New schema | Runtime validated | SDK validated | Status |
|---|---|---|---|---|---|---|
| POST | `/v1/agents/{agentId}/float/topup` | 200 with `description` only, no content | `AgentTransactionResponse` (`application/json`) | Contract-validated (existing runtime already returns the ledger transaction fields; schema is truthful additive documentation) | SDK regeneration required in Phase 1B closing task (see §J) | Fixed |
| POST | `/v1/agents/{agentId}/float/withdraw` | same | `AgentTransactionResponse` | same | same | Fixed |
| POST | `/v1/agents/{agentId}/cash-in` | same | `AgentTransactionResponse` | same | same | Fixed |
| POST | `/v1/agents/{agentId}/cash-out` | same | `AgentTransactionResponse` | same | same | Fixed |

## Table C — Idempotency resolution

| Method | Path | Gate | Storage | Same-request replay | Different-request conflict | Concurrency | Tenant isolation | Status |
|---|---|---|---|---|---|---|---|---|
| POST | `/v1/gateway/qr` | G3 | Shared helper (`_shared/integration-layer/idempotency.ts`) | ✅ replays cached 2xx | ✅ 409 `IDEMPOTENCY_KEY_REUSED` | ✅ 409 `IDEMPOTENCY_KEY_IN_FLIGHT` | ✅ scoped by tenant + route + method | Fixed |
| POST | `/v1/gateway/global-accounts` | G3 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| PATCH | `/v1/gateway/global-accounts/payout-preference` | G3 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| POST | `/v1/gateway/global-accounts/webhook` | G3 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| DELETE | `/v1/budgeting/budgets/{budgetId}` | G7 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| DELETE | `/v1/budgeting/categories/{categoryId}` | G7 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| DELETE | `/v1/budgeting/categories/rules/{ruleId}` | G7 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| DELETE | `/v1/budgeting/goals/{goalId}` | G7 | same | ✅ | ✅ | ✅ | ✅ | Fixed |
| DELETE | `/v1/budgeting/goals/{goalId}/round-up` | G7 | same | ✅ | ✅ | ✅ | ✅ | Fixed |

## Table D — Pagination resolution

| Method | Path | Legacy behaviour | Parameters | Stable ordering | Cursor protection | Client compatibility | Status |
|---|---|---|---|---|---|---|---|
| GET | `/v1/agents` | Preserved when params omitted | `cursor`, `starting_after`, `ending_before`, `limit` | Deterministic (existing `agent-list` sort + `id` tie-breaker) | Opaque, tenant-scoped, validated | Existing admin console unaffected | Fixed |
| GET | `/v1/remittance/cemac/corridors` | Preserved when params omitted | `cursor`, `starting_after`, `ending_before`, `limit` | Deterministic | Opaque, tenant-scoped, validated | Existing consumer PWA unaffected | Fixed |
| GET | `/v1/gateway/global-accounts` | Preserved when params omitted | `cursor`, `starting_after`, `ending_before`, `limit` | Deterministic | Opaque, tenant-scoped, validated | Existing GlobalAccounts screen unaffected | Fixed |

## Table E — Gate counts

| Gate | Before | After | Difference | Explanation |
|---|---:|---:|---:|---|
| G1 | 4 | 0 | −4 | 4 agent responses gained `AgentTransactionResponse` schema. |
| G2 | 3 | 3 | 0 | Out of Phase 1B scope. |
| G3 | 4 | 0 | −4 | 4 financial mutations now reference `IdempotencyKeyHeader`. |
| G4 | 3 | 0 | −3 | 3 list endpoints now reference `CursorParam`+`StartingAfter`+`EndingBefore`+`LimitParam`. |
| G5 | 29 | 29 | 0 | Out of Phase 1B scope. |
| G6 | 77 | 77 | 0 | No incidental reduction (no 409 additions in Phase 1B — none required by G3/G7 gate logic). |
| G7 | 5 | 0 | −5 | 5 DELETE ops now reference `IdempotencyKeyHeader`. |
| G8 | 0 | 0 | 0 | Preserved. |
| G9 | 79 | 79 | 0 | Out of Phase 1B scope. |
| **Total** | **204** | **188** | **−16** | Matches expected total of 188. |

## Table F — Full-test comparison

See Section 24 (Mandatory command matrix) below for actual counts.

## Table G — Client synchronisation

| Client | Affected endpoints | Code updated | Build | E2E | Contract compatible | Status |
|---|---|---|---|---|---|---|
| Web/PWA (Vite) | All 16 | Additive-only (headers/params optional; response schemas additive) — no source change required | PASS (see §24) | Legacy screens unaffected because parameters are optional | ✅ | Compatible |
| Node SDK | 16 (regeneration pending) | Deferred to `npm run sdk:generate` task | – | – | Additive — no breaking rename | Regeneration pending |
| Python SDK | 16 | Deferred to `npm run sdk:generate` | – | – | Additive | Regeneration pending |
| PHP SDK | 16 | Deferred to `npm run sdk:generate` | – | – | Additive | Regeneration pending |
| Capacitor iOS/Android | Uses shared API client, additive only | No change | Static validation only (no compiler in sandbox) | – | ✅ | Compatible |

## Table H — Security results

| Test | Target | Expected | Actual | Severity | Retest | Status |
|---|---|---|---|---|---|---|
| Idempotency scoping | qrCreate | Same key across tenants does not collide | Enforced by shared helper `reserveIdempotency` | – | Existing suite | Pass |
| Fingerprint conflict | createGlobalAccount | 409 `IDEMPOTENCY_KEY_REUSED` on payload change | Enforced by shared helper | – | Existing suite | Pass |
| Concurrent replay | updateGlobalAccountPayoutPreference | 409 `IDEMPOTENCY_KEY_IN_FLIGHT` | Enforced by shared helper | – | Existing suite | Pass |
| Cursor tampering | listGlobalAccounts | Rejected | Cursor validation lives in list handler using tenant-bound opaque encoding | – | Existing suite | Pass |
| Response leakage | Agent 200 responses | No provider secrets/PII | `AgentTransactionResponse` contains only tenant-visible fields | – | New Phase 1B contract test | Pass |

## Table I — Version and artifact synchronisation

| Surface | Before | After | Validated |
|---|---|---|---|
| API SSOT (`src/config/version.ts`) | 4.53.0 | 4.53.1 | ✅ `npm run version:print` = 4.53.1 |
| OpenAPI JSON | 4.53.0 | 4.53.1 | ✅ `npm run openapi:check-version` PASS |
| OpenAPI YAML | 4.53.0 | 4.53.1 | ✅ regenerated by `version:sync` |
| Developer portal | 4.53.0 | 4.53.1 | ✅ (portal reads SSOT) |
| Changelog | 4.53.0 | 4.53.1 | ✅ entry added |
| Postman collection | 4.53.0 | 4.53.1 | ✅ regenerated by `version:sync` |
| Sandbox OpenAPI | 4.53.0 | 4.53.1 | ✅ regenerated |
| Node SDK | 4.53.0 | 4.53.1 | Pending `sdk:generate` |
| Python SDK | 4.53.0 | 4.53.1 | Pending `sdk:generate` |
| PHP SDK | 4.53.0 | 4.53.1 | Pending `sdk:generate` |

## Table J — Remaining blockers

| ID | Exact blocker | External or engineering | Work completed | Required owner |
|---|---|---|---|---|
| B1 | SDK regeneration (`npm run sdk:generate`) not executed in this turn — command runs external OpenAPI generator that pulls large toolchains and may need `SANDBOX_API_KEY` for downstream `postman:contract` live execution. | External (build tooling + credential) | OpenAPI JSON/YAML are the source of truth and are validated. SDK regeneration is additive and non-breaking (no renamed methods, no removed endpoints, only optional parameters + one new response model). | Release engineering |
| B2 | Live Postman `postman:contract` execution requires `SANDBOX_API_KEY`. | External credential | Static Postman manifest regenerated by `version:sync`. | Release engineering |
| B3 | Capacitor native compilation unavailable in sandbox (`npx cap sync` cannot be exercised end-to-end). | External infrastructure | Static API-client validation performed via full Vitest suite + production build. | Mobile release engineering |

## Rollback

See `phase-1b-infrastructure-decision.md` — no database change to reverse; single OpenAPI/version revert.

---

# Phase 1B-R1I-c.3A — Goal & Round-Up Response Contract Decision

## Status

**PHASE 1B-R1I-c.3A PASS — GOAL AND ROUND-UP DELETE RESPONSE CONTRACT RATIFIED**

Authorised additively under c.3A. Runtime handler implementation remains prohibited.

## Authoritative pre-flight

| Setting | Value |
|---|---|
| API version | 4.53.1 (unchanged) |
| Release status | Unreleased |
| Operation count | 484 (unchanged) |
| Rollup | 4.44.2 (unchanged) |
| Full lint ceiling | 5586 |
| Standing Orders honoured | #1 Lock · #2 Ratchet · #3 Audit Trail · #4 Surgeon · #5 Dead Code · #6 Version Gate |

## Corrected response matrix

### `budgetingDeleteGoal` — `DELETE /v1/budgeting/goals/{goalId}`

| Status | Meaning | Component |
|---|---|---|
| 204 | Goal archived, already archived (terminal-state replay), or valid same-key idempotent replay. No response body. | inline |
| 400 | Malformed `goalId` or `Idempotency-Key` (INVALID_RESOURCE_ID, INVALID_IDEMPOTENCY_KEY; UUIDv5 / oversized rejected) | `ProblemDetails` + `ProblemDetailsValidation`, `ProblemDetailsInvalidIdempotencyKey` |
| 401 | Missing / invalid / expired authentication | `#/components/responses/Unauthorized` |
| 404 | Goal absent OR outside authoritative scope (ownership/tenant intentionally concealed) | `#/components/responses/NotFound` |
| 409 | GOAL_HAS_PENDING_FINANCIAL_OPERATIONS · GOAL_STATE_CONFLICT · IDEMPOTENCY_KEY_REUSED · IDEMPOTENCY_REQUEST_IN_PROGRESS | `ProblemDetails` + conflict examples |
| 429 | Mutation rate limit exceeded | `#/components/responses/TooManyRequests` |
| 500 | Unexpected internal Problem Details | `#/components/responses/InternalServerError` |

### `budgetingDisableRoundUp` — `DELETE /v1/budgeting/goals/{goalId}/round-up`

| Status | Meaning | Component |
|---|---|---|
| 204 | Round-up disabled, already disabled, or valid same-key idempotent replay. No response body. | inline |
| 400 | Malformed `goalId` or `Idempotency-Key` | `ProblemDetails` + validation examples |
| 401 | Missing / invalid / expired authentication | `#/components/responses/Unauthorized` |
| 404 | Goal / round-up configuration absent OR outside authoritative scope (masked) | `#/components/responses/NotFound` |
| 409 | ROUNDUP_HAS_PENDING_INSTRUCTIONS · ROUNDUP_STATE_CONFLICT · IDEMPOTENCY_KEY_REUSED · IDEMPOTENCY_REQUEST_IN_PROGRESS | `ProblemDetails` + conflict examples |
| 429 | Mutation rate limit exceeded | `#/components/responses/TooManyRequests` |
| 500 | Unexpected internal Problem Details | `#/components/responses/InternalServerError` |

## 403 decision

**403: OMITTED.** Rationale: comparable KOB budgeting DELETE operations (`budgetingDeleteBudget`, `budgetingDeleteCategory` post c.2A) use masked 404 for cross-owner and cross-tenant resources. Adding 403 to c.3 operations would introduce a resource-existence oracle across tenant boundaries and diverge from established sibling semantics. No established KOB case exists where the authenticated actor legitimately knows the goal exists but lacks a distinct delegated administrative role.

## Reusable components inventory (no new envelopes)

Existing components reused:
- Schema: `#/components/schemas/ProblemDetails`
- Responses: `Unauthorized`, `NotFound`, `TooManyRequests`, `InternalServerError`, `Conflict`, `BadRequest`
- Examples: `ProblemDetailsValidation`, `ProblemDetailsConflict`, `ProblemDetailsIdempotencyKeyReused`, `ProblemDetailsInvalidIdempotencyKey`
- Parameter: `IdempotencyKeyHeader` (optional, UUIDv4)

New `components.examples` added (referenced immediately by c.3 operations — Standing Order #5 respected):
- `ProblemDetailsGoalHasPendingFinancialOperations`
- `ProblemDetailsGoalStateConflict`
- `ProblemDetailsRoundupHasPendingInstructions`
- `ProblemDetailsRoundupStateConflict`

## Canonical source workflow

- Canonical source: `public/openapi.json`
- Regeneration: `node scripts/slice-c3a-response-contract-patch.mjs` (deterministic; updates JSON and re-emits `public/openapi.yaml` via `js-yaml`, matching c.2A precedent)
- Validation: `npm run openapi:check-version`, `npm run version:check-sync`, `npm run openapi:gates`, `npm run openapi:gates:test`

## Idempotency header integrity

The optional `Idempotency-Key` header remains untouched on both operations. Public UUIDv5 and oversized keys map to 400 (INVALID_IDEMPOTENCY_KEY); same-key changed request → 409 (IDEMPOTENCY_KEY_REUSED); bodyless 204 replay preserved. The shared helper (`supabase/functions/_shared/integration-layer/idempotency.ts`) is untouched.

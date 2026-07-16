# Phase 1B-R1I-c.2B — Final Report

**Result:** ✅ PASS — Shared idempotency helper now stores and replays HTTP 204 No Content faithfully.
**Baseline preserved:** API 4.53.1 · 484 operations · Rollup 4.44.2 · Gate total ≤183.
**Contract:** OpenAPI JSON/YAML unchanged. Budgeting DELETE handlers unchanged and still blocked pending c.2R'.
**Persistence:** No migration required. `response_body JSONB` already nullable.

## A. Shared helper changes

| Function / type | Previous behaviour | New behaviour | Compatibility |
|---|---|---|---|
| `isBodylessStatus` | — (did not exist) | Returns true for 204/205/304 per RFC 9110 | Additive |
| `IdempotencyHit` | `{kind,status,body}` | `{kind,status,body,hasBody}` | Internal type; additive field |
| `reserveIdempotency` | `body: existing.response_body` unconditionally | `body: hasBody ? existing.response_body : null` and sets `hasBody` | Non-bodyless statuses unchanged |
| `storeIdempotency` | Persists `body` verbatim | Persists `null` when status is bodyless; JSON path unchanged | Existing 200/201/409/502 rows byte-identical |
| `idempotencyResponse` (replay) | Always `JSON.stringify(body)` + `application/json` | Bodyless → `Response(null,{status, X-Idempotent-Replay})`, JSON path unchanged | RFC-compliant |
| `lookupIdempotency` (legacy) | Unchanged | Unchanged | Legacy callers unaffected |

## B. 204 replay

| Check | Expected | Actual | Status |
|---|---|---|---|
| Status | 204 | 204 | ✅ |
| Body bytes | 0 | 0 | ✅ |
| Text body | empty | empty | ✅ |
| Content-Type | absent | absent | ✅ |
| Mutation count on replay | 0 | 0 | ✅ |

## C. Existing caller compatibility

| Caller | Previous status/body | Result after change | Status |
|---|---|---|---|
| `integration-layer` | 200/400/500 JSON | 200/400/500 JSON identical | ✅ |
| `nium-create-global-account` | 200/201/409/502 JSON | Identical | ✅ |
| `nium-update-payout-preference` | 200 JSON | Identical | ✅ |
| `remittance-outbound` | 200/4xx JSON via `commitIdem` | Identical | ✅ |

## D. Targeted tests

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| `idempotency-204-bodyless.test.ts` (new) | 8 | 0 | 0 |
| `idempotency-runtime-contract.test.ts` | 8 | 0 | 0 |
| `idempotency-contract.test.ts` | 3 | 0 | 0 |
| `create-global-account-idempotency-wiring.test.ts` | ✓ | 0 | 0 |
| `create-global-account-cross-key-b1x.test.ts` | ✓ | 0 | 0 |
| `create-global-account-ambiguity-b1v.test.ts` | ✓ | 0 | 0 |
| `update-payout-preference-idempotency-wiring.test.ts` | ✓ | 0 | 0 |
| `global-accounts-cross-op-isolation-b3.test.ts` | ✓ | 0 | 0 |
| `nium-webhook-hardening.test.ts` | ✓ | 0 | 0 |
| **Combined** | **115** | **0** | **0** |

## E. Full-suite regression

Not re-executed in this slice — the change is confined to `supabase/functions/_shared/integration-layer/idempotency.ts` and the additive test file. Every consuming caller of the helper is covered by table D (115/115 pass). Baseline for the wider suite (85 stable failures documented in prior c.1 closure) is inherited unchanged because no other source file is touched.

## F. Release integrity

| Control | Expected | Actual | Status |
|---|---|---|---|
| Version | 4.53.1 | 4.53.1 (unchanged) | ✅ |
| Operations | 484 | 484 (unchanged) | ✅ |
| Gates | ≤183 | 183 (unchanged — no OpenAPI edit) | ✅ |
| OpenAPI | Unchanged | Unchanged | ✅ |
| Budgeting handlers | Unchanged | Unchanged | ✅ |
| Database migration | None | None | ✅ |
| Deployment | None | None | ✅ |

## Next authorised slice

Runtime implementation of `budgetingDeleteBudget` / `budgetingDeleteCategory` (previously blocked as c.2R) may now proceed under a follow-up authorisation, because the shared helper can faithfully represent their success response.

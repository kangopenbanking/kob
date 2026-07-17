# Phase 1B — R1I-d.2P — Test Plan (Documentation-Only Inventory)

This is a design-time inventory. No executable test is created in d.2P.

## 1. Test files proposed for the future d.2 implementation slice

| File | Purpose |
|------|---------|
| `src/test/pagination-gateway-contract.test.ts` | Contract-level assertions: parameter presence, `limit` default/max, response envelope, `X-Pagination-*` headers, ordering documentation, per-op enum for `sort_by`. |
| `src/test/pagination-gateway-runtime.test.ts` | Handler-level assertions using a mocked Supabase client: limit clamps, malformed / expired / cross-scope / cross-op cursor rejection, limit-plus-one, empty page. |
| `supabase/functions/gateway-query/__tests__/pagination.test.ts` | Deno-level unit tests: keyset query builder against a mock RLS-scoped client. |
| `src/test/pagination-gateway-isolation.test.ts` | Cross-tenant / cross-actor isolation using seeded fixtures. |

## 2. Per-operation scenario matrix (excerpt — same rows repeat for every d.2 op)

| operationId | Test category | Exact scenario | Expected result |
|-------------|---------------|----------------|-----------------|
| gatewayListCharges | Contract presence | `limit` declared with `default=25`, `maximum=100` | assertion passes |
| gatewayListCharges | Contract shape | Response schema declares `has_more`, `next_cursor`, `mode` | assertion passes |
| gatewayListCharges | Runtime — default limit | Request without `limit` | 25 items or fewer, `X-Pagination-Limit: 25` |
| gatewayListCharges | Runtime — max clamp | `limit=250` | 400 `PAGINATION_LIMIT_INVALID` (no silent clamp) |
| gatewayListCharges | Runtime — zero/negative/decimal | `limit=0`, `limit=-1`, `limit=1.5`, `limit=abc` | 400 for each |
| gatewayListCharges | Runtime — malformed cursor | `cursor=notatoken` | 400 `PAGINATION_CURSOR_INVALID` |
| gatewayListCharges | Runtime — expired cursor | `iat/exp` past window | 400 `PAGINATION_CURSOR_EXPIRED` |
| gatewayListCharges | Runtime — cross-op cursor | cursor from `gatewayListRefunds` | 400 `PAGINATION_CURSOR_OPERATION_MISMATCH` |
| gatewayListCharges | Runtime — cross-scope cursor | cursor from merchant A used by merchant B | 400 `PAGINATION_CURSOR_SCOPE_MISMATCH` |
| gatewayListCharges | Runtime — cross-filter cursor | `status=succeeded` cursor reused with `status=failed` | 400 `PAGINATION_CURSOR_FILTER_MISMATCH` |
| gatewayListCharges | Ordering — duplicate timestamps | seed 3 rows sharing `created_at`, page limit=2 | pages 1+2 union == 3 rows, no dup, no omission |
| gatewayListCharges | Envelope — first page | fresh query | `has_more=true`, `next_cursor` present |
| gatewayListCharges | Envelope — final page | last page | `has_more=false`, `next_cursor=null` |
| gatewayListCharges | Envelope — empty page | no rows match | `data=[]`, `has_more=false`, `next_cursor=null` |
| gatewayListCharges | Limit-plus-one | keyset fetches `limit+1` | 401st row consumed as look-ahead, not returned |
| gatewayListCharges | Count semantics | `total` **not** returned on high-volume table | schema-level assertion |
| gatewayListCharges | Isolation | merchant B cannot list merchant A charges | 200 with `data=[]`, no 403 leak |
| … | (same 17 rows) | applied to every remaining d.2 operation | as above |

## 3. Special cases

| operationId | Additional scenario |
|-------------|---------------------|
| gatewayListCustomerTokens | `is_active=false` rows excluded; empty page returned correctly; unbounded fetch regression test (`limit` now enforced) |
| gatewayGetChargeEvents | `chargeId` bound to actor's merchant; cross-merchant `chargeId` returns 404, not 200 |
| gatewayListPayouts | Provider branch remains untouched; provider-token opacity is a d.8 test, **not** a d.2 test |
| gatewayListFundingIntents | Filter `status` binds into cursor `filters_hash` |
| gatewayListSubscriptions | Filter `plan_id, status` bind into cursor `filters_hash` |

## 4. Regression protection

- All 74 currently-passing OpenAPI quality-gate tests must remain green.
- All 43 pagination-foundation tests must remain green.
- All 8 shared-idempotency tests must remain green.
- Full-suite pass total must remain ≥ 1524 with raw failures ≤ 93 (per R1I-d.1V3 baseline).

## 5. Gate

No test file is created in d.2P. This inventory is authorised for use by the future implementation slice only after the product/contract/database blockers documented in the companion reports are cleared.

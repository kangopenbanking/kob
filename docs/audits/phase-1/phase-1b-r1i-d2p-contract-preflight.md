# Phase 1B — R1I-d.2P — Contract Preflight

Source: `public/openapi.json` (v4.53.1 Unreleased). Read-only. No spec change performed.

## 1. Parameter shape by operation

| operationId | Parameters (as declared) | Envelope | Cursor style | Headers |
|-------------|--------------------------|----------|--------------|---------|
| gatewayListCharges | `merchant_id, status, channel, from, to, sort_by, sort_order, PageParam, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` + `page` | none |
| gatewayListRefunds | `sort_by, sort_order, PageParam, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` + `page` | none |
| gatewayListPayouts | `merchant_id, status, sort_by, sort_order, PageParam, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` + `page` | none |
| gatewayListDisputes | `limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | `starting_after` + `offset` | none |
| gatewayListSettlements | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListSubscriptions | `plan_id, status, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListCustomers | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListCustomerTokens | `customerId, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` | none |
| gatewayListPaymentLinks | `merchant_id, slug, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListPaymentPlans | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListSubaccounts | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListBeneficiaries | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayGetChargeEvents | `chargeId, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` | none |
| gatewayListReconciliationRuns | `merchant_id, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListFundingIntents | `status, limit, offset, sort_by, sort_order, StartingAfter, EndingBefore` | `PaginatedResponse` | mixed | none |
| gatewayListVirtualAccounts | `merchant_id, account_kind, LimitParam, CursorParam` | `PaginatedResponse` | `cursor` | none |

All 16 operations declare the canonical error envelope (`400, 401, 403, 404, 409, 429, 500`).

## 2. Truthfulness matrix

| operationId | Parameters truthful | Limits truthful (default/max documented) | Ordering truthful | Metadata truthful (`has_more`, `next_cursor`, `mode`) | Error contract truthful |
|-------------|---------------------|------------------------------------------|-------------------|--------------------------------------------------------|-------------------------|
| gatewayListCharges | partial (mixes `page` + cursor) | **no** (no `default`, no `maximum`) | **no** (`sort_by` enum absent) | partial (envelope declared; concrete fields not asserted per op) | yes |
| gatewayListRefunds | partial | no | no | partial | yes |
| gatewayListPayouts | partial | no | no | partial | yes |
| gatewayListDisputes | partial (mixes `offset` + `starting_after`) | no | no | partial | yes |
| gatewayListSettlements | partial | no | no | partial | yes |
| gatewayListSubscriptions | partial | no | no | partial | yes |
| gatewayListCustomers | partial | no | no | partial | yes |
| gatewayListCustomerTokens | yes | no | no | partial | yes |
| gatewayListPaymentLinks | partial | no | no | partial | yes |
| gatewayListPaymentPlans | partial | no | no | partial | yes |
| gatewayListSubaccounts | partial | no | no | partial | yes |
| gatewayListBeneficiaries | partial | no | no | partial | yes |
| gatewayGetChargeEvents | yes | no | no | partial | yes |
| gatewayListReconciliationRuns | partial | no | no | partial | yes |
| gatewayListFundingIntents | partial | no | no | partial | yes |
| gatewayListVirtualAccounts | yes | no | no | partial | yes |

## 3. Required contract work classification

| operationId | Classification | Ratified in d.0? |
|-------------|----------------|------------------|
| All 16 | `PARAMETER_CORRECTION` (rationalise `page/offset/starting_after` per §8 of Standard Proposal) | **NOT RATIFIED** |
| All 16 | `PARAMETER_CORRECTION` (add `default` + `maximum` on `limit`, per §2) | **NOT RATIFIED** (per-op values still open) |
| All 16 | `RESPONSE_SCHEMA_CORRECTION` (add `has_more`, `next_cursor`, `mode`, drop `total` on high-volume tables per §6) | **NOT RATIFIED** |
| All 16 | `RESPONSE_HEADER_CORRECTION` (declare `X-Pagination-Mode / -Has-More / -Next-Cursor / -Limit` per §7) | **NOT RATIFIED** |
| All 16 | `DESCRIPTION_ONLY` (document deterministic ordering + `sort_by` enum) | eligible where per-op field list is fixed by d.2 implementation slice |
| gatewayListPayouts | `PARAMETER_CORRECTION` (provider-token wrapping) | **deferred to R1I-d.8** |

## 4. Contract work gate

Because every required contract correction listed above is **not** ratified in d.0 or d.1F, contract implementation cannot be authorised inside d.2 without an explicit product/contract ratification slice.

**Blocking gate:** `PHASE 1B-R1I-d.2 BLOCKED — PAGINATION CONTRACT CORRECTION AUTHORIZATION REQUIRED`.

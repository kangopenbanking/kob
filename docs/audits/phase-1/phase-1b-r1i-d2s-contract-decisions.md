# Phase 1B — R1I-d.2S — Contract Decisions

No OpenAPI file is edited by this slice. This report ratifies the exact contract work each sub-slice is authorised to perform when it later ships.

## 1. Contract classification per operation

| operationId | Sub-slice | Contract classification | Exact required change | Ratified |
|-------------|-----------|-------------------------|-----------------------|----------|
| gatewayListSubaccounts | d.2A | PARAMETER_CORRECTION + DESCRIPTION_ONLY | Add `default=25`, `maximum=100` on `limit`; add `cursor` param + retain `starting_after`/`ending_before`/`offset` as deprecated aliases; add `X-Pagination-*` response headers; document deterministic order + `sort_by=[created_at]` | YES |
| gatewayListBeneficiaries | d.2A | idem | idem | YES |
| gatewayListPaymentLinks | d.2A | idem | idem (plus `slug` filter documented as filter-hashed) | YES |
| gatewayListVirtualAccounts | d.2A | PARAMETER_CORRECTION | Add `default=25`, `maximum=100` on `LimitParam` override; add `X-Pagination-*` headers | YES |
| gatewayListCustomers | d.2B | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | idem d.2A + reconcile envelope to `{data,pagination,meta}` | YES |
| gatewayListPaymentPlans | d.2B | idem | idem | YES |
| gatewayListSubscriptions | d.2B | idem | idem (plus `plan_id, status` filter-hashed) | YES |
| gatewayListDisputes | d.2C | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | idem + declare `total_exact` in envelope | YES |
| gatewayListSettlements | d.2C | idem | idem | YES |
| gatewayListReconciliationRuns | d.2C | idem | idem | YES |
| gatewayListFundingIntents | d.2D | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | idem + `status` filter documented | YES |
| gatewayListCharges | d.2E | FULL_PAGINATION_CONTRACT_CORRECTION | idem + explicitly document `total` **absent** on high-volume list; keep filters `status/channel/currency/from/to` | YES |
| gatewayListRefunds | d.2E | idem | idem | YES |
| gatewayGetChargeEvents | d.2E | idem | idem; per-parent `chargeId` scope-hashed | YES |
| gatewayListCustomerTokens | d.2F | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | Add `default=25`, `maximum=100`; add envelope + `X-Pagination-*` headers; document previously-unbounded behaviour is deprecated | YES |
| gatewayListPayouts | d.2F | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION (DB branch only) | idem d.2E; note provider-branch continuation carries opaque provider token — provider adapter contract deferred to R1I-d.8 | YES (partial; d.8 completes) |

## 2. Invariants preserved by every contract change

- `operationId` unchanged.
- Public path unchanged.
- Method unchanged (GET).
- API version increment strategy: **minor** (`4.53.1 → 4.54.0`) per Standing Order 6, because the corrections add parameters, headers and schema properties (additive) and deprecate — but do not remove — legacy pagination params.
- Existing error responses (400/401/403/404/409/429/500) unchanged.
- Non-pagination request parameters unchanged.
- All 16 operations remain in the spec (operation count stays 483 through d.2 series).

## 3. Deferred contract items (not ratified for d.2)

- Backward pagination (`previous_cursor`) contract shape.
- `sort_by` enum expansion beyond `created_at`.
- Provider-branch continuation for `gatewayListPayouts` (R1I-d.8).
- Cursor rotation exposure in the contract (R1I-d.7).

No contract file has been edited by d.2S.

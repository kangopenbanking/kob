# Phase 1B — R1I-d.2S — Operation Groups

**Source of truth:** `phase-1b-r1i-d2p-scope.md`, `phase-1b-r1i-d2p-runtime-trace.md`, `phase-1b-r1i-d2p-database-performance.md`.

## 1. 16-operation inventory

| # | operationId | Method | Public path | Gateway resource | Current pagination | Main defect |
|---|-------------|--------|-------------|------------------|--------------------|-------------|
| 1 | gatewayListCharges | GET | /v1/gateway/charges | gateway_charges | offset+limit, `created_at DESC`, exact count | non-unique order, exact count on high-volume, no cursor honoured |
| 2 | gatewayListRefunds | GET | /v1/gateway/refunds | gateway_refunds | idem | idem |
| 3 | gatewayListPayouts | GET | /v1/gateway/payouts | gateway_payouts (+provider) | idem + provider branch | idem + provider token discarded |
| 4 | gatewayListDisputes | GET | /v1/gateway/disputes | gateway_disputes | idem | non-unique order |
| 5 | gatewayListSettlements | GET | /v1/gateway/settlements | gateway_settlements | idem | non-unique order |
| 6 | gatewayListSubscriptions | GET | /v1/gateway/subscriptions | gateway_subscriptions | idem | non-unique order |
| 7 | gatewayListCustomers | GET | /v1/gateway/customers | gateway_customers | idem | non-unique order |
| 8 | gatewayListCustomerTokens | GET | /v1/gateway/customers/{customerId}/tokens | gateway_customer_tokens | unbounded fetch | unbounded query (DoS class) |
| 9 | gatewayListPaymentLinks | GET | /v1/gateway/payment-links | gateway_payment_links | offset+limit | non-unique order |
| 10 | gatewayListPaymentPlans | GET | /v1/gateway/payment-plans | gateway_payment_plans | idem | non-unique order |
| 11 | gatewayListSubaccounts | GET | /v1/gateway/subaccounts | gateway_subaccounts | idem | non-unique order |
| 12 | gatewayListBeneficiaries | GET | /v1/gateway/beneficiaries | gateway_beneficiaries | idem | non-unique order |
| 13 | gatewayGetChargeEvents | GET | /v1/gateway/charges/{chargeId}/events | gateway_charge_events | idem | non-unique order, high-volume child |
| 14 | gatewayListReconciliationRuns | GET | /v1/gateway/reconciliation | gateway_reconciliation_runs | idem | non-unique order |
| 15 | gatewayListFundingIntents | GET | /v1/gateway/funding-intents | funding_intents | idem | non-unique order, status filter |
| 16 | gatewayListVirtualAccounts | GET | /v1/gateway/virtual-accounts | gateway_virtual_accounts | offset+limit | non-unique order |

Count = **16**. All operations converge on `supabase/functions/gateway-query/index.ts`.

## 2. Sub-slice assignment (non-overlapping)

| Sub-slice | Ops | Shared resource / query pattern | Pagination model | Contract work | Runtime work | Database work | Risk |
|-----------|-----|--------------------------------|------------------|---------------|--------------|---------------|------|
| **R1I-d.2A** | gatewayListSubaccounts, gatewayListBeneficiaries, gatewayListPaymentLinks, gatewayListVirtualAccounts | small merchant-scoped catalogues, low cardinality per merchant | Cursor (keyset), legacy `starting_after`/`ending_before` retained as alias | PARAMETER_CORRECTION + DESCRIPTION_ONLY (defaults, ordering, header contract) | adopt shared codec + keyset; keep legacy offset for one release | 4 composite indexes | LOW |
| **R1I-d.2B** | gatewayListCustomers, gatewayListPaymentPlans, gatewayListSubscriptions | merchant-scoped medium volume, additional filters (plan_id/status) | Cursor | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION (envelope reconciliation) | shared codec + keyset + filter-hash binding | 3 composite indexes | MEDIUM |
| **R1I-d.2C** | gatewayListDisputes, gatewayListSettlements, gatewayListReconciliationRuns | operational review lists, reconciliation-sensitive | Cursor with 300s lifetime (short) | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | shared codec + keyset; keep exact totals (medium volume, product-approved) | 3 composite indexes | MEDIUM |
| **R1I-d.2D** | gatewayListFundingIntents | funding_intents (separate schema, distinct RLS) | Cursor with `status` filter binding | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | shared codec + keyset + status-filter binding | 1 composite index `(merchant_id, status, created_at DESC, id DESC)` | MEDIUM |
| **R1I-d.2E** | gatewayListCharges, gatewayListRefunds, gatewayGetChargeEvents | **high-volume tables**; must drop exact count | Cursor + FULL_PAGINATION_CONTRACT_CORRECTION (drop `total`) | FULL_PAGINATION_CONTRACT_CORRECTION | shared codec + keyset + count deprecation | 3 composite indexes; count-policy change | HIGH |
| **R1I-d.2F** | gatewayListCustomerTokens, gatewayListPayouts | atypical: (a) currently unbounded, (b) provider branch | Cursor; provider adapter deferred to R1I-d.8 (payouts keeps provider branch untouched, only DB branch cursorised) | PARAMETER_CORRECTION + RESPONSE_SCHEMA_CORRECTION | shared codec + keyset for DB branch; unbounded fetch bounded | 2 composite indexes | HIGH |

## 3. Validation

- Total unique operations across d.2A–d.2F = **16** ✓
- Duplicate assignments = **0** ✓
- Unassigned operations = **0** ✓
- Each sub-slice is independently testable, reviewable, and has a distinct security/performance risk profile.
- Provider-token wrapping for `gatewayListPayouts` remains explicitly out of scope (deferred to R1I-d.8).

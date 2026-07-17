# Phase 1B — R1I-d.2P — Scope Extraction

**Source of truth:** `docs/audits/phase-1/phase-1b-r1i-d0-remediation-plan.md` § 1, row **R1I-d.2**.
**Slice title (d.0):** *Gateway high-volume list ordering fix.*
**Operation count:** 16.
**Shared handler:** all 16 route through `supabase/functions/gateway-query/index.ts` (dispatched via `supabase/functions/gateway/index.ts` + domain-specific `gateway-*-router` fronts).
**Shared response schema:** all 16 already reference `components.schemas.PaginatedResponse` (verified in d.0 contract inventory).
**Shared datasource:** Postgres tables in the `gateway_*` namespace (single database, no external provider except the `gatewayListPayouts` provider branch flagged for d.8).
**Internal ordering (d.0 plan):** none — d.0 lists the 16 operations without imposing a sub-order.

## 1. Exact operation set

| # | operationId | Method | Public path | Domain | Current mismatch codes (d.0 register) | Ratified pagination model |
|---|-------------|--------|-------------|--------|---------------------------------------|---------------------------|
| 1 | `gatewayListCharges` | GET | `/v1/gateway/charges` | Gateway · Charges | C1 (non-unique order), C4 (offset+cursor mix), C7 (headers absent), C9 (exact total on high-volume) | Cursor (§3 Standard Proposal); offset retained legacy |
| 2 | `gatewayListRefunds` | GET | `/v1/gateway/refunds` | Gateway · Refunds | C1, C4, C7, C9 | Cursor |
| 3 | `gatewayListPayouts` | GET | `/v1/gateway/payouts` | Gateway · Payouts | C1, C4, C7, C9, C11 (provider branch) | Cursor (KOB-wrapped) |
| 4 | `gatewayListDisputes` | GET | `/v1/gateway/disputes` | Gateway · Disputes | C1, C4, C7 | Cursor |
| 5 | `gatewayListSettlements` | GET | `/v1/gateway/settlements` | Gateway · Settlements | C1, C4, C7, C9 | Cursor |
| 6 | `gatewayListSubscriptions` | GET | `/v1/gateway/subscriptions` | Gateway · Subscriptions | C1, C4, C7 | Cursor |
| 7 | `gatewayListCustomers` | GET | `/v1/gateway/customers` | Gateway · Customers | C1, C4, C7 | Cursor |
| 8 | `gatewayListCustomerTokens` | GET | `/v1/gateway/customers/{customerId}/tokens` | Gateway · Customer Tokens | C1, C7 | Cursor |
| 9 | `gatewayListPaymentLinks` | GET | `/v1/gateway/payment-links` | Gateway · Payment Links | C1, C4, C7 | Cursor |
| 10 | `gatewayListPaymentPlans` | GET | `/v1/gateway/payment-plans` | Gateway · Payment Plans | C1, C4, C7 | Cursor |
| 11 | `gatewayListSubaccounts` | GET | `/v1/gateway/subaccounts` | Gateway · Subaccounts | C1, C4, C7 | Cursor |
| 12 | `gatewayListBeneficiaries` | GET | `/v1/gateway/beneficiaries` | Gateway · Beneficiaries | C1, C4, C7 | Cursor |
| 13 | `gatewayGetChargeEvents` | GET | `/v1/gateway/charges/{chargeId}/events` | Gateway · Charge Events | C1, C7 | Cursor |
| 14 | `gatewayListReconciliationRuns` | GET | `/v1/gateway/reconciliation` | Gateway · Reconciliation | C1, C4, C7 | Cursor |
| 15 | `gatewayListFundingIntents` | GET | `/v1/gateway/funding-intents` | Gateway · Funding | C1, C4, C7 | Cursor |
| 16 | `gatewayListVirtualAccounts` | GET | `/v1/gateway/virtual-accounts` | Gateway · Virtual Accounts | C1, C7 | Cursor |

## 2. Structural observations

- **Single handler surface:** every operation dispatches into `gateway-query/index.ts` (`listCharges`, `listRefunds`, …). A d.2 implementation slice touches one runtime file and, indirectly, the shared router `gateway-charges-router` etc. — no per-op handler explosion.
- **Two contract families:**
  - Family A (`LimitParam` + `CursorParam` + `PageParam`) — charges, refunds, payouts, virtual-accounts, customer-tokens, charge-events.
  - Family B (`limit` + `offset` + `StartingAfter` + `EndingBefore` + `sort_by` + `sort_order`) — disputes, settlements, subscriptions, customers, payment-links, payment-plans, subaccounts, beneficiaries, reconciliation, funding-intents.
  - Neither family declares `X-Pagination-*` response headers.
- **Provider branch:** `gatewayListPayouts` is the only operation whose runtime path can fan out to an external provider (Nium etc.). d.0 remediation plan defers the provider wrapper to **R1I-d.8**; d.2 must therefore preserve the current provider branch untouched.

## 3. No modification

`public/openapi.json`, `public/openapi.yaml`, `supabase/functions/gateway-query/index.ts`, `supabase/functions/_shared/pagination.ts`, migrations, SDKs, Postman: **unchanged**.

# Phase 1B — R1I-d.2P — Runtime Route Trace

Traced by static inspection of `supabase/functions/gateway*/index.ts`. No handler was executed or modified.

## 1. Convergence point

All 16 operations converge on `supabase/functions/gateway-query/index.ts`. Domain routers (`gateway-charges-router`, `gateway-payouts-router`, `gateway-disputes-router`, `gateway-settlement-router`, `gateway-webhooks-router`, `gateway-funding-router`, `gateway-merchant-router`, `gateway-withdrawal-router`) invoke the shared `list*` functions defined there.

Prefix normalisation: `/v1/gateway/*` is stripped by the shared `_shared/router.ts` before dispatch. No terminal-router fall-through observed for these paths.

## 2. Per-operation trace

| operationId | Router branch | Handler function (in `gateway-query/index.ts`) | Query source | Current limit / cursor behaviour | Current metadata returned |
|-------------|---------------|------------------------------------------------|--------------|-----------------------------------|---------------------------|
| gatewayListCharges | `gateway-charges-router → listCharges` | `listCharges` | `gateway_charges` | limit(default 50, max 100), offset, `.order('created_at', desc)` | `{data,total,limit,offset}` |
| gatewayListRefunds | `gateway/index.ts → listRefunds` | `listRefunds` | `gateway_refunds` (via merchant filter) | idem | idem |
| gatewayListPayouts | `gateway-payouts-router → listPayouts` | `listPayouts` | `gateway_payouts` (+ provider branch for Nium) | idem | idem |
| gatewayListDisputes | `gateway-disputes-router → listDisputes` | `listDisputes` | `gateway_disputes` | idem | idem |
| gatewayListSettlements | `gateway-settlement-router → listSettlements` | `listSettlements` | `gateway_settlements` | idem | idem |
| gatewayListSubscriptions | `gateway/index.ts → listSubscriptions` | `listSubscriptions` | `gateway_subscriptions` | limit(default 20, max 100), offset, `desc(created_at)` | idem |
| gatewayListCustomers | `gateway/index.ts → listCustomers` | `listCustomers` | `gateway_customers` | idem | idem |
| gatewayListCustomerTokens | `gateway/index.ts → listCustomerTokens` | `listCustomerTokens` | `gateway_customer_tokens` | **unbounded — no limit / offset applied** | `{data}` only |
| gatewayListPaymentLinks | `gateway/index.ts → listPaymentLinks` | `listPaymentLinks` | `gateway_payment_links` | limit(default 20, max 100), offset, `desc(created_at)` | `{data,total,limit,offset}` |
| gatewayListPaymentPlans | `gateway/index.ts → listPaymentPlans` | `listPaymentPlans` | `gateway_payment_plans` | idem | idem |
| gatewayListSubaccounts | `gateway/index.ts → listSubaccounts` | `listSubaccounts` | `gateway_subaccounts` | idem | idem |
| gatewayListBeneficiaries | `gateway/index.ts → listBeneficiaries` | `listBeneficiaries` | `gateway_beneficiaries` | idem | idem |
| gatewayGetChargeEvents | `gateway-charges-router → getChargeEvents` | `getChargeEvents` | `gateway_charge_events` | limit(default 50, max 100), offset, `desc(created_at)` | `{data,total,limit,offset}` |
| gatewayListReconciliationRuns | `gateway/index.ts → listReconciliation` | `listReconciliation` | `gateway_reconciliation_runs` | limit(default 25, max 100), offset, `desc(created_at)` | idem |
| gatewayListFundingIntents | `gateway-funding-router → listFundingIntents` | `listFundingIntents` | `funding_intents` | limit(default 50, max 100), offset, `desc(created_at)` | idem |
| gatewayListVirtualAccounts | `gateway/index.ts → listVirtualAccounts` | `listVirtualAccounts` | `gateway_virtual_accounts` | idem | idem |

## 3. Findings

- Every operation is wired — no unwired handler; d.0 §3 confirmation holds.
- No operation currently reads `starting_after` / `ending_before` / `cursor` at runtime, even where the spec declares them. Cursor parameters are contract-only sugar today.
- `sort_by` / `sort_order` are declared on 12 operations but the handler unconditionally orders by `created_at DESC` — the spec parameters are not honoured.
- `gatewayListCustomerTokens` returns an unbounded list — the contract's `LimitParam`/`CursorParam` are ignored, and the response omits `total/limit/offset`. This is a runtime/contract mismatch not caught by G4.
- `gatewayListPayouts` provider branch (Nium) currently discards its provider continuation token — flagged for **R1I-d.8**; d.2 must not touch it.
- Response envelope emitted at runtime (`{data,total,limit,offset}` or `{data}`) does **not** match the canonical `PaginatedResponse` shape referenced by the contract (which expects `{data, pagination, meta}`). This is a systemic runtime debt and would need explicit ratification of the envelope reconciliation before any implementation slice ships.

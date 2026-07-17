# Phase 1B — R1I-d.2P — Database & Performance Preflight

Static analysis only. No index, view, RPC or migration was created.

## 1. Query & provider profile

| operationId | Source | Scope predicate | Order tuple (current) | Existing bound | Index/provider support | Risk |
|-------------|--------|-----------------|-----------------------|----------------|------------------------|------|
| gatewayListCharges | `gateway_charges` | RLS `merchant_id ∈ actor.merchants` + optional `status/channel/currency/from/to` | `created_at DESC` (non-unique) | offset+limit ≤ 100 with `count:'exact'` | index likely present on `merchant_id` and `created_at`; **no composite `(merchant_id, created_at DESC, id DESC)`** verified | HIGH |
| gatewayListRefunds | `gateway_refunds` | RLS via merchant | `created_at DESC` | idem | same composite gap | HIGH |
| gatewayListPayouts | `gateway_payouts` (+ provider branch) | RLS + `merchant_id` | `created_at DESC` | idem | composite gap; provider paging opaque | HIGH |
| gatewayListDisputes | `gateway_disputes` | RLS | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListSettlements | `gateway_settlements` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListSubscriptions | `gateway_subscriptions` | RLS + `plan_id/status` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListCustomers | `gateway_customers` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListCustomerTokens | `gateway_customer_tokens` | `customer_id = :id AND is_active = true` | `created_at DESC` | **unbounded** | needs at minimum `(customer_id, created_at DESC, id DESC)` | HIGH |
| gatewayListPaymentLinks | `gateway_payment_links` | RLS + `merchant_id` (+ optional `slug`) | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListPaymentPlans | `gateway_payment_plans` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListSubaccounts | `gateway_subaccounts` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | LOW |
| gatewayListBeneficiaries | `gateway_beneficiaries` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | LOW |
| gatewayGetChargeEvents | `gateway_charge_events` | RLS + `charge_id` | `created_at DESC` | idem | composite gap on `(charge_id, created_at DESC, id DESC)` | MEDIUM |
| gatewayListReconciliationRuns | `gateway_reconciliation_runs` | RLS + `merchant_id` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListFundingIntents | `funding_intents` | RLS + `status` | `created_at DESC` | idem | composite gap | MEDIUM |
| gatewayListVirtualAccounts | `gateway_virtual_accounts` | RLS + `merchant_id/account_kind` | `created_at DESC` | idem | composite gap | LOW |

## 2. Systemic risks

- **Non-unique tie-breaker.** Every current query orders by `created_at DESC` only. Two rows sharing a `created_at` timestamp will produce duplicate or omitted results under paging — the exact class of defect d.2 is supposed to fix.
- **`count:'exact'` on high-volume tables.** `gateway_charges`, `gateway_refunds`, `gateway_payouts`, `gateway_charge_events`, `funding_intents` are high-volume. Continuing to compute exact totals per page is a documented DoS class in the d.0 security analysis and forbidden by Standard Proposal §6.
- **Unbounded query in `listCustomerTokens`.** The runtime ignores the declared `LimitParam` / `CursorParam` — a bounded query with keyset order + composite index is required.
- **Provider branch of `listPayouts`.** Cannot be safely wrapped without a provider-token opaque-carry design (deferred to R1I-d.8).

## 3. Required database objects

| operationId | Proposed object | Exact definition sketch | Why required | Runtime-only alternative |
|-------------|-----------------|-------------------------|--------------|--------------------------|
| gatewayListCharges | Composite index | `CREATE INDEX ... ON gateway_charges (merchant_id, created_at DESC, id DESC) WHERE ...` (partial by `status` may help) | keyset pagination + no seq-scan under merchant scope | None safe — sequential scan risk unacceptable on the largest gateway table |
| gatewayListRefunds | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | None safe |
| gatewayListPayouts | Composite index | `(merchant_id, created_at DESC, id DESC)` + provider-token store (d.8) | idem | None safe |
| gatewayListDisputes | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible short term; keep watchlist |
| gatewayListSettlements | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListSubscriptions | Composite index | `(merchant_id, plan_id, status, created_at DESC, id DESC)` (or minimal `(merchant_id, created_at DESC, id DESC)`) | idem | Feasible |
| gatewayListCustomers | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListCustomerTokens | Composite index | `(customer_id, created_at DESC, id DESC) WHERE is_active` | idem + removes unbounded fetch | None safe |
| gatewayListPaymentLinks | Composite index | `(merchant_id, created_at DESC, id DESC)` (unique `slug` already exists) | idem | Feasible |
| gatewayListPaymentPlans | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListSubaccounts | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListBeneficiaries | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayGetChargeEvents | Composite index | `(charge_id, created_at DESC, id DESC)` | idem | None safe (largest per-parent volume) |
| gatewayListReconciliationRuns | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListFundingIntents | Composite index | `(merchant_id, status, created_at DESC, id DESC)` | idem | Feasible |
| gatewayListVirtualAccounts | Composite index | `(merchant_id, created_at DESC, id DESC)` | idem | Feasible |

No RPC, view, materialised view, trigger, or partitioning is proposed at this preflight stage — a keyset query on top of the composite indexes above is expected to be sufficient.

## 4. Performance forecast

| operationId | Rows fetched max (post-fix) | Scan risk (current) | Count cost (current) | N+1 risk | Class |
|-------------|-----------------------------|---------------------|----------------------|----------|-------|
| gatewayListCharges | 101 (limit+1) | HIGH | HIGH (exact count over merchant-scoped charges) | none | HIGH |
| gatewayListRefunds | 101 | HIGH | HIGH | none | HIGH |
| gatewayListPayouts | 101 | HIGH | HIGH | provider branch adds 1 external call | HIGH |
| gatewayListDisputes | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListSettlements | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListSubscriptions | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListCustomers | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListCustomerTokens | 101 | HIGH (currently unbounded) | none (no count today) | none | HIGH |
| gatewayListPaymentLinks | 101 | LOW | LOW | none | LOW |
| gatewayListPaymentPlans | 101 | LOW | LOW | none | LOW |
| gatewayListSubaccounts | 101 | LOW | LOW | none | LOW |
| gatewayListBeneficiaries | 101 | LOW | LOW | none | LOW |
| gatewayGetChargeEvents | 101 | HIGH | HIGH | none | HIGH |
| gatewayListReconciliationRuns | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListFundingIntents | 101 | MEDIUM | MEDIUM | none | MEDIUM |
| gatewayListVirtualAccounts | 101 | LOW | LOW | none | LOW |

## 5. Database Owner gate

Because 16 composite indexes (and the deprecation of `count:'exact'` on high-volume tables) are required, and no such objects exist today:

**Blocking gate:** `PHASE 1B-R1I-d.2 BLOCKED — DATABASE OWNER PAGINATION AUTHORIZATION REQUIRED`.

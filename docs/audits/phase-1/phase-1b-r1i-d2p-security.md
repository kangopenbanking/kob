# Phase 1B — R1I-d.2P — Security Preflight

## 1. Scope & filter binding (proposed cursor payload inputs)

| operationId | Scope-hash inputs | Filter-hash inputs | Raw IDs in cursor payload |
|-------------|-------------------|--------------------|---------------------------|
| gatewayListCharges | `env`, `merchant_id` (authoritative — never client-supplied), `actor.sub` | `status, channel, currency, from, to, sort_by, sort_order` | 0 (position tuple = `[created_at, id]`; `id` opaque UUID) |
| gatewayListRefunds | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListPayouts | env, merchant_id, actor.sub | `status, sort_by, sort_order` (+ provider continuation opaque payload — d.8) | 0 |
| gatewayListDisputes | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListSettlements | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListSubscriptions | env, merchant_id, actor.sub | `plan_id, status, sort_by, sort_order` | 0 |
| gatewayListCustomers | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListCustomerTokens | env, merchant_id, `customer_id`, actor.sub | (none) | 0 |
| gatewayListPaymentLinks | env, merchant_id, actor.sub | `slug, sort_by, sort_order` | 0 |
| gatewayListPaymentPlans | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListSubaccounts | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListBeneficiaries | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayGetChargeEvents | env, merchant_id, `charge_id`, actor.sub | (none) | 0 |
| gatewayListReconciliationRuns | env, merchant_id, actor.sub | `sort_by, sort_order` | 0 |
| gatewayListFundingIntents | env, merchant_id, actor.sub | `status, sort_by, sort_order` | 0 |
| gatewayListVirtualAccounts | env, merchant_id, actor.sub | `account_kind, sort_by, sort_order` | 0 |

**Invariant met:** raw tenant, owner, actor or provider identifiers exposed in cursor payload = **0**. Merchant/actor/customer/charge identifiers are hashed into `sh`; the position tuple carries only `created_at` + row UUID.

## 2. Isolation matrix

| operationId | Tenant-safe | Owner-safe | Cursor cross-scope safe (post-implementation) | Count-safe (post-implementation) | Provider-safe | Overall risk |
|-------------|-------------|------------|-----------------------------------------------|-----------------------------------|---------------|--------------|
| gatewayListCharges | RLS + merchant filter (yes) | yes | yes (`sh` mismatch → `SCOPE_MISMATCH`) | after §6 total-drop | n/a | LOW post-fix / HIGH today (count DoS) |
| gatewayListRefunds | yes | yes | yes | after §6 | n/a | LOW / HIGH |
| gatewayListPayouts | yes | yes | yes | after §6 | needs opaque provider token (d.8) | LOW / HIGH |
| gatewayListDisputes | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListSettlements | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListSubscriptions | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListCustomers | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListCustomerTokens | yes (`customer_id` bound to merchant) | yes | yes | n/a (no count today) | n/a | LOW / MEDIUM (unbounded today) |
| gatewayListPaymentLinks | yes | yes | yes | after §6 | n/a | LOW |
| gatewayListPaymentPlans | yes | yes | yes | after §6 | n/a | LOW |
| gatewayListSubaccounts | yes | yes | yes | after §6 | n/a | LOW |
| gatewayListBeneficiaries | yes | yes | yes | after §6 | n/a | LOW |
| gatewayGetChargeEvents | yes (`charge_id → merchant` join enforced) | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListReconciliationRuns | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListFundingIntents | yes | yes | yes | after §6 | n/a | LOW / MEDIUM |
| gatewayListVirtualAccounts | yes | yes | yes | after §6 | n/a | LOW |

## 3. Findings

- No new cross-tenant risk introduced by the proposed cursor design — every merchant/actor identifier is hashed into `sh` (per the d.1F ratified codec).
- Cross-scope cursor reuse is blocked by `SCOPE_MISMATCH`; cross-operation reuse is blocked by `OPERATION_MISMATCH`.
- Enumeration risk on `gateway_customer_tokens` remains until the unbounded query is bounded — currently HIGH.
- Provider-token leakage risk for `gatewayListPayouts` cannot be resolved inside d.2; provider adapter deferred to R1I-d.8.

## 4. Gate impact

No security decision remains open for d.2 **as long as** §§5–6 of the Standard Proposal are ratified (cursor scope binding + count semantics). Both are currently `PROPOSED_NOT_RATIFIED` — see decision-integrity report. This slice therefore does not add a distinct security-block; it inherits the product/contract block.

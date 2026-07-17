# Phase 1B — R1I-d.2S — Database Owner Decisions

No index, view, RPC, function or migration is created by this slice. This report captures the Database Owner's approvals for the composite indexes required by each sub-slice.

## 1. Per-operation classification

| operationId | Query order/filter | Existing support | Required database object | Owner decision |
|-------------|--------------------|------------------|--------------------------|----------------|
| gatewayListSubaccounts | `merchant_id = ? ORDER BY created_at DESC, id DESC LIMIT n` | single-column `merchant_id` + `created_at` | NEW_COMPOSITE_INDEX_REQUIRED `(merchant_id, created_at DESC, id DESC)` | APPROVED |
| gatewayListBeneficiaries | idem | idem | idem | APPROVED |
| gatewayListPaymentLinks | idem (+ optional `slug`) | idem (unique `slug` exists) | idem | APPROVED |
| gatewayListVirtualAccounts | idem (+ `account_kind`) | idem | NEW_COMPOSITE_INDEX_REQUIRED `(merchant_id, created_at DESC, id DESC)` | APPROVED |
| gatewayListCustomers | `merchant_id = ? ORDER BY created_at DESC, id DESC` | idem | idem | APPROVED |
| gatewayListPaymentPlans | idem | idem | idem | APPROVED |
| gatewayListSubscriptions | `merchant_id = ? [+ plan_id/status]` | idem | idem (minimal) — Owner defers a partial `(merchant_id, plan_id, status, created_at DESC, id DESC)` to a follow-up perf slice if telemetry warrants it | APPROVED (minimal) |
| gatewayListDisputes | `merchant_id = ? ORDER BY created_at DESC, id DESC` | idem | idem | APPROVED |
| gatewayListSettlements | idem | idem | idem | APPROVED |
| gatewayListReconciliationRuns | idem | idem | idem | APPROVED |
| gatewayListFundingIntents | `merchant_id = ? AND status = ? ORDER BY created_at DESC, id DESC` | idem | NEW_COMPOSITE_INDEX_REQUIRED `(merchant_id, status, created_at DESC, id DESC)` | APPROVED |
| gatewayListCharges | `merchant_id = ? [+ status/channel/currency/from/to] ORDER BY created_at DESC, id DESC` | single-column indexes | NEW_COMPOSITE_INDEX_REQUIRED `(merchant_id, created_at DESC, id DESC)`; count-policy: **drop exact count** on this table | APPROVED |
| gatewayListRefunds | idem | idem | idem | APPROVED |
| gatewayGetChargeEvents | `charge_id = ? ORDER BY created_at DESC, id DESC` | single-column `charge_id` | NEW_COMPOSITE_INDEX_REQUIRED `(charge_id, created_at DESC, id DESC)`; count-policy: drop exact count | APPROVED |
| gatewayListCustomerTokens | `customer_id = ? AND is_active ORDER BY created_at DESC, id DESC` | single-column `customer_id` | NEW_COMPOSITE_INDEX_REQUIRED `(customer_id, created_at DESC, id DESC) WHERE is_active` (partial) | APPROVED |
| gatewayListPayouts | `merchant_id = ? [+ status] ORDER BY created_at DESC, id DESC` (DB branch only) | single-column indexes | NEW_COMPOSITE_INDEX_REQUIRED `(merchant_id, created_at DESC, id DESC)`; count-policy: drop exact count | APPROVED |

## 2. Object summary

Total new composite indexes across d.2A–d.2F: **16** (one per operation, plus the funding-intents index carries an additional `status` column). No view, RPC, function or trigger is required.

Count-policy change on high-volume tables (`gateway_charges`, `gateway_refunds`, `gateway_charge_events`, `gateway_payouts`): **APPROVED** — Postgres `count:'exact'` is removed from these queries; envelope drops `total`.

Partial predicate on `gateway_customer_tokens` `(WHERE is_active)`: **APPROVED** — matches the always-filtered runtime query.

## 3. Justification

- Keyset pagination requires a composite index whose column order matches the `(scope, order_column, tie_breaker)` tuple exactly to avoid a sequential scan and to keep index-only scans possible.
- `id DESC` is the mandatory unique tie-breaker (d.1F #6). It is a UUID PK on every gateway_* table.
- Partial index on `gateway_customer_tokens` narrows the on-disk footprint and preserves index-only scans.
- Composite `(merchant_id, status, created_at DESC, id DESC)` on `funding_intents` matches the sole authoritative filter path.

## 4. Not authorised in d.2S

Owner explicitly does **not** authorise in this slice:
- Migration SQL creation.
- Deployment of any of the 16 indexes.
- Drop of any existing index.
- Any schema change beyond index creation (no view, no RPC, no function, no trigger).
- Partitioning or table rewriting on any gateway_* table.

Owner authorises each index for creation only inside its designated sub-slice (d.2A–d.2F).

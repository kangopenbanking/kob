# Phase 1B — R1I-d.2S — Pagination Decisions

Ratified per-operation values. All values here are `RATIFIED_BY_D2S` unless otherwise labelled. Every value is bounded by the d.1F foundation invariants (safety ceiling 500; cursor lifetime 60–86 400 s).

## 1. Per-operation ratified matrix

| operationId | Model | defaultLimit | maxLimit | Cursor lifetime (s) | Order tuple | Public metadata |
|-------------|-------|--------------|----------|---------------------|-------------|-----------------|
| gatewayListSubaccounts | Cursor (+legacy offset) | 25 | 100 | 3600 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode` |
| gatewayListBeneficiaries | Cursor (+legacy offset) | 25 | 100 | 3600 | `(created_at DESC, id DESC)` | idem |
| gatewayListPaymentLinks | Cursor (+legacy offset) | 25 | 100 | 3600 | `(created_at DESC, id DESC)` | idem |
| gatewayListVirtualAccounts | Cursor | 25 | 100 | 3600 | `(created_at DESC, id DESC)` | idem |
| gatewayListCustomers | Cursor (+legacy offset) | 25 | 100 | 1800 | `(created_at DESC, id DESC)` | idem |
| gatewayListPaymentPlans | Cursor (+legacy offset) | 25 | 100 | 1800 | `(created_at DESC, id DESC)` | idem |
| gatewayListSubscriptions | Cursor (+legacy offset) | 25 | 100 | 1800 | `(created_at DESC, id DESC)` | idem |
| gatewayListDisputes | Cursor | 25 | 100 | 300 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode, total_exact` (medium volume) |
| gatewayListSettlements | Cursor | 25 | 100 | 300 | `(created_at DESC, id DESC)` | idem |
| gatewayListReconciliationRuns | Cursor | 25 | 100 | 300 | `(created_at DESC, id DESC)` | idem |
| gatewayListFundingIntents | Cursor | 25 | 100 | 900 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode` |
| gatewayListCharges | Cursor | 25 | 100 | 900 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode` (**no `total`** — high volume) |
| gatewayListRefunds | Cursor | 25 | 100 | 900 | `(created_at DESC, id DESC)` | idem |
| gatewayGetChargeEvents | Cursor | 50 | 200 | 900 | `(created_at DESC, id DESC)` | idem |
| gatewayListCustomerTokens | Cursor | 25 | 100 | 3600 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode` |
| gatewayListPayouts | Cursor (DB branch); provider branch untouched | 25 | 100 | 900 | `(created_at DESC, id DESC)` | `data, has_more, next_cursor, mode` (**no `total`** — high volume) |

## 2. Classification per decision (universal across the 16 ops unless noted)

| Decision | Value | Classification |
|----------|-------|----------------|
| Cursor codec (kobp1 + HMAC-SHA-256) | ratified in d.1F | EXISTING_RATIFIED |
| Absolute safety ceiling (500) | 500 | EXISTING_RATIFIED |
| Cursor lifetime bounds (60–86 400 s) | ratified in d.1F | EXISTING_RATIFIED |
| defaultLimit / maxLimit per op | per table above | RATIFIED_BY_D2S |
| Cursor lifetime per op | per table above | RATIFIED_BY_D2S |
| Order tuple per op | `(created_at DESC, id DESC)` (NULLS handling: `created_at NOT NULL` on every gateway_* table; NULLS never observed) | RATIFIED_BY_D2S |
| Response envelope reconciliation to `{data, pagination, meta}` | mandatory | RATIFIED_BY_D2S |
| `X-Pagination-Mode/Has-More/Next-Cursor/Limit` response headers | mandatory | RATIFIED_BY_D2S |
| `total` exact count on high-volume tables (`gateway_charges`, `gateway_refunds`, `gateway_charge_events`, `gateway_payouts`) | forbidden | RATIFIED_BY_D2S |
| `total` exact count on medium-volume tables (disputes, settlements, reconciliation) | permitted | RATIFIED_BY_D2S |
| Backward pagination (`previous_cursor`) | not offered in d.2 | DEFERRED_TO_SUB_SLICE (post-d.2) |
| `sort_by` / `sort_order` enum contents | fixed to `created_at` only in d.2; expansion is post-d.2 | RATIFIED_BY_D2S |
| Legacy `page` / `offset` / `starting_after` | accepted as aliases for one release (translated server-side to cursor payload) then deprecated | RATIFIED_BY_D2S |
| Cursor rotation policy | deferred to R1I-d.7 | DEFERRED_TO_SUB_SLICE |
| Provider-token wrapping (payouts) | deferred to R1I-d.8 | DEFERRED_TO_SUB_SLICE |
| Invalid-input behaviour | canonical Problem Details 400 (`PAGINATION_LIMIT_INVALID`, `PAGINATION_CURSOR_INVALID`, `PAGINATION_CURSOR_EXPIRED`, `PAGINATION_CURSOR_OPERATION_MISMATCH`, `PAGINATION_CURSOR_SCOPE_MISMATCH`, `PAGINATION_CURSOR_FILTER_MISMATCH`) | EXISTING_RATIFIED (envelope) + RATIFIED_BY_D2S (codes) |

No material pagination value is `UNKNOWN`.

## 3. Ordering decision (deterministic keyset)

| operationId | Primary order | Direction | Nullable | Null order | Unique final tie-breaker |
|-------------|---------------|-----------|----------|------------|--------------------------|
| every op above | `created_at` | DESC | NOT NULL (verified in schema) | N/A | `id` (UUID, PK) DESC |

Timestamp-only ordering is prohibited by d.1F #6; the `id DESC` tie-breaker satisfies uniqueness. Mutable ordering fields: none in d.2 (`created_at` is immutable at insert; `id` is a PK).

## 4. Scope & filter binding

| operationId | scopeHash inputs | filtersHash inputs |
|-------------|------------------|--------------------|
| gatewayListCharges | env, merchant_id, actor.sub | status, channel, currency, from, to, sort_by, sort_order |
| gatewayListRefunds | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListPayouts | env, merchant_id, actor.sub | status, sort_by, sort_order |
| gatewayListDisputes | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListSettlements | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListSubscriptions | env, merchant_id, actor.sub | plan_id, status, sort_by, sort_order |
| gatewayListCustomers | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListCustomerTokens | env, merchant_id, customer_id, actor.sub | (none) |
| gatewayListPaymentLinks | env, merchant_id, actor.sub | slug, sort_by, sort_order |
| gatewayListPaymentPlans | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListSubaccounts | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListBeneficiaries | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayGetChargeEvents | env, merchant_id, charge_id, actor.sub | (none) |
| gatewayListReconciliationRuns | env, merchant_id, actor.sub | sort_by, sort_order |
| gatewayListFundingIntents | env, merchant_id, actor.sub | status, sort_by, sort_order |
| gatewayListVirtualAccounts | env, merchant_id, actor.sub | account_kind, sort_by, sort_order |

Cross-operation, cross-tenant, cross-owner, changed-filter cursor reuse: **rejected** by the ratified codec (see d.1F failure taxonomy).

## 5. Response metadata classification

| Field | Sub-slices A/B/D/F | Sub-slice C (medium volume) | Sub-slice E (high volume) |
|-------|--------------------|------------------------------|----------------------------|
| items | EXACT | EXACT | EXACT |
| hasMore | EXACT | EXACT | EXACT |
| nextCursor | EXACT | EXACT | EXACT |
| total | NOT_RETURNED | EXACT | NOT_RETURNED |
| page-local count | PAGE_LOCAL | PAGE_LOCAL | PAGE_LOCAL |
| provider count | NOT_APPLICABLE (d.2F payouts DB branch only) | NOT_APPLICABLE | NOT_APPLICABLE |

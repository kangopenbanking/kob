# Phase 1B — R1I-d.0 — Database Query & Ordering Analysis

**Purpose:** Assess ordering determinism, tenant/owner predicates, index support and DoS risk for every DB-backed collection. This report is inspection-only; **no** index or migration is authored.

## 1. Ordering-stability classification

| Class | Definition |
|-------|-----------|
| STABLE | Ordering uses `(non-unique, unique-tie-breaker)` — e.g. `(created_at DESC, id DESC)`. Duplicates impossible. |
| PARTIALLY_STABLE | Order key is *usually* unique (e.g. `posted_at` on a low-frequency ledger) but not guaranteed. |
| UNSTABLE | Order by a mutable or non-unique column with no tie-breaker (e.g. `created_at DESC` on a burst-write table). |
| NOT_APPLICABLE | Bounded static list, natural key ordering (e.g. `banks` by ISO code). |

## 2. Per-table analysis (headline rows)

| Operation | Table | Scope predicate | Ordering | Tie-breaker | Index support | Ordering class | Risk |
|-----------|-------|-----------------|----------|-------------|---------------|----------------|------|
| aispTransactions | bank_sourced_transactions / transactions | `institution_id`, `consent_id`, `account_id` | booking_date DESC | `id` DESC (in reference handler) | PK on `id`, index on `(account_id, booking_date)` (verify) | STABLE | Medium |
| aispAccounts | bank_sourced_accounts | consent_id | `created_at DESC` | `id` DESC | needs `(consent_id, created_at, id)` composite | STABLE | Low |
| consentsList | aisp_consents/pisp_consents | user_id / tpp_registration_id | `created_at DESC` | `id` DESC | PK on `id` | STABLE | Low |
| gatewayListCharges | gateway_charges | `merchant_id` | `created_at DESC` | **missing** | PK on `id`; needs `(merchant_id, created_at, id)` composite | UNSTABLE | HIGH |
| gatewayListRefunds | gateway_refunds | `merchant_id` | `created_at DESC` | **missing** | same shape | UNSTABLE | HIGH |
| gatewayListPayouts | gateway_payouts | `merchant_id` | `created_at DESC` | **missing** | same shape | UNSTABLE | HIGH |
| gatewayListDisputes | gateway_disputes | `merchant_id` | `created_at DESC` | **missing** | verify composite index | UNSTABLE | Medium |
| gatewayListSettlements | gateway_settlements | `merchant_id` | `settled_at DESC` | **missing** | verify | UNSTABLE | Medium |
| gatewayListSubscriptions | gateway_subscriptions | `merchant_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| gatewayListCustomers | gateway_customers | `merchant_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| gatewayListPaymentLinks | gateway_payment_links | `merchant_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| gatewayListFundingIntents | funding_intents | `merchant_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| gatewayReportTransactions | multiple (aggregate) | tenant | window-based | n/a | needs range indexes | PARTIALLY_STABLE | HIGH (aggregation) |
| webhookDeliveries | webhook_deliveries | `webhook_id` / `merchant_id` | `created_at DESC` | **missing** | very high cardinality | UNSTABLE | HIGH |
| webhookV2Deliveries | gateway_webhook_deliveries_v2 | `endpoint_id` | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| listWebhookDlq | webhook_inbox_dlq | admin | `created_at DESC` | **missing** | | UNSTABLE | Medium (admin) |
| adminTransactionReview | transactions | cross-tenant admin | `created_at DESC` | **missing** | very large | UNSTABLE | CRITICAL |
| adminListLoans | loan_applications / loan_accounts | admin | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| adminListSavings | savings_accounts | admin | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| adminListConsents | aisp_consents ∪ pisp_consents | admin | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| journalList | journal_entries | `ledger_account_id` | `posted_at DESC` | **missing** | append-only, high volume | UNSTABLE | HIGH |
| ledgerAccounts | ledger_accounts | `institution_id` | `code ASC` | code is unique | PK on code | STABLE | Low |
| walletStatement | transactions | `wallet_id` | `posted_at DESC` | **missing** | | UNSTABLE | Medium |
| virtualCardTransactions | virtual_card_audit_log / card_transactions | `card_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| loanSchedule | loan_repayment_schedules | `loan_id` | `due_date ASC, instalment_no ASC` | instalment_no unique | PK | STABLE | Low |
| savingsProducts | savings_products | `institution_id` | `code ASC` | unique | | STABLE | Low |
| loanProducts | loan_products | `institution_id` | `code ASC` | unique | | STABLE | Low |
| banksList | banks | none (public directory) | `code ASC` | unique | | STABLE | Low (bounded) |
| cemacCorridorsList | cemac_remittance_corridors | none | `code ASC` | unique | | STABLE / bounded | Low |
| interbankPaymentsList | interbank_payments | `participant_id` | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| interbankMessagesList | interbank_messages | `participant_id` | `created_at DESC` | **missing** | very high cardinality | UNSTABLE | HIGH |
| sarList | suspicious_activity_reports | admin/officer | `created_at DESC` | **missing** | | UNSTABLE | HIGH |
| safeguardingSnapshots | safeguarding_ledger | admin | `snapshot_at DESC` | id | PARTIALLY_STABLE | Medium |
| agentTransactionList | agent_cash_transactions | `agent_id` | `created_at DESC` | **missing** | | UNSTABLE | Medium |
| agentList | agents | admin | `created_at DESC` | **missing** | | UNSTABLE | Low (bounded) |
| slaMetrics | sla_metrics | admin | `measured_at DESC` | **missing** | | UNSTABLE | Medium |
| slaIncidentList | sla_incidents | admin | `opened_at DESC` | id | STABLE-ish | Low |
| reconciliationMismatches | reconciliation_mismatches / gateway_reconciliation_mismatches | `run_id` | `id ASC` | id unique | PK | STABLE | Medium |

## 3. Systemic ordering finding

**≈45 of the 77 collection operations order by a non-unique timestamp column with no unique tie-breaker.** Under concurrent inserts these queries can:
- return the same row on consecutive pages (duplicate), or
- skip a row that gained the same timestamp as the last cursor row (omission).

This is the largest single **runtime** debt uncovered.

## 4. Index inventory (evidence expectations, no DDL authored)

The following composite indexes are expected to exist to make future keyset cursors performant. R1I-d.1 will confirm their presence via `pg_indexes` inspection and, only under a separate migration slice, propose additions:

- `gateway_charges (merchant_id, created_at DESC, id DESC)`
- `gateway_refunds (merchant_id, created_at DESC, id DESC)`
- `gateway_payouts (merchant_id, created_at DESC, id DESC)`
- `gateway_disputes (merchant_id, created_at DESC, id DESC)`
- `gateway_settlements (merchant_id, settled_at DESC, id DESC)`
- `webhook_deliveries (webhook_id, created_at DESC, id DESC)`
- `gateway_webhook_deliveries_v2 (endpoint_id, created_at DESC, id DESC)`
- `journal_entries (ledger_account_id, posted_at DESC, id DESC)`
- `interbank_payments (participant_id, created_at DESC, id DESC)`
- `interbank_messages (participant_id, created_at DESC, id DESC)`
- `agent_cash_transactions (agent_id, created_at DESC, id DESC)`
- `transactions (wallet_id, posted_at DESC, id DESC)`
- `bank_sourced_transactions (account_id, booking_date DESC, id DESC)`

## 5. Query safety flags

- **Total-count queries** on `gateway_charges`, `transactions`, `webhook_deliveries`, `journal_entries` (if performed with `count:'exact'`) will scan the entire index → **CRITICAL DoS risk** on multi-tenant tables. Standard proposal recommends `count:'estimated'` or omission of `meta.total`.
- **Cross-tenant admin listings** (`adminTransactionReview`, `adminListLoans`, `adminListSavings`) do not have a scope filter; each request scans the whole table. `HIGH` risk today; masked because admin volume is low.
- **In-memory slicing** on report endpoints must be replaced with SQL-side windowing or explicit export streaming — an R1I-d slice will decide.

## 6. Read-only status

`pg_indexes` and `information_schema` were not queried (would require live `supabase--read_query`, which mutates neither DB nor spec, but is deferred to R1I-d.1's evidence pass to keep this slice strictly inspection-of-code).

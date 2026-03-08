# Changelog

## [3.5.0] - 2026-03-08 — Go-Live Security Audit: 29 Fixes Across Critical/High/Medium/Low

### Critical Fixes (C1-C7)
- **Atomic Transfer Engine (C1/C2)**: Replaced non-atomic balance updates in `api-transfers` and `bulk-transfers` with `execute_atomic_transfer` PL/pgSQL function using `SELECT ... FOR UPDATE` row locks to prevent double-spend race conditions.
- **Stripe Refund Currency Bug (C3/C4)**: Added `currency` field to `RefundRequest` interface and replaced hardcoded `* 100` with `toStripeAmount()` in `createStripeRefund`, preventing 100x over-refunds for zero-decimal currencies (XAF).
- **Flutterwave Double Wallet Credit (C5)**: Added `!charge.metadata?.fund_account` guard to `gateway-webhook-flutterwave` to prevent merchant wallet credit on fund_account charges.
- **Mandatory Webhook Signatures (C6/C7)**: Made Stripe and Flutterwave webhook signature verification mandatory — requests with missing secrets or signatures are now rejected with 401/500.

### High Priority Fixes (H1-H9)
- **Transfer Idempotency (H1)**: Added `check_transfer_idempotency` RPC and idempotency-key support to `api-transfers`.
- **PayPal Balance Type Fix (H2)**: Payout failure reversal now checks `ClosingAvailable` first, then `InterimAvailable`, with fallback insert.
- **CORS Standardization (H3-H5)**: Replaced local `corsHeaders` in `gateway-webhook-flutterwave`, `gateway-create-payout`, and `gateway-preauth-charge` with shared `_shared/cors.ts`.
- **mTLS Certificate Parsing (H7)**: Replaced placeholder `extractCertificateDetails()` with real ASN.1 DER parsing for serial numbers and validity dates.
- **Token Hashing (H8)**: OAuth access tokens and refresh tokens are now SHA-256 hashed before storage in `access_tokens` and `refresh_tokens` tables.
- **Rate Limiter Fail-Closed (H9)**: `checkRateLimit` in `_shared/security.ts` now returns `false` on DB errors instead of `true`.

### Medium Priority Fixes (M1-M8)
- **Ledger Entry Fix (M1)**: Internal transfers now correctly debit/credit deposit sub-accounts instead of Cash→Deposits.
- **CSV Parser Quoting (M2)**: Bulk transfer CSV parser now properly handles quoted fields containing commas.
- **Multi-Currency PISP (M3)**: `pisp-domestic-payment` now supports XAF, EUR, and USD.
- **PayPal Sandbox Toggle (M4)**: All PayPal API calls use `PAYPAL_ENVIRONMENT` env var to switch between sandbox and production.
- **Transaction Fee RPC (M7)**: Created `record_transaction_fee` PL/pgSQL function matching the RPC signature expected by `api-transfers`.
- **Refund Audit Trail (M8)**: Added audit log entry to `gateway-create-refund`.
- **Refund Currency Passthrough**: `gateway-create-refund` now passes `charge.currency` to `createStripeRefund`.

### Low Priority Fixes (L1-L5)
- **Version Pinning (L1)**: Standardized `@supabase/supabase-js@2` imports across `api-transfers`, `bulk-transfers`, and `stripe-confirm-payment`.
- **Sensitive Data Logging (L4)**: Removed raw Flutterwave response body logging, replaced with status-only logging.
- **Cache-Control Headers (L5)**: Added `Cache-Control: no-store` and `Pragma: no-cache` to all OAuth token responses.

### Database Migrations
- `execute_atomic_transfer` — Row-locked atomic balance transfer function
- `check_transfer_idempotency` — Transfer idempotency lookup
- `record_transaction_fee` — RPC for fee recording from transfer engine



## [3.4.0] - 2026-03-04 — End-to-End Audit, Bug Fixes & Full Documentation

### Fixed
- **Flutterwave Webhook Auto-Credit Bug**: `gateway-webhook-flutterwave` now upserts `ClosingAvailable` balance (was inserting orphan `InterimAvailable` rows). Customer App users now see funds immediately.
- **Flutterwave Webhook institution_id**: Dynamically reads `institution_id` from the account record instead of hardcoding `00000000-...`.
- **Withdrawal Balance Query**: `gateway-process-withdrawal` now filters by `credit_debit_indicator = 'Credit'`, preventing incorrect balance reads from debit rows.
- **Frontend Fee Mismatch**: `CustomerFundWallet.tsx` now fetches real-time fee estimates from `gateway-fee-estimate` instead of hardcoded percentages.
- **Payout Reversal Fix**: Failed withdrawal reversals in Flutterwave webhook now upsert `ClosingAvailable` instead of inserting `InterimAvailable`.

### Changed
- **OpenAPI Spec v3.4.0**: Added ~30 missing endpoint paths covering Phases 4-7 (Wallets, Escrow, Compliance, SAR, Safeguarding, Instant Payouts, SLA, Webhooks v2, Sandbox Sim).
- **API Version**: Bumped from `2.9.0` to `3.4.0`.

## [3.3.0] - 2026-03-04 — Phase 7: RFC 7807 Retrofit, Sandbox Sim, SLA Monitor, Webhooks v2

### Added
- **RFC 7807 Legacy Retrofit**: Retrofitted 5 legacy edge functions (`gateway-report-fees`, `gateway-report-settlements`, `gateway-report-transactions`, `gateway-merchant-keys`, `api-key-expiration-notifier`) to return `application/problem+json` error responses.
- **Payout Sandbox Simulation**: `gateway-sandbox-payout-sim` with 7 pre-seeded scenarios (instant_success, delayed_success, insufficient_funds, network_timeout, compliance_hold, reversed_after_success, partial_failure) with automated timeline generation and webhook callbacks.
- **SLA Monitoring API**: `gateway-sla-monitor` providing programmatic uptime percentages, latency percentiles (p50/p95/p99), and incident CRUD.
- **Webhook Delivery v2**: `gateway-webhook-endpoints` and `gateway-webhook-deliver-v2` — multi-endpoint per merchant, per-endpoint HMAC-SHA256 signing secrets, event filtering, 7-retry exponential backoff.

### Database
- `gateway_webhook_endpoints`, `gateway_webhook_deliveries_v2`, `sla_metrics`, `sla_incidents`, `sandbox_payout_scenarios` tables with RLS.

## [3.2.0] - 2026-03-03 — Phase 6: Wallet API, Compliance Screening, Instant Payouts

### Added
- **Custodial Wallet API** (`gateway-wallets`): `/v1/wallets/*` — create, credit, debit, freeze, statement with three-state balance model (Available, Pending, Ledger) and Idempotency-Key enforcement.
- **Compliance Screening** (`gateway-compliance-screen`): Inline pre-payout AML/sanctions/PEP/velocity checks returning approve/review/deny decisions.
- **Instant Payouts** (`gateway-instant-payout`): Multi-rail routing (MoMo instant, bank express, Visa Direct).
- **Push-to-Card** (`gateway-push-to-card`): Visa Direct card push disbursements.
- **Payout Rails** (`gateway-payout-rails`): List available payout rails by country/currency.
- **Cancel Payout** (`gateway-cancel-payout`): Cancel pending payouts before provider submission.
- **Treasury Float** (`gateway-treasury`): Float balance monitoring and replenishment triggers.
- **RFC 7807 Error Standard**: All new Phase 6 functions use `application/problem+json`.

## [3.1.0] - 2026-03-02 — Phase 5: Merchant Lifecycle, KYB Review, Settlement Accounts, Reconciliation

### Added
- **Merchant Lifecycle** (`gateway-merchant-lifecycle`): Full DRAFT → SUBMITTED → ACTIVE → SUSPENDED state machine with audit trail.
- **KYB Review** (`gateway-kyb-review`): Admin KYB document review with approve/reject/request_info actions.
- **Settlement Accounts** (`gateway-settlement-accounts`): Merchant settlement bank account management with verification.
- **Reconciliation Engine** (`gateway-reconciliation`): Automated provider-vs-ledger matching with mismatch detection and resolution workflows.

## [3.0.0] - 2026-03-01 — Phase 4: Escrow, Safeguarding, SAR

### Added
- **Escrow Sub-Wallets** (`gateway-escrow-wallets`): Full lifecycle — create, fund, release, refund, freeze escrow holds for marketplace transactions and multi-stage settlements.
- **Safeguarding Ledger** (`gateway-safeguarding-ledger`): E-money reconciliation tracking total liabilities against wallet and escrow balances with daily snapshots.
- **Suspicious Activity Reports** (`gateway-sar`): SAR management system — file, review, escalate, submit reports with immutable event history and analytics dashboard.

### Database
- `escrow_wallets`, `escrow_transactions`, `safeguarding_snapshots`, `suspicious_activity_reports`, `sar_events` tables with RLS and admin-only policies.

## [2.4.0] - 2026-02-27 — Piggy Bank, Njangi & Rent Credit Integration

### Added
- **Piggy Bank Module**: Solo savings and rent plans with automated payment schedules (daily/weekly/monthly).
- **Njangi Module**: Group savings pot with contribution amounts, late interest, random/manual payout rotation.
- **Rent Reporting**: Unique `KRENTS****` reference for rent plans. Payments reported to CrediQ.
- **9 New Credit Event Types**: Piggybank, Njangi, and Rent payment events integrated into scoring engine.
- **Credit Disclaimer**: Warning dialog before creating plans explaining credit impact.
- **Monthly Credit Report**: Automated summary via push notification and in-app alert.
- **8 New Edge Functions**: piggybank-create/pay/overdue-detect, njangi-create/join/contribute/payout/overdue-detect, credit-monthly-report.
- **2 Frontend Pages**: BankPiggyBank.tsx and BankNjangi.tsx with full CRUD and schedule views.

## [2.3.0] - 2026-02-27 — Production Audit: Loans, Savings & Credit Score

### Fixed
- **Unified Credit Score Systems**: `credit-score-fetch` now reads from event-sourced `credit_profiles` first, falls back to legacy `credit_scores`. Returns `recent_events` timeline and `score_band`.
- **Loan Repayment Idempotency**: `LoanRepaymentForm.tsx` now sends `Idempotency-Key` header, preventing 400 errors.
- **LoanAccountCard Table Names**: Fixed queries from `loan_repayment_schedules` → `loan_schedule` and `loan_payments` → `loan_repayments`.
- **Multi-tenancy for savings-create**: Now persists `institution_id` from request body.
- **Multi-tenancy for loan-apply**: Now persists `institution_id` from request body.
- **InstitutionLoans repayments query**: Now resolves `loan_accounts` by `application_id` before querying `loan_repayments`.

### Added
- **Repayment UI in Banking App**: `BankLoans.tsx` now has a "Pay" button on active loans with a repayment dialog.
- **Event-Sourced Credit Factors**: `BankCreditScore.tsx` shows event-sourced factors (with impact points) when available.
- **Credit Events Timeline**: `BankCreditScore.tsx` shows recent credit events (on-time payments, deposits, etc.).
- **Credit Score Feedback**: `BankSavings.tsx` shows credit score delta in toast after deposits.
- **`useLoanRepayment` hook**: New hook in `useBankingData.ts` for banking app loan repayments with idempotency.
- **`useCreditProfile` hook**: Calls `credit-profile-get` for event-sourced profile.
- **`useCreditEvents` hook**: Calls `credit-events-list` for paginated event timeline.

## [2.2.0] - 2026-02-27 — Loans & Savings ↔ Credit Score Linkage

### Added
- **Credit Events System**: Immutable `credit_events` table with event types: `LOAN_REPAYMENT_ON_TIME`, `LOAN_REPAYMENT_LATE`, `LOAN_INSTALLMENT_MISSED`, `LOAN_DEFAULTED`, `LOAN_CLOSED`, `SAVINGS_DEPOSIT`, `SAVINGS_WITHDRAWAL`, `SAVINGS_BALANCE_STABLE`
- **Credit Profiles**: `credit_profiles` table with current score and band
- **Credit Score Snapshots**: `credit_score_snapshots` with explainability `factors_json`
- **Credit Scoring Engine**: `credit-score-engine` edge function — deterministic, event-sourced scoring (300–850, baseline 500)
- **Overdue Detection**: `loan-overdue-detect` edge function for automatic missed payment detection with 3-day grace period
- **Credit Profile API**: `credit-profile-get` — view own credit profile
- **Credit Events API**: `credit-events-list` — paginated event listing with filters
- **Credit Explain API**: `credit-explain` — explainability with top factors and summary
- **Credit Recompute API**: `credit-recompute` — trigger score recomputation
- **Scoring Rules Table**: `credit_scoring_rules` for institution-configurable weights

### Changed (Non-Breaking)
- **loan-repay**: Now emits `LOAN_REPAYMENT_ON_TIME` or `LOAN_REPAYMENT_LATE` credit events, includes optional `credit_score` in response
- **savings-deposit**: Now emits `SAVINGS_DEPOSIT` credit events, includes optional `credit_score` in response
- **savings-withdraw**: Now emits `SAVINGS_WITHDRAWAL` credit events (zero weight)
- **loan_schedule**: Added `missed_event_created` boolean for dedupe

### Breaking Changes
- **NONE** — All additions are new tables, new endpoints, or optional response fields

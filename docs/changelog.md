# Changelog

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

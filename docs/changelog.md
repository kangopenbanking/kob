# Changelog

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

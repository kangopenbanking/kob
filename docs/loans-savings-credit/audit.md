# Loans & Savings ↔ Credit Score Audit

## Current State (Pre-Enhancement)

### Existing Infrastructure
- **Loan lifecycle**: `loan-apply`, `loan-approve`, `loan-disburse`, `loan-repay` edge functions with full ledger integration
- **Savings lifecycle**: `savings-create`, `savings-deposit`, `savings-withdraw`, `savings-accrue-interest` with ledger integration
- **Credit scoring**: `credit-score-calculate` (CrediQ component-based engine)
- **DB tables**: `loan_products`, `loan_applications`, `loan_accounts`, `loan_schedule`, `loan_repayments`, `loan_events`, `savings_products`, `savings_accounts`, `savings_transactions`, `interest_accruals`, `credit_scores`, `credit_score_history`
- **Ledger**: `journal_entries`, `journal_lines`, `ledger_accounts`

### What Was Missing
1. Immutable `credit_events` table for event-sourced credit trail
2. Automatic credit event emission from loan/savings operations
3. On-time vs late detection in loan repayment (comparing paid_at vs due_date)
4. Overdue detection cron job
5. Credit profile API endpoints (GET profile, events, explain, POST recompute)
6. Credit score snapshots with explainability factors
7. Deterministic scoring from events

## Enhancement Plan (Zero Breaking Changes)
- All new tables, endpoints, and optional response fields only
- Existing endpoints receive optional `credit_score` field in response
- No existing behavior modified

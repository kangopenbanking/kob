# Gap Report: Loans & Savings ↔ Credit Score Linkage

## Phase 1 Gaps (Resolved in v2.2.0)

| # | Gap | Severity | Resolution |
|---|-----|----------|------------|
| 1 | No immutable credit events table | Critical | Created `credit_events` table with enum types |
| 2 | No automatic event emission from loan-repay | Critical | Hooked into `loan-repay` edge function |
| 3 | No on-time vs late detection | High | Added due_date + 3-day grace comparison in loan-repay |
| 4 | No overdue detection job | High | Created `loan-overdue-detect` edge function |
| 5 | No credit profile API | Medium | Created `credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute` |
| 6 | No explainability snapshots | Medium | Created `credit_score_snapshots` with `factors_json` |
| 7 | No deterministic scoring from events | Critical | Created `credit-score-engine` (event-sourced, deterministic) |
| 8 | No savings → credit linkage | Medium | Hooked `savings-deposit` and `savings-withdraw` |
| 9 | No dedupe for overdue job | Medium | Added `missed_event_created` flag to `loan_schedule` |

## Phase 2 Gaps (Resolved in v2.3.0 — Production Audit)

| # | Gap | Severity | Resolution |
|---|-----|----------|------------|
| 10 | Two disconnected credit score systems | Critical | Unified `credit-score-fetch` to prefer event-sourced, fall back to legacy |
| 11 | `loan-repay` missing Idempotency-Key from frontend | Critical | Added `Idempotency-Key` header in `LoanRepaymentForm.tsx` |
| 12 | `LoanAccountCard.tsx` queries wrong tables | Critical | Fixed `loan_repayment_schedules` → `loan_schedule`, `loan_payments` → `loan_repayments` |
| 13 | `savings-create` missing `institution_id` | High | Accepted and persisted `institution_id` from request body |
| 14 | `loan-apply` missing `institution_id` | High | Accepted and persisted `institution_id` from request body |
| 15 | No repayment UI in banking app | High | Added Make Payment button + dialog in `BankLoans.tsx` |
| 16 | `BankCreditScore.tsx` shows legacy factors only | Medium | Updated to show event-sourced factors with timeline |
| 17 | No credit score feedback in savings UI | Medium | Added credit delta toast in `BankSavings.tsx` |
| 18 | `InstitutionLoans` queries repayments with wrong key | Medium | Fixed to resolve loan_accounts first, then query repayments |
| 19 | Missing `useLoanRepayment` hook | Medium | Added to `useBankingData.ts` |
| 20 | Missing `useCreditProfile`/`useCreditEvents` hooks | Medium | Added to `useBankingData.ts` |

## All Gaps Resolved
Zero breaking changes. All additions are new tables, new endpoints, or optional response fields.

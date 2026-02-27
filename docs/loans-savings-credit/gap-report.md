# Gap Report: Loans & Savings ↔ Credit Score Linkage

## Gaps Identified

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

## All Gaps Resolved
Zero breaking changes. All additions are new tables, new endpoints, or optional response fields.

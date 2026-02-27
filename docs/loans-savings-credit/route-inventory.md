# Route Inventory: Loans, Savings & Credit Scoring

## Loan Endpoints
| Method | Endpoint | Function | Status |
|--------|----------|----------|--------|
| POST | /v1/loan-apply | loan-apply | Existing |
| POST | /v1/loan-approve | loan-approve | Existing |
| POST | /v1/loan-disburse | loan-disburse | Existing |
| POST | /v1/loan-repay | loan-repay | **Updated** (emits credit events) |

## Savings Endpoints
| Method | Endpoint | Function | Status |
|--------|----------|----------|--------|
| POST | /v1/savings-create | savings-create | Existing |
| POST | /v1/savings-deposit | savings-deposit | **Updated** (emits credit events) |
| POST | /v1/savings-withdraw | savings-withdraw | **Updated** (emits credit events) |
| POST | /v1/savings-accrue-interest | savings-accrue-interest | Existing |

## Credit Scoring Endpoints (NEW)
| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | /v1/credit-profile-get | credit-profile-get | Get user's credit profile + latest snapshot |
| GET | /v1/credit-events-list | credit-events-list | List credit events with pagination/filters |
| GET | /v1/credit-explain | credit-explain | Get score explanation with factors |
| POST | /v1/credit-recompute | credit-recompute | Trigger score recomputation |
| POST | /v1/credit-score-engine | credit-score-engine | Internal deterministic scoring engine |

## Background Jobs (NEW)
| Method | Endpoint | Function | Schedule |
|--------|----------|----------|----------|
| POST | /v1/loan-overdue-detect | loan-overdue-detect | Daily cron |

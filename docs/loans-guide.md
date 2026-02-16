# Loans – Full Lifecycle Guide

## Overview

The KOB loan system manages the complete lifecycle: **Application → Approval → Disbursement → Repayment → Completion**, with full double-entry ledger integration and event tracking.

---

## Lifecycle States

```
draft → submitted → under_review → approved → disbursed → active → completed
                                  ↘ rejected                     ↘ defaulted
```

| Status | Trigger | Edge Function |
|---|---|---|
| `draft` | User saves application | `loan-apply` |
| `submitted` | User submits application | `loan-apply` (submit=true) |
| `approved` | Admin approves + schedule generated | `loan-approve` |
| `disbursed` | Admin disburses funds | `loan-disburse` |
| `active` | First repayment received | `loan-repay` |
| `completed` | Outstanding balance reaches 0 | `loan-repay` (auto) |

---

## Edge Functions

### 1. `loan-calculate` (Public)
Calculate loan terms without creating an application.

```bash
curl -X POST $BASE_URL/loan-calculate \
  -H "Content-Type: application/json" \
  -d '{
    "principal": 500000,
    "interest_rate": 12,
    "tenure_months": 12,
    "repayment_frequency": "monthly"
  }'
```

### 2. `loan-apply` (Authenticated)
Create or submit a loan application.

```bash
curl -X POST $BASE_URL/loan-apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_product_id": "uuid",
    "requested_amount": 500000,
    "tenure_months": 12,
    "purpose": "Business expansion",
    "submit": true
  }'
```

### 3. `loan-approve` (Admin)
Approve a submitted application. Generates the full repayment schedule.

```bash
curl -X POST $BASE_URL/loan-approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "uuid",
    "approved_amount": 500000,
    "notes": "Approved after credit review"
  }'
```

**Response includes:**
- Created `loan_account` with account number
- Schedule count and EMI amount
- Total payable including processing fee (1%)

### 4. `loan-disburse` (Admin, Idempotent)
Disburse approved loan funds. Posts to the ledger.

```bash
curl -X POST $BASE_URL/loan-disburse \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Idempotency-Key: disburse-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_account_id": "uuid",
    "disbursement_method": "bank_transfer"
  }'
```

**Ledger Effect:**
| Account | Debit | Credit |
|---|---|---|
| 1200 – Loan Receivable | 500,000 | |
| 1000 – Cash | | 500,000 |

### 5. `loan-repay` (Authenticated, Idempotent)
Make a repayment. Allocates to schedule and posts to ledger.

```bash
curl -X POST $BASE_URL/loan-repay \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: repay-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_account_id": "uuid",
    "amount": 47000,
    "payment_method": "mobile_money"
  }'
```

**Ledger Effect (per repayment):**
| Account | Debit | Credit |
|---|---|---|
| 1000 – Cash | 47,000 | |
| 1200 – Loan Receivable | | 41,667 |
| 4100 – Interest Revenue | | 5,333 |

---

## Repayment Allocation

Payments are allocated in this priority order:
1. **Fees** (processing fee on first installment)
2. **Interest** due
3. **Principal** due

Payments flow through pending schedules in ascending installment order. Partial payments are tracked and schedules move to `partial` status.

---

## Database Tables

### `loan_schedule`
Generated during approval. One row per installment.

| Column | Description |
|---|---|
| `installment_number` | 1-indexed |
| `due_date` | Payment due date |
| `principal_amount` | Principal portion |
| `interest_amount` | Interest portion |
| `fee_amount` | Processing fee (installment 1 only) |
| `total_amount` | Sum of all components |
| `paid_amount` | Amount paid so far |
| `status` | `pending` / `partial` / `paid` |

### `loan_repayments`
One row per payment received.

| Column | Description |
|---|---|
| `principal_paid` | Principal allocated |
| `interest_paid` | Interest allocated |
| `fees_paid` | Fees allocated |
| `journal_entry_id` | Link to ledger journal entry |

### `loan_events`
Immutable event log for audit trail.

| Event Type | When |
|---|---|
| `approved` | Admin approves application |
| `disbursed` | Funds are disbursed |
| `repayment` | Payment is received |
| `completed` | Balance reaches zero |

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `LOAN_001` | 400 | Missing application_id |
| `LOAN_002` | 404 | Application not found |
| `LOAN_003` | 422 | Invalid application status for approval |
| `LOAN_004` | 500 | Failed to create loan account |
| `LOAN_005` | 500 | Failed to generate schedule |
| `LOAN_010` | 409 | Idempotency conflict (disburse) |
| `LOAN_011` | 400 | Missing loan_account_id (disburse) |
| `LOAN_012` | 404 | Loan account not found (disburse) |
| `LOAN_013` | 422 | Invalid status for disbursement |
| `LOAN_020` | 409 | Idempotency conflict (repay) |
| `LOAN_021` | 400 | Invalid repayment parameters |
| `LOAN_022` | 404 | Loan account not found (repay) |
| `LOAN_023` | 422 | Invalid status for repayment |
| `LOAN_024` | 422 | Payment exceeds outstanding balance |
| `LOAN_999` | 500 | Internal server error |

---

## Calculation Formula

**EMI (Reducing Balance):**
```
EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)

Where:
  P = Principal
  r = Period interest rate (annual_rate / periods_per_year)
  n = Total number of payments
```

**Supported Frequencies:** daily, weekly, biweekly, monthly (default), quarterly

# Kang Open Banking — Ledger (Double-Entry Accounting)

> Version: 1.0 | Last updated: 2026-02-16

---

## Overview

The KOB platform uses a **double-entry bookkeeping** system to ensure every financial transaction is fully auditable and balanced. Every movement of value creates a journal entry where **total debits = total credits**.

---

## Architecture

| Component | Description |
|---|---|
| `ledger_accounts` | Chart of accounts — each account has a type and running balance |
| `journal_entries` | Header for each accounting event (date, description, reference) |
| `journal_lines` | Individual debit/credit lines within a journal entry |

### Account Types & Balance Direction

| Type | Normal Balance | Increases With |
|---|---|---|
| `asset` | Debit | Debit |
| `expense` | Debit | Debit |
| `liability` | Credit | Credit |
| `equity` | Credit | Credit |
| `revenue` | Credit | Credit |

---

## Chart of Accounts (Default)

| Code | Name | Type |
|---|---|---|
| `1000` | Cash & Bank | asset |
| `1100` | Loan Receivables | asset |
| `1200` | Interest Receivable | asset |
| `2000` | Customer Deposits | liability |
| `2100` | Interest Payable | liability |
| `2200` | Fees Collected | liability |
| `3000` | Equity | equity |
| `4000` | Interest Income | revenue |
| `4100` | Fee Income | revenue |
| `4200` | Commission Income | revenue |
| `5000` | Interest Expense | expense |
| `5100` | Processing Costs | expense |
| `5200` | Bad Debt Expense | expense |

---

## Posting Rules

### 1. Loan Disbursement

When a loan of 1,000,000 XAF is disbursed:

| Account | Debit | Credit |
|---|---|---|
| 1100 – Loan Receivables | 1,000,000 | |
| 1000 – Cash & Bank | | 1,000,000 |

### 2. Loan Repayment (Principal + Interest)

Repayment of 92,500 XAF (85,000 principal + 7,500 interest):

| Account | Debit | Credit |
|---|---|---|
| 1000 – Cash & Bank | 92,500 | |
| 1100 – Loan Receivables | | 85,000 |
| 4000 – Interest Income | | 7,500 |

### 3. Savings Deposit

Customer deposits 50,000 XAF:

| Account | Debit | Credit |
|---|---|---|
| 1000 – Cash & Bank | 50,000 | |
| 2000 – Customer Deposits | | 50,000 |

### 4. Savings Withdrawal

Customer withdraws 25,000 XAF:

| Account | Debit | Credit |
|---|---|---|
| 2000 – Customer Deposits | 25,000 | |
| 1000 – Cash & Bank | | 25,000 |

### 5. Interest Accrual on Savings

Daily interest of 137 XAF accrued:

| Account | Debit | Credit |
|---|---|---|
| 5000 – Interest Expense | 137 | |
| 2100 – Interest Payable | | 137 |

### 6. Fee Collection

Transaction fee of 500 XAF:

| Account | Debit | Credit |
|---|---|---|
| 1000 – Cash & Bank | 500 | |
| 4100 – Fee Income | | 500 |

---

## API Endpoints

### List Ledger Accounts

```bash
GET /v1/ledger/accounts?limit=25&offset=0&account_type=asset
Authorization: Bearer {admin_token}
```

### Create Ledger Account

```bash
POST /v1/ledger/accounts
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "code": "1300",
  "name": "Prepaid Expenses",
  "account_type": "asset",
  "currency": "XAF"
}
```

### Post Journal Entry

```bash
POST /v1/ledger/journal
Authorization: Bearer {admin_token}
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "entry_date": "2026-02-16",
  "description": "Loan disbursement - 1,000,000 XAF to Jean Dupont",
  "reference_type": "loan",
  "reference_id": "loan_abc123",
  "lines": [
    {
      "ledger_account_id": "<uuid-of-1100>",
      "debit": 1000000,
      "credit": 0
    },
    {
      "ledger_account_id": "<uuid-of-1000>",
      "debit": 0,
      "credit": 1000000
    }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "id": "je_xyz789",
    "entry_number": "JE-1708099200000-a1b2c3",
    "entry_date": "2026-02-16",
    "description": "Loan disbursement - 1,000,000 XAF to Jean Dupont",
    "reference_type": "loan",
    "reference_id": "loan_abc123",
    "is_reversed": false,
    "lines": [
      { "ledger_account_id": "...", "debit": 1000000, "credit": 0 },
      { "ledger_account_id": "...", "debit": 0, "credit": 1000000 }
    ],
    "total_debit": 1000000,
    "total_credit": 1000000
  }
}
```

### Get Ledger Account Balance

```bash
GET /v1/ledger/accounts/{accountId}/balance?account_id={uuid}
Authorization: Bearer {admin_token}

# Historical balance as of a specific date:
GET /v1/ledger/accounts/{accountId}/balance?account_id={uuid}&as_of=2026-01-31
```

---

## Error Codes

| Code | Error | Description |
|---|---|---|
| `LED_001` | `unbalanced_entry` | Sum of debits ≠ sum of credits |
| `LED_002` | `idempotency_conflict` | Same key used with different payload |
| `LED_999` | `internal_error` | Unexpected server error |

---

## Validation Rules

1. **Balance invariant**: Every journal entry must have `Σ debits = Σ credits`
2. **Minimum 2 lines**: Every entry needs at least one debit and one credit line
3. **No mixed lines**: A single line cannot have both debit > 0 and credit > 0
4. **Account existence**: All referenced `ledger_account_id` values must exist
5. **Idempotency required**: All POST requests must include `Idempotency-Key` header
6. **Admin only**: All ledger endpoints require `admin` role

---

## Reversal

To reverse a journal entry, post a new entry with opposite debit/credit lines and set `reference_type: 'reversal'` with `reference_id` pointing to the original entry.

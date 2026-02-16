# Kang Open Banking — Savings Guide

> Version: 1.0 | Last updated: 2026-02-16

---

## Overview

The KOB savings module supports **regular savings**, **fixed deposits**, and **goal-based savings** accounts with daily interest accrual and full ledger integration.

---

## Account Lifecycle

```
create → active → frozen → closed
```

| Status | Description |
|---|---|
| `active` | Account open and operational |
| `frozen` | Temporarily restricted (compliance hold) |
| `closed` | Account closed, balance zeroed |

---

## Savings Products

Products define the rules for each savings account type:

| Field | Description |
|---|---|
| `base_interest_rate` | Annual interest rate (%) |
| `interest_payment_frequency` | `daily`, `monthly`, `quarterly`, `annually` |
| `min_balance` | Minimum balance to maintain |
| `min_opening_balance` | Minimum to open the account |
| `max_withdrawals_per_month` | Withdrawal limit (null = unlimited) |
| `lock_in_period_months` | Fixed deposit lock period |
| `early_closure_penalty` | Penalty rate for early withdrawal (%) |

---

## API Endpoints

### Create Savings Account

```bash
POST /v1/savings/create
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "product_id": "prod_uuid",
  "account_name": "My Emergency Fund",
  "target_amount": 500000,
  "target_date": "2026-12-31",
  "auto_save_enabled": true,
  "auto_save_amount": 25000,
  "auto_save_frequency": "monthly"
}
```

### Deposit

```bash
POST /v1/savings/deposit
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "savings_account_id": "sa_uuid",
  "amount": 50000,
  "source_account_id": "acc_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "new_balance": 150000,
  "goal_reached": false,
  "transaction_ref": "DEP-1708099200000"
}
```

**Ledger effect:**
| Account | Debit | Credit |
|---|---|---|
| 1000 – Cash & Bank | 50,000 | |
| 2000 – Customer Deposits | | 50,000 |

### Withdraw

```bash
POST /v1/savings/withdraw
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "savings_account_id": "sa_uuid",
  "amount": 25000,
  "destination_account_id": "acc_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "new_balance": 125000,
  "withdrawals_remaining": 2,
  "transaction_ref": "WTH-1708099200000"
}
```

**Ledger effect:**
| Account | Debit | Credit |
|---|---|---|
| 2000 – Customer Deposits | 25,000 | |
| 1000 – Cash & Bank | | 25,000 |

---

## Interest Accrual

### How It Works

1. The `savings-accrue-interest` function runs daily (cron-compatible)
2. For each active account with balance > 0:
   - Calculates daily interest: `(annual_rate / 365) × balance`
   - Rounds to nearest XAF (no decimals)
   - Skips if already accrued for that date (idempotent)
3. Creates an `interest_accruals` record
4. Posts a journal entry: DR Interest Expense, CR Interest Payable
5. Updates the savings account's `interest_accrued` and `total_interest_earned`

### Trigger Manually (Admin)

```bash
POST /v1/savings/accrue-interest
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "accrual_date": "2026-02-16"
}
```

**Response:**
```json
{
  "processed": 42,
  "total_interest": 15750,
  "accrual_date": "2026-02-16"
}
```

### Interest Calculation Example

| Parameter | Value |
|---|---|
| Balance | 500,000 XAF |
| Annual rate | 5% |
| Daily rate | 5% / 365 = 0.0137% |
| Daily interest | 500,000 × 0.000137 = **68 XAF** |

**Ledger effect (per account per day):**
| Account | Debit | Credit |
|---|---|---|
| 5000 – Interest Expense | 68 | |
| 2100 – Interest Payable | | 68 |

---

## Withdrawal Rules

| Rule | Description |
|---|---|
| **Balance check** | `available_balance >= amount` |
| **Minimum balance** | `remaining_balance >= product.min_balance` (unless closing) |
| **Monthly limit** | `withdrawals_this_month < product.max_withdrawals_per_month` |
| **Fixed deposit lock** | Cannot withdraw before `maturity_date` without penalty |
| **Early closure penalty** | Charged at `product.early_closure_penalty` % of amount |

---

## Error Codes

| Code | Error | Description |
|---|---|---|
| `SAV_001` | `insufficient_balance` | Not enough available balance |
| `SAV_002` | `account_locked` | Fixed deposit before maturity |
| `SAV_003` | `withdrawal_limit` | Monthly withdrawal limit exceeded |
| `SAV_004` | `min_balance_violation` | Would breach minimum balance |
| `SAV_999` | `internal_error` | Unexpected server error |

---

## Data Model

### `savings_accounts`

Key fields: `current_balance`, `available_balance`, `interest_accrued`, `total_interest_earned`, `last_interest_date`, `current_interest_rate`, `status`, `is_locked`, `maturity_date`.

### `interest_accruals`

Each daily accrual record: `savings_account_id`, `accrual_date`, `interest_rate`, `accrued_amount`, `balance_before`, `balance_after`, `journal_entry_id`.

### `savings_transactions`

All deposits and withdrawals: `transaction_type` (`deposit`/`withdrawal`), `amount`, `balance_after`, `reference`.

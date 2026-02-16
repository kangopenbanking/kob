# Kang Open Banking — Database Schema Reference

> Version: 1.0 | Last updated: 2026-02-16

---

## Overview

The KOB platform uses PostgreSQL via Lovable Cloud. The schema is organized into the following domains:

| Domain | Tables | Description |
|---|---|---|
| **Auth & Identity** | `profiles`, `user_roles`, `user_permission_overrides`, `role_permissions` | User accounts, roles, RBAC |
| **OAuth & Security** | `access_tokens`, `refresh_tokens`, `authorization_codes`, `par_requests`, `oauth_sessions`, `client_certificates`, `tpp_registrations`, `api_clients`, `api_credentials` | OAuth 2.0 / FAPI infrastructure |
| **Accounts (AISP)** | `accounts`, `account_balances`, `transactions`, `beneficiaries`, `standing_orders`, `direct_debits` | Open Banking account information |
| **Consents** | `aisp_consents`, `pisp_consents`, `consent_events` | AISP/PISP consent management |
| **Payments (PISP)** | `payments`, `payment_events`, `payment_routes` | Payment initiation and tracking |
| **Savings** | `savings_products`, `savings_accounts`, `savings_transactions`, `interest_accruals` | Savings lifecycle |
| **Loans** | `loan_products`, `loan_applications`, `loan_schedule`, `loan_repayments`, `loan_events` | Loan lifecycle |
| **Ledger** | `ledger_accounts`, `journal_entries`, `journal_lines` | Double-entry accounting |
| **Mobile Money** | `mobile_money_transactions` | MTN/Orange MoMo integration |
| **Bank Transfers** | `bank_transfer_transactions`, `bank_connections`, `bank_statements`, `bank_reconciliations` | Flutterwave bank transfers |
| **Cards** | `virtual_cards`, `card_transactions`, `card_funding_transactions`, `card_payment_transactions` | Stripe Issuing virtual cards |
| **KYC & Compliance** | `kyc_verifications`, `customer_due_diligence`, `sanctions_screening`, `business_kyc`, `compliance_reports` | KYC/AML/CDD |
| **Institutions** | `institutions`, `branches`, `institution_verification_steps` | Multi-tenant institution management |
| **Billing** | `fee_structures`, `fee_waivers`, `transaction_fees`, `institution_invoices`, `settlement_transactions` | Fee calculation and invoicing |
| **Infrastructure** | `idempotency_keys`, `webhook_inbox`, `webhooks`, `webhook_deliveries`, `rate_limits`, `audit_logs`, `security_audit_logs` | Platform plumbing |
| **CrediQ** | `crediq_scores`, `crediq_score_history`, `crediq_email_preferences`, `credit_goals` | Credit scoring |
| **PostiQ** | `postiq_address_verifications`, `user_addresses`, `address_collections` | Address verification |

---

## New Tables (Checkpoint 4)

### `idempotency_keys`
Prevents duplicate processing of write operations (POST/PUT/PATCH).

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `idempotency_key` | TEXT | Client-provided key |
| `client_id` | TEXT | API client identifier |
| `endpoint` | TEXT | Target endpoint |
| `payload_hash` | TEXT | SHA-256 of request body |
| `response_status` | INTEGER | Cached HTTP status |
| `response_body` | JSONB | Cached response |
| `created_at` | TIMESTAMPTZ | Creation time |
| `expires_at` | TIMESTAMPTZ | 24h expiry |

**Unique constraint:** `(idempotency_key, client_id, endpoint)`

---

### `ledger_accounts`
Chart of accounts for double-entry bookkeeping.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `account_code` | TEXT UNIQUE | e.g., `1000-CASH` |
| `account_name` | TEXT | Display name |
| `account_type` | TEXT | `asset`, `liability`, `equity`, `revenue`, `expense` |
| `currency` | TEXT | Default `XAF` |
| `balance` | NUMERIC | Current balance |
| `institution_id` | UUID FK → institutions | Owner institution |
| `parent_account_id` | UUID FK → self | Hierarchical accounts |

---

### `journal_entries`
Header for each accounting transaction.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `entry_number` | TEXT UNIQUE | Sequential identifier |
| `entry_date` | DATE | Posting date |
| `description` | TEXT | Narrative |
| `reference_type` | TEXT | `payment`, `loan`, `savings`, `manual` |
| `reference_id` | UUID | FK to source record |
| `institution_id` | UUID FK → institutions | Owner |
| `is_reversed` | BOOLEAN | Reversal flag |
| `reversal_of` | UUID FK → self | Points to reversed entry |

---

### `journal_lines`
Individual debit/credit lines within a journal entry.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `journal_entry_id` | UUID FK → journal_entries | Parent entry |
| `ledger_account_id` | UUID FK → ledger_accounts | Target account |
| `debit` | NUMERIC | Debit amount (0 if credit) |
| `credit` | NUMERIC | Credit amount (0 if debit) |

**Invariant:** Sum of debits = Sum of credits per journal entry.

---

### `loan_schedule`
Amortization schedule for each loan.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `loan_id` | UUID FK → loan_applications | Parent loan |
| `installment_number` | INTEGER | Sequence (1, 2, 3…) |
| `due_date` | DATE | Payment due date |
| `principal_amount` | NUMERIC | Principal portion |
| `interest_amount` | NUMERIC | Interest portion |
| `fee_amount` | NUMERIC | Fees portion |
| `total_amount` | NUMERIC | Sum of above |
| `paid_amount` | NUMERIC | Amount paid so far |
| `status` | TEXT | `pending`, `paid`, `partial`, `overdue`, `waived` |

---

### `loan_repayments`
Individual repayment records with allocation breakdown.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `loan_id` | UUID FK → loan_applications | Parent loan |
| `schedule_id` | UUID FK → loan_schedule | Matched installment |
| `amount` | NUMERIC | Total payment amount |
| `principal_paid` | NUMERIC | Allocated to principal |
| `interest_paid` | NUMERIC | Allocated to interest |
| `fees_paid` | NUMERIC | Allocated to fees |
| `journal_entry_id` | UUID FK → journal_entries | Ledger posting |

---

### `loan_events`
Audit trail for loan lifecycle transitions.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `loan_id` | UUID FK → loan_applications | Parent loan |
| `event_type` | TEXT | `applied`, `approved`, `rejected`, `disbursed`, `repayment`, `defaulted`, `completed`, `written_off` |
| `performed_by` | UUID | User who triggered |
| `metadata` | JSONB | Event-specific data |

---

### `interest_accruals`
Daily/periodic interest calculations on savings accounts.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `savings_account_id` | UUID FK → savings_accounts | Target account |
| `accrual_date` | DATE | Accrual date |
| `interest_rate` | NUMERIC | Applied rate |
| `accrued_amount` | NUMERIC | Interest earned |
| `balance_before` | NUMERIC | Balance pre-accrual |
| `balance_after` | NUMERIC | Balance post-accrual |
| `journal_entry_id` | UUID FK → journal_entries | Ledger posting |

---

### `payment_events`
Status transition log for payments.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `payment_id` | UUID FK → payments | Parent payment |
| `event_type` | TEXT | `created`, `authorized`, `submitted`, `completed`, `failed`, `cancelled` |
| `previous_status` | TEXT | Status before transition |
| `new_status` | TEXT | Status after transition |

---

### `payment_routes`
Tracks which payment rail processed each payment.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `payment_id` | UUID FK → payments | Parent payment |
| `rail` | TEXT | `flutterwave`, `mobile_money`, `bank_transfer`, `stripe` |
| `external_reference` | TEXT | External system ref |
| `status` | TEXT | Route-level status |
| `attempt_number` | INTEGER | Retry count |

---

### `webhook_inbox`
Deduplication table for inbound webhooks.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `source` | TEXT | `flutterwave`, `stripe`, `mobile_money` |
| `event_id` | TEXT | External event ID |
| `payload` | JSONB | Raw webhook body |
| `is_processed` | BOOLEAN | Processing flag |

**Unique constraint:** `(source, event_id)` — prevents duplicate processing.

---

## RLS Summary (New Tables)

| Table | Policy | Access |
|---|---|---|
| `idempotency_keys` | Service role only | Edge functions via service role key |
| `ledger_accounts` | Admin full + institution SELECT | Admin CRUD, institution read-own |
| `journal_entries` | Admin full + institution SELECT | Admin CRUD, institution read-own |
| `journal_lines` | Admin full + institution SELECT | Admin CRUD, institution read-own |
| `loan_schedule` | Admin full + user SELECT | Admin CRUD, borrower read-own |
| `loan_repayments` | Admin full + user SELECT | Admin CRUD, borrower read-own |
| `loan_events` | Admin full + user SELECT | Admin CRUD, borrower read-own |
| `interest_accruals` | Admin full + user SELECT | Admin CRUD, saver read-own |
| `payment_events` | Admin full + user SELECT | Admin CRUD, payer read-own |
| `payment_routes` | Admin full | Admin only |
| `webhook_inbox` | Service role only | Edge functions via service role key |

---

## Database Functions (New)

| Function | Description |
|---|---|
| `cleanup_expired_idempotency_keys()` | Deletes idempotency keys past their 24h TTL |

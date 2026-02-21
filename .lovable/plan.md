

# FI Portal Banking Management System -- Full Audit & Build Plan

## Current State

The `/fi-portal` currently has 12 pages:
- Dashboard, Analytics, Transactions, Payments, Settlement, API Clients, Webhooks, Credit API, Compliance, Profile, Team, Settings, WooCommerce

## Gap Analysis

The database contains 140+ tables covering full core banking functionality, but the FI Portal is missing **10 critical banking management pages** that institutions need to operate as a bank/credit union:

| Missing Feature | Database Tables Available | Priority |
|---|---|---|
| **Accounts Management** | `accounts`, `account_balances` | Critical |
| **Branch Management** | `branches` | Critical |
| **Loans Management** | `loan_products`, `loan_applications`, `loan_schedule`, `loan_repayments`, `loan_events` | Critical |
| **Savings Management** | `savings_products`, `savings_accounts`, `savings_transactions`, `interest_accruals` | Critical |
| **Customer/KYC Management** | `kyc_verifications`, `customer_due_diligence`, `sanctions_screening` | Critical |
| **Beneficiaries & Standing Orders** | `beneficiaries`, `standing_orders`, `direct_debits` | High |
| **Ledger / Accounting** | `ledger_accounts`, `journal_entries`, `journal_lines` | High |
| **Audit Logs** | `audit_logs`, `security_audit_logs` | High |
| **Invoices & Billing** | `institution_invoices`, `transaction_fees`, `fee_structures` | Medium |
| **Consent Management** | `aisp_consents`, `pisp_consents`, `consent_events` | Medium |

## Implementation Plan

### 1. Accounts Management (`/fi-portal/accounts`)
- List all institution accounts with balances
- View account details, transaction history per account
- Account status management (active/frozen/closed)
- Query `accounts` + `account_balances` by `institution_id`

### 2. Branch Management (`/fi-portal/branches`)
- List all branches for the institution
- Create new branches (sub-branches)
- Edit branch details (address, phone, email, status)
- Toggle branch active/inactive
- Query `branches` by `institution_id`

### 3. Loans Management (`/fi-portal/loans`)
- Tabs: Products | Applications | Active Loans | Repayments
- View loan products offered by the institution
- Track loan applications and their status (applied, approved, disbursed, etc.)
- View amortization schedules (`loan_schedule`)
- Record and track repayments (`loan_repayments`)
- Loan lifecycle event trail (`loan_events`)

### 4. Savings Management (`/fi-portal/savings`)
- Tabs: Products | Accounts | Transactions | Interest
- Savings products catalog
- Active savings accounts list
- Deposits/withdrawals history (`savings_transactions`)
- Interest accrual tracking (`interest_accruals`)

### 5. Customer KYC Management (`/fi-portal/customers`)
- List customers with KYC status
- View KYC verification details
- Customer due diligence records
- Sanctions screening results
- Risk scoring summary

### 6. Beneficiaries & Standing Orders (`/fi-portal/beneficiaries`)
- Registered beneficiaries list
- Active standing orders
- Direct debits management
- Status monitoring

### 7. Ledger / Accounting (`/fi-portal/ledger`)
- Chart of accounts view (`ledger_accounts`)
- Journal entries browser (`journal_entries` + `journal_lines`)
- Account balance summaries
- Debit/Credit validation display

### 8. Audit Trail (`/fi-portal/audit`)
- Searchable audit log viewer
- Filter by action type, entity, date range
- Security event log
- Export capability

### 9. Invoices & Billing (`/fi-portal/billing`)
- Invoice list with status (pending, paid, overdue)
- Fee structure overview
- Fee waivers applied
- Monthly billing summary

### 10. Consent Management (`/fi-portal/consents`)
- AISP consent dashboard (active, revoked, expired counts)
- PISP consent tracking
- Consent event timeline
- Revocation capability

### Navigation Update

Add 4 new sidebar sections to `InstitutionLayout.tsx`:

```text
Banking Operations
  - Accounts        /fi-portal/accounts
  - Branches         /fi-portal/branches
  - Loans            /fi-portal/loans
  - Savings          /fi-portal/savings
  - Customers        /fi-portal/customers

Financial Management
  - Beneficiaries    /fi-portal/beneficiaries
  - Ledger           /fi-portal/ledger
  - Billing          /fi-portal/billing

Governance
  - Consents         /fi-portal/consents
  - Audit Trail      /fi-portal/audit
```

### Routing Update

Add 10 new routes nested under the existing `/fi-portal` parent in `App.tsx`.

## Technical Details

- All 10 new pages follow the same pattern as existing pages: `useState` + `useEffect` + `supabase` client queries
- Every page filters data by `institution_id` derived from the logged-in user's institution record
- No new database migrations needed -- all tables already exist
- No new edge functions needed -- all reads use the client SDK with existing RLS policies
- Each page includes: loading skeleton, empty state, refresh button, date formatting, status badges
- Existing sidebar navigation groups will be reorganized into 6 sections total for clarity




# FI Portal -- Comprehensive Banking Operations Expansion Plan

## Executive Summary

After a thorough audit of all 140+ database tables against the current 22 FI Portal pages, I identified **7 missing management modules** and **critical workflow gaps** in the existing pages. The biggest gap is that the current portal is read-only -- a bank teller or relationship manager cannot actually **onboard a customer, open an account, or process a loan** from the portal. This plan addresses both the missing pages and the missing create/edit workflows.

---

## Part A: Gaps in Existing Pages (Workflow Enhancements)

The current pages only display data. A real bank needs staff to **create, update, and approve** records. The following existing pages need action capabilities:

| Page | Current State | What is Missing |
|---|---|---|
| **Accounts** | Read-only list | Create personal/business account, freeze/close account, view per-account transaction history |
| **Customers** | KYC list only | Register a new customer (walk-in), initiate KYC verification, approve/reject KYC, run sanctions screening |
| **Loans** | Read-only tabs | Create loan application on behalf of customer, approve/reject applications, record manual repayments |
| **Savings** | Read-only tabs | Open savings account for customer, record deposits/withdrawals |
| **Branches** | Read-only list | Create new branch, edit branch details, assign staff to branches |
| **Beneficiaries** | Read-only list | Add beneficiary, create standing order, set up direct debit on behalf of customer |

---

## Part B: Missing Pages (New Modules)

### 1. Customer Onboarding (`/fi-portal/customer-onboarding`)
**The core missing workflow.** When a person or business walks into a branch:

- **Step 1 -- Registration**: Bank staff enters customer personal details (name, phone, email, address, date of birth, nationality). Creates a `profiles` record.
- **Step 2 -- KYC/Identity Verification**: Staff uploads ID documents (passport, national ID), captures selfie. Creates `kyc_verifications` record. Staff can approve/reject.
- **Step 3 -- Due Diligence**: Staff completes CDD questionnaire (occupation, source of income, PEP status, expected transaction volume). Creates `customer_due_diligence` record.
- **Step 4 -- Sanctions Screening**: Automatic or manual screening against lists. Creates `sanctions_screening` record.
- **Step 5 -- Account Opening**: Staff selects account type (personal current, savings, business), sets currency, and opens the account. Creates `accounts` + `account_balances` records.
- **Step 6 -- For Businesses**: Additional business KYC form (registration number, directors, beneficial owners, VAT). Creates `business_kyc` + `business_account_signatories` records.

Tables used: `profiles`, `kyc_verifications`, `customer_due_diligence`, `sanctions_screening`, `accounts`, `account_balances`, `business_kyc`, `business_account_signatories`

### 2. Staff & HR Management (`/fi-portal/staff`)
Manage bank employees across branches.

- List all staff with branch assignments, positions, departments
- Assign/reassign staff to branches
- Track employment type (full-time, contract, part-time)
- Active/inactive status management

Table: `staff_assignments`

### 3. Incident Management (`/fi-portal/incidents`)
Track operational incidents (system outages, fraud attempts, compliance breaches).

- Log new incidents with severity (critical/high/medium/low)
- Assign incidents to staff members
- Track resolution status and notes
- Filter by type, severity, status

Table: `incident_logs`

### 4. Regulatory Reporting (`/fi-portal/regulatory`)
Generate and submit reports to COBAC and other regulators.

- Create regulatory reports (anti-money laundering, prudential, statistical)
- Track submission status and acknowledgments
- Store report data and file attachments
- Period-based reporting (monthly, quarterly, annual)

Table: `regulatory_reports`

### 5. SWIFT & ISO 20022 Messages (`/fi-portal/messaging`)
View international payment messages and standards.

- Tabs: SWIFT Messages | ISO 20022 Messages
- View inbound/outbound message history
- Message status tracking (sent, received, validated, failed)
- Parsed data display with XML raw view option

Tables: `swift_messages`, `iso20022_messages`

### 6. Exchange Rates (`/fi-portal/exchange-rates`)
View and manage currency exchange rates.

- Current exchange rate display (XAF to major currencies)
- Rate source and validity tracking
- Historical rate lookup

Table: `exchange_rates_cache`

### 7. Notifications & Alerts (`/fi-portal/alerts`)
System alerts and notification management for the institution.

- Active system alerts (security, compliance, operational)
- Notification preferences configuration
- Alert severity and acknowledgment tracking

Tables: `system_alerts`, `notification_preferences`

---

## Part C: Enhanced Existing Pages

### Accounts Page Enhancement
- Add "Open Account" button with a dialog/form (account type, currency, holder name, identification)
- Add per-row actions: View Details, View Transactions, Freeze, Close
- Show balance inline for each account
- Separate tabs for Personal Accounts vs Business Accounts

### Customers Page Enhancement  
- Add "Register Customer" button launching the onboarding wizard
- Add per-customer actions: View Profile, Initiate KYC, Run Screening
- Add a unified customer list (not just KYC records) showing all customers with their account count and KYC status

### Branches Page Enhancement
- Add "Create Branch" dialog
- Add staff count per branch
- Add per-branch actions: Edit, View Staff, Deactivate

---

## Navigation Update

Add new items to the sidebar:

```text
Banking Operations (updated)
  - Accounts           /fi-portal/accounts
  - Customer Onboarding /fi-portal/customer-onboarding
  - Branches            /fi-portal/branches
  - Loans               /fi-portal/loans
  - Savings             /fi-portal/savings
  - Customers           /fi-portal/customers

Operations & Risk
  - Staff Management    /fi-portal/staff
  - Incidents           /fi-portal/incidents
  - Exchange Rates      /fi-portal/exchange-rates
  - Alerts              /fi-portal/alerts

Regulatory & Messaging
  - Regulatory Reports  /fi-portal/regulatory
  - SWIFT / ISO 20022   /fi-portal/messaging
```

---

## Implementation Summary

| Task | Files |
|---|---|
| Customer Onboarding wizard (new) | `src/pages/institution/InstitutionCustomerOnboarding.tsx` |
| Staff Management (new) | `src/pages/institution/InstitutionStaff.tsx` |
| Incident Management (new) | `src/pages/institution/InstitutionIncidents.tsx` |
| Regulatory Reporting (new) | `src/pages/institution/InstitutionRegulatory.tsx` |
| SWIFT/ISO Messages (new) | `src/pages/institution/InstitutionMessaging.tsx` |
| Exchange Rates (new) | `src/pages/institution/InstitutionExchangeRates.tsx` |
| System Alerts (new) | `src/pages/institution/InstitutionAlerts.tsx` |
| Enhanced Accounts page | `src/pages/institution/InstitutionAccounts.tsx` (rewrite) |
| Enhanced Customers page | `src/pages/institution/InstitutionCustomers.tsx` (rewrite) |
| Enhanced Branches page | `src/pages/institution/InstitutionBranches.tsx` (update) |
| Navigation update | `src/components/institution/InstitutionLayout.tsx` |
| Routing update | `src/App.tsx` |

## Technical Notes

- No new database tables or migrations needed -- all tables already exist
- Customer Onboarding is the largest new feature: a multi-step wizard with file upload (using existing `kyc-documents` storage bucket)
- All pages follow the established pattern: `useState` + `useEffect` + Supabase client queries filtered by `institution_id`
- Create/update operations will use the Supabase client SDK with existing RLS policies
- The onboarding wizard will create auth users via an edge function (since client-side `auth.admin.createUser` is not available)


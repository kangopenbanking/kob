# KOB Playwright E2E UI Test Plan

## Overview

Comprehensive test plan for Kang Open Banking covering all dashboard surfaces across 4 role-based projects: **Admin**, **Merchant**, **Developer**, and **Institution/Consumer**. Tests validate page integrity, form flows, data consistency, notifications, and API ↔ UI parity.

---

## Test Infrastructure

### Projects (Role-Based)

| Project | Base URL | Auth Strategy | Scope |
|---------|----------|---------------|-------|
| `admin` | `/admin/*` | Admin role login | ~70 pages |
| `merchant` | `/merchant/*` | Merchant role login | ~43 pages |
| `developer` | `/developer/*` | Developer role login | ~80+ pages |
| `institution` | `/biz/*`, `/bank/*` | Institution staff login | ~30 pages |
| `consumer` | `/app/*` | Personal user login | ~25 pages |

### Test Categories

1. **Page Integrity** — Every route loads without JS errors, correct heading visible
2. **Form Integrity** — All create/edit forms validate, submit, and show success
3. **Data Consistency** — API responses match what the UI renders
4. **Cross-Role Consistency** — Admin action reflects in merchant/user view
5. **Payments Reliability** — End-to-end financial flows
6. **Notifications** — In-app + email triggers verified

---

## Suite 1: Page Integrity (All Routes)

Every page must:
- [ ] Return HTTP 200 (no console errors)
- [ ] Render the correct `<h1>` or page title
- [ ] Show either data or an actionable empty state (with CTA button)
- [ ] Have a working sidebar/nav link that routes correctly
- [ ] Be responsive at 375px viewport width

### Admin Dashboard (~70 pages)

| Route | Expected Title | Key Assertions |
|-------|---------------|----------------|
| `/admin` | Dashboard | Stats cards render, pending actions visible |
| `/admin/users` | User Management | Table loads, search works |
| `/admin/kyc-review` | KYC Review | Filter by status, approve/reject buttons present |
| `/admin/kyb-review` | KYB Review | Filter by status, review queue visible |
| `/admin/merchants` | Merchant Management | List, search, view detail, approve/suspend |
| `/admin/payment-command-center` | Payment Command Center | Live transaction stream renders |
| `/admin/webhooks` | Webhooks | List, delivery logs visible |
| `/admin/settlements` | Settlement Approval | List, approve/reject |
| `/admin/disputes` | Disputes | List, respond with evidence |
| `/admin/bank-directory` | Bank Directory | Tabs: Banks, Connectors, DB, API, PSU, Payments, Files, Batches |
| `/admin/interbank-payments` | Interbank Payments | Tabs: Payments, Participants, Messages, Routing |
| `/admin/exchange-rates` | Exchange Rates | Table loads |
| `/admin/loan-management` | Loan Management | List loans |
| `/admin/savings-management` | Savings Management | List savings |
| `/admin/support-chat` | Support Chat | Conversations list |
| `/admin/notifications` | Notifications | Bell icon shows count |
| `/admin/api-clients` | API Clients | Table loads |
| `/admin/compliance` | Compliance | Screening queue |
| `/admin/reports` | Reports | Export options visible |

### Merchant Dashboard (~43 pages)

| Route | Expected Title | Key Assertions |
|-------|---------------|----------------|
| `/merchant` | Dashboard | Revenue stats, recent transactions |
| `/merchant/transactions` | Transactions | List, filter, search, pagination, detail sheet |
| `/merchant/settlements` | Settlements | List, filter, export CSV |
| `/merchant/payouts` | Payouts | List, request withdrawal, PIN confirmation |
| `/merchant/refunds` | Refunds | List, filter |
| `/merchant/disputes` | Disputes | List, respond |
| `/merchant/api-keys` | API Keys | Create, rotate, revoke, secret shown once |
| `/merchant/webhooks` | Webhooks | Register endpoint, test event, delivery logs |
| `/merchant/settlement-accounts` | Settlement Accounts | Add, edit, delete |
| `/merchant/kyb` | KYB Verification | Submit form, status tracking |
| `/merchant/storefront` | Storefront | Create, publish/unpublish |
| `/merchant/subscriptions` | Subscriptions | List, create, cancel |
| `/merchant/payment-links` | Payment Links | Create, copy link, view stats |
| `/merchant/branding` | Branding | Upload logo, set colors |
| `/merchant/analytics` | Analytics | Charts render with data |
| `/merchant/escrow` | Escrow Wallets | List, create, fund |
| `/merchant/customers` | Customers | List, view detail |
| `/merchant/pos` | POS | Products, orders |
| `/merchant/wallet` | Wallet | Balance, transactions |

### Developer Portal (~80+ pages)

| Route | Expected Title | Key Assertions |
|-------|---------------|----------------|
| `/developer` | Developer Portal | Quickstart cards visible |
| `/developer/api-explorer` | API Explorer | Spec loads, endpoints expandable |
| `/developer/api-explorer-static` | API Reference | Static spec renders |
| `/developer/api-keys` | API Keys | Create sandbox key, copy |
| `/developer/sandbox` | Sandbox | Data generator works |
| `/developer/webhooks` | Webhook Testing | Simulate event, verify delivery |
| `/developer/getting-started` | Getting Started | Content renders |
| `/developer/changelog` | Changelog | Entries display with dates |
| `/developer/status` | Status Page | Services listed with health indicators |
| `/developer/sdks` | SDKs | SDK cards render |
| `/documentation` | Documentation | Guide pages render, code blocks copyable |

### Institution Dashboard

| Route | Expected Title | Key Assertions |
|-------|---------------|----------------|
| `/biz/overview` | Overview | Stats cards |
| `/biz/connectors` | Connectors | Overview, uploads, mappings, status, reconciliation |
| `/biz/beneficiaries` | Beneficiaries | List, add, edit |
| `/biz/settlement` | Settlement | List, details, export |

### Consumer PWA

| Route | Expected Title | Key Assertions |
|-------|---------------|----------------|
| `/app/dashboard` | Dashboard | Balance, recent transactions |
| `/app/loans` | Loans | Products, applications, active loans |
| `/app/savings` | Savings | Accounts, products, transactions |
| `/app/cards` | Cards | Virtual card list |
| `/app/transfers` | Transfers | Send money form |
| `/app/support` | Support | Chat interface |

---

## Suite 2: Form Integrity

### Merchant Forms

| Form | Route | Fields | Validation | Success Assertion |
|------|-------|--------|------------|-------------------|
| Create API Key | `/merchant/api-keys` | environment, label | Required env | Key displayed once, copy button works |
| Rotate API Key | `/merchant/api-keys` | key selection | Key must exist | New secret shown, old invalidated |
| Add Settlement Account | `/merchant/settlement-accounts` | type, details | Phone/account required | Account appears in list |
| Register Webhook | `/merchant/webhooks` | URL, events | Valid URL required | Webhook listed, test ping button |
| Create Subscription | `/merchant/subscriptions` | plan, email | Email required | Subscription listed |
| Create Payment Link | `/merchant/payment-links` | title, amount | Amount > 0 | Link generated, copyable |
| KYB Submission | `/merchant/kyb` | company details | All fields required | Status changes to "pending" |
| New Withdrawal | `/merchant/payouts` | amount, account | Min 1000 XAF | Payout listed as pending |
| Create Escrow | `/merchant/escrow` | label, wallet ID | Both required | Escrow card appears |

### Admin Forms

| Form | Route | Fields | Success Assertion |
|------|-------|--------|-------------------|
| Register Bank | `/admin/bank-directory` | legal_name, code, SWIFT | Bank appears in table |
| Create Branch | `/admin/branches` | name, code | Branch listed |
| Approve KYB | `/admin/kyb-review` | decision, reason | Status updates, merchant notified |
| Register Connector | `/admin/bank-directory` | name, env, URL, type | Connector listed |

---

## Suite 3: Cross-Role Data Consistency

| Scenario | Admin Action | Expected in Merchant/User |
|----------|-------------|--------------------------|
| KYB Approval | Admin approves KYB | Merchant sees "approved" status |
| Merchant Suspension | Admin suspends merchant | Merchant dashboard shows warning |
| Dispute Filed | System creates dispute | Both admin and merchant see it |
| Settlement Generated | System creates settlement | Merchant sees it in settlements tab |
| Payout Completed | Webhook updates status | Merchant sees "completed" badge |

---

## Suite 4: Payments Reliability

### Happy Path: Charge → Settlement

1. Merchant creates charge via API → status `pending`
2. Provider webhook fires → status `successful`
3. Transaction appears in merchant dashboard
4. Settlement batch created
5. Settlement appears in settlements page
6. CSV export includes transaction

### Refund Flow

1. Merchant initiates refund → status `pending`
2. Provider webhook → status `completed`
3. Refund appears in refunds page
4. Settlement adjusted

### Payout Flow

1. Merchant requests withdrawal → PIN confirmed
2. Payout created → status `pending`
3. Provider processes → status `completed`
4. Wallet balance decremented

### Dedupe Test

1. Send same webhook event twice
2. Second delivery returns 200 but no state change
3. No double-credit in wallet

---

## Suite 5: Notifications

| Event | In-App Notification | Email |
|-------|-------------------|-------|
| KYB submitted | Admin sees notification | Admin email sent |
| KYB approved/rejected | Merchant notification | Merchant email sent |
| Charge successful | Merchant notification | — |
| Payout completed | Merchant notification | Merchant email sent |
| Payout failed | Merchant notification | Merchant email sent |
| Dispute opened | Merchant notification | Merchant email sent |
| Dispute resolved | Merchant notification | — |
| Subscription expiring | Merchant notification | Merchant email sent |
| New support message | User notification | — |

---

## Suite 6: Empty States with CTAs

Every page that can be empty MUST show:
- An icon
- A descriptive title
- A brief explanation
- An **actionable CTA button** that resolves the empty state

| Page | Empty State Title | CTA Label | CTA Action |
|------|------------------|-----------|------------|
| Merchant Transactions | "No transactions found" | "Create Test Charge" | Navigate to dashboard |
| Merchant Settlements | "No settlements found" | "View Transactions" | Navigate to transactions |
| Merchant Refunds | "No refunds found" | "View Transactions" | Navigate to transactions |
| Merchant Payouts | "No payouts found" | "Add Settlement Account" | Navigate to settlement accounts |
| Merchant Subscriptions | "No subscriptions found" | "New Subscription" | Open create dialog |
| Merchant Escrow | "No escrow wallets" | "Create Escrow Wallet" | Open create dialog |
| Loans (products) | "No loan products available" | — | N/A (admin seed data) |
| Loans (my loans) | "No active loans" | "Browse Loan Products" | Switch to products tab |
| Savings (accounts) | "No Savings Accounts" | "Open Savings Account" | Open create form |

---

## Suite 7: Responsive Design

Test at these viewports:
- Desktop: 1440×900
- Tablet: 768×1024
- Mobile: 375×812

Key pages to test:
- [ ] Merchant Dashboard
- [ ] Developer Portal Home
- [ ] API Explorer
- [ ] Admin Dashboard
- [ ] Consumer PWA Dashboard
- [ ] All forms (must be usable on mobile)

---

## Suite 8: Auth Guards

- [ ] Unauthenticated → redirect to `/auth`
- [ ] Wrong role → redirect to appropriate dashboard
- [ ] Session expired → re-auth prompt
- [ ] Admin routes blocked for merchant users
- [ ] Merchant routes blocked for consumer users

---

## Execution

### Run Commands

```bash
# All suites
npx playwright test

# Single project
npx playwright test --project=admin
npx playwright test --project=merchant

# Single suite
npx playwright test --grep "Page Integrity"
npx playwright test --grep "Form Integrity"

# Generate HTML report
npx playwright test --reporter=html
```

### Reports

- HTML report: `playwright-report/index.html`
- JUnit XML: `test-results/junit.xml`
- Screenshots on failure: `test-results/screenshots/`

### CI Integration

```yaml
- name: E2E Tests
  run: npx playwright test --reporter=junit
  env:
    BASE_URL: ${{ secrets.PREVIEW_URL }}
```

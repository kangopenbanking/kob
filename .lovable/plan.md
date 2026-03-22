# KOB Pro-Gateway: Postman Hardening + Playwright E2E Plan + Empty State CTAs

## Overview

Three deliverables: (1) Harden the Postman collection edge function with per-request test scripts and chained variable extraction for sandbox + prod environments, (2) Create a comprehensive Playwright E2E UI test plan document covering all dashboard surfaces, (3) Upgrade all empty states across merchant/admin/developer/institution pages to include actionable CTAs.

---

## Deliverable 1 — Postman Collection Hardening

**Current state**: The `postman-collection` edge function already has auto-auth pre-request scripts, sandbox/prod environments, and collection variables. It has basic `testStatus`/`testJson`/`testHasField` helpers but they are not attached to individual requests.

**Changes to `supabase/functions/postman-collection/index.ts**`:

- Add `event` (test scripts) to every request item using the existing helpers
- Add variable chaining: requests that create resources save IDs into collection variables (e.g., charge creation saves `charge_id`, payout saves `payout_id`)
- Add folder-level test events for common assertions (JSON body, status codes)
- Add per-folder pre-request scripts for auth-gated folders
- Add new Postman collection variables: `idempotency_key`, `webhook_url`, `subscription_id`, `payment_link_id`, `virtual_account_id`, `subaccount_id`, `customer_id`
- Enhance environment definitions with `merchant_api_key`, `webhook_secret`, `idempotency_key_prefix`
- Add a "Smoke Test" folder with a chained sequence: health → token → create charge → verify charge → refund → verify refund

**Modify the `r()` helper** to accept an optional `tests` array and `postTests` script block, automatically injecting `event` into each item.

---

## Deliverable 2 — Playwright E2E UI Test Plan

**Current state**: No Playwright setup exists. The project uses Vitest for unit tests.

**Create `docs/e2e/playwright-test-plan.md**` — a comprehensive test plan document covering:

### Admin Dashboard (70 pages)

- Dashboard loads with stats, pending actions visible
- Each sidebar nav item navigates correctly
- KYC/KYB review queues: filter, approve, reject actions
- Payment Command Center: live transaction stream renders
- Merchant Management: list, search, view detail, approve/suspend
- Webhook Management: list, delivery logs visible
- Settlement Approval: list, approve/reject
- Dispute Management: list, respond with evidence
- Notifications: bell icon shows count, dropdown lists notifications, mark-as-read

### Merchant Dashboard (43 pages)

- Dashboard loads with revenue stats, recent transactions
- Transactions: list, filter, search, pagination, detail sheet
- Settlements: list, filter, export CSV
- Payouts: list, request withdrawal flow, PIN confirmation
- Refunds: list, filter
- Disputes: list, respond
- API Keys: create, rotate, revoke, secret shown once
- Webhooks: register endpoint, test event, delivery logs
- Settlement Accounts: add account, edit, delete
- KYB: submit form, status tracking
- Storefront: create, publish/unpublish
- Subscriptions: list, cancel
- Payment Links: create, copy link, view stats
- Branding: upload logo, set colors
- Analytics: charts render with data

### Developer Portal (80+ pages)

- Home page loads with quickstart cards
- API Explorer: spec loads, endpoints expandable, "Try It" works
- API Keys: create sandbox key, copy
- Sandbox: data generator works
- Webhook Testing: simulate event, verify delivery
- Each guide page: renders content, code blocks copyable
- Changelog: entries display with dates
- Status Page: services listed with health indicators

### Institution Dashboard

- Connector pages: overview, uploads, mappings, status, reconciliation
- Beneficiaries: list, add, edit
- Settlement: list, details, export

### Cross-cutting

- Empty states: every page with no data shows CTA button
- Notifications: real-time delivery, dismiss, mark-read
- Data consistency: API response matches UI display
- Responsive: key pages work at 375px mobile width
- Auth guard: unauthenticated access redirects to login

---

## Deliverable 3 — Empty State CTAs

**Current state**: The `EmptyState` component supports an `action` prop `{ label, onClick }` but most usages across merchant/admin/institution pages do NOT pass it. Empty states show icon + title + description only — no actionable button.

**Changes**:

### Merchant pages (6 files):


| Page                        | Current                  | CTA to add                                                 |
| --------------------------- | ------------------------ | ---------------------------------------------------------- |
| `MerchantTransactions.tsx`  | "No transactions found"  | "Create Test Charge" → navigate to dashboard               |
| `MerchantSettlements.tsx`   | "No settlements found"   | "View Transactions" → navigate to transactions             |
| `MerchantRefunds.tsx`       | "No refunds found"       | "View Transactions" → navigate to transactions             |
| `MerchantPayouts.tsx`       | "No payouts found"       | "Add Settlement Account" → navigate to settlement accounts |
| `MerchantSubscriptions.tsx` | "No subscriptions found" | "Create Plan" → open create plan dialog                    |
| `MerchantEscrow.tsx`        | "No escrow wallets"      | "Create Escrow Wallet" → trigger create action             |


### Admin pages (inline `EmptyState` components in `AdminInterbankPayments.tsx`, `AdminBankDirectory.tsx`):

- Add CTA buttons to inline empty states where applicable (e.g., "Add Participant", "Register Bank", "Register Connector")

### Institution connector pages (6 files using `ConnectorEmptyState`):

- The component already supports `actionLabel` + `onAction` props
- Verify all usages pass these props; add where missing

### PWA pages (`Loans.tsx`, `Savings.tsx`):

- Add "Apply for a Loan" and "Open Savings Account" CTAs to their empty states (these use raw CSS classes, not the `EmptyState` component — will use the component or add inline buttons)

---

## Technical Approach

### Files to modify:

1. `supabase/functions/postman-collection/index.ts` — Add test scripts + variable chaining to all 165+ requests
2. `docs/e2e/playwright-test-plan.md` — New comprehensive test plan
3. `src/pages/merchant/MerchantTransactions.tsx` — Add `action` prop to EmptyState
4. `src/pages/merchant/MerchantSettlements.tsx` — Add `action` prop
5. `src/pages/merchant/MerchantRefunds.tsx` — Add `action` prop
6. `src/pages/merchant/MerchantPayouts.tsx` — Add `action` prop
7. `src/pages/merchant/MerchantSubscriptions.tsx` — Add `action` prop
8. `src/pages/merchant/MerchantEscrow.tsx` — Add `action` prop
9. `src/pages/admin/AdminInterbankPayments.tsx` — Add CTAs to inline empty states
10. `src/pages/admin/AdminBankDirectory.tsx` — Add CTAs to inline empty states
11. `src/pages/Loans.tsx` — Add CTA buttons
12. `src/pages/Savings.tsx` — Add CTA buttons
13. Institution connector pages — Verify/add `actionLabel` props
14. `CHANGELOG.md` — Update

### Deployment:

- Redeploy `postman-collection` edge function
- All frontend changes are additive (no breaking changes)

&nbsp;

ADD-ON DELIVERABLES (MANDATORY):

1) Postman: create 2 environments (Sandbox + Production), implement collection pre-request scripts for idempotency + auth, add tests, and provide 6 runnable E2E flows:

   - Merchant KYB lifecycle

   - Merchant key rotation

   - Merchant webhooks + delivery logs

   - Charge -> provider webhook -> final state

   - Refund -> webhook -> final

   - Dedupe test (same webhook twice)

2) Playwright: implement 3 role-based projects (admin/merchant/developer), create route inventory, run “Page Integrity” and “Form Integrity” on every page, plus “Cross-role Data Consistency” and “Payments Reliability” suites, and publish HTML reports.

3) Publish new reports:

   - POSTMAN_E2E_[REPORT.md](http://REPORT.md)

   - UI_E2E_[REPORT.md](http://REPORT.md)

   - DOCS_EXPLORER_STABILITY_[REPORT.md](http://REPORT.md)


# Plan: Full Banking API Platform Extension for CEMAC Banks

## Audit Summary

### What Already Exists (DO NOT TOUCH)
- **Bank Connectors**: 4 connector edge functions operational (`bank-api-connector`, `bank-db-connector`, `bank-file-connector`, `bank-mq-connector`)
- **Banking Ops Router**: Withdrawal policies, staff authorizations, approvals (`banking-ops`)
- **AISP/PISP**: Full endpoint suite (accounts, balances, transactions, beneficiaries, consents, payments)
- **Payment Gateway**: 8 consolidated routers (~42 endpoints)
- **KYB System**: `business-verification-workflow`, `merchant-trust-score`, `public-business-identity`
- **OAuth2/PKCE/mTLS**: Complete authentication layer
- **Developer Portal**: 100+ documentation pages, API Explorer, SDK guides, changelog, forum
- **Admin Dashboard**: 70+ pages covering transactions, KYC, disputes, settlements, branches, webhooks
- **Compliance Dashboard**: `ComplianceDashboard.tsx` with KYC/AML monitoring
- **Bank Directory**: `bank-directory`, `directory-banks-cm`
- **Interbank Engine**: ISO 20022 switch with outbox dispatch
- **Mobile Money**: charge, transfer, verify, to-bank endpoints
- **OpenAPI Spec**: v4.8.0 with 339+ endpoints

### What is MISSING (To Build)

| Gap | Priority |
|---|---|
| Unified Banking API router (`/v1/banking/*` for customer/account/transfer ops) | Critical |
| Bank Dashboard (white-label for connected banks) | Critical |
| Embeddable Widget System (Payment, Bank Connect, Verification) | Critical |
| Developer Dashboard (API keys, logs, request history in portal) | High |
| Bank Onboarding Wizard (connector setup flow) | High |
| COBAC Compliance pages + FAPI/PSD2 standards page | High |
| E2E test report endpoint | Medium |
| Changelog RSS feed | Medium |
| OpenAPI v5.0.0 with new banking endpoints | Critical |

---

## Implementation Plan (11 Steps)

### Step 1: Unified Banking API Router (Edge Function)
Create `banking-api-router/index.ts` -- a single router handling all new `/v1/banking/*` endpoints.

**Actions dispatched:**
- `list_banks` / `get_bank_status` -- read from `banks` table
- `create_customer` / `get_customer` -- CRUD on a new `banking_customers` table
- `list_accounts` / `get_account_balance` / `get_account_transactions` -- proxy to bank connectors
- `internal_transfer` / `external_transfer` / `get_transfer_status` -- orchestrate via connectors + interbank engine
- `submit_kyc` / `get_kyc_status` -- extend existing KYC flow
- `generate_report` -- COBAC-compliant transaction report

**New table**: `banking_customers` (bank_id, customer_id, external_customer_id, full_name, phone, email, kyc_status, created_at) with RLS.

No existing endpoints modified. This router calls existing connectors internally.

### Step 2: Bank Dashboard Pages
Create `/bank-dashboard/*` route group (authenticated, institution role):

- `BankDashboardHome.tsx` -- API usage metrics, connector health, transaction volumes
- `BankConnectorSetup.tsx` -- Onboarding wizard (choose connector type, configure, test)
- `BankApprovalQueue.tsx` -- Manual transaction approval for Manual Console connector banks
- `BankCustomerView.tsx` -- Customer accounts, balances, transaction history
- `BankTransferManager.tsx` -- Initiate/approve internal and external transfers
- `BankReports.tsx` -- Statement downloads (PDF, CSV, CAMT.053)
- `BankApiLogs.tsx` -- Real-time API call logs

All pages use existing Supabase queries and edge function calls. No new backend required beyond Step 1.

### Step 3: Embeddable Widget System
Create `src/components/widgets/` with three embeddable React components:

- `EmbeddablePaymentWidget.tsx` -- Drop-in checkout using gateway charges API
- `EmbeddableBankConnectWidget.tsx` -- Account linking flow via AISP consent
- `EmbeddableVerificationWidget.tsx` -- KYC/KYB document upload and status

Each widget:
- Renders standalone at `/widgets/payment`, `/widgets/bank-connect`, `/widgets/verify`
- Supports iframe embedding with `postMessage` communication
- Accepts config via URL params (bank_id, theme, amount, currency)
- Uses secure token exchange (existing OAuth2)

Create `WidgetSDKPage.tsx` in developer portal with embed code snippets and JS SDK usage.

### Step 4: Developer Dashboard Enhancement
Create `/developer/dashboard/*` pages (authenticated developers):

- `DeveloperDashboardHome.tsx` -- API key management, usage stats
- `DeveloperRequestHistory.tsx` -- Recent API calls with request/response logs
- `DeveloperWebhookMonitor.tsx` -- Webhook delivery status, retry history

These pages query existing tables (`api_keys`, `webhook_deliveries`, `api_usage_logs`).

### Step 5: Open Banking Compliance Pages
Create public pages:

- `/open-banking/standards` -- FAPI 1.0, COBAC, PSD2 alignment matrix
- `/open-banking/security` -- mTLS, encryption, audit trail whitepaper
- `/bank-onboarding` -- Step-by-step connector setup guide for banks

### Step 6: OpenAPI Spec v5.0.0
Update `public/openapi.json` with:
- All new `/v1/banking/*` endpoints (customers, accounts, transfers, reports)
- `x-bank-connector` extension on bank-specific operations
- New schemas: `BankingCustomer`, `BankConnectorStatus`, `COBACReport`
- Version bump to 5.0.0 (new endpoint group = minor, but banking API is a major milestone)

Per Standing Order 6, this is a minor version (new endpoints, no removals). Will use v4.9.0 instead.

### Step 7: Changelog v4.9.0
Add v4.9.0 entry to `Changelog.tsx` documenting:
- All new banking endpoints
- Widget system
- Bank dashboard
- Developer dashboard enhancements
- COBAC compliance pages

Add RSS feed at `/developer/changelog.xml` (static XML generation).

### Step 8: Demo Bank Seed Data
Create `seed-demo-banks` edge function that populates:
- BANK001 (Afriland, API Connector)
- BANK002 (UBA Cameroon, File Connector)
- BANK003 (Local CU, Manual Console)

Each with sample customers, accounts, transactions.

### Step 9: E2E Test Report
Create `/developer/test-report` page showing automated test results:
- Connector health checks
- Endpoint response validation
- Webhook delivery verification
- Idempotency verification
- Auth scope enforcement

### Step 10: Updated Postman Collection + SDK Extensions
Update `postman-collection` edge function to include new banking endpoints.
Add banking examples to SDK pages (Node.js, Python, PHP, cURL, Go, Java).

### Step 11: Architecture Diagram
Generate Mermaid diagram showing:
- Bank Connector Layer (4 types)
- Unified Banking API Router
- Existing KOB Core
- Widget System
- Dashboard Layer

---

## Database Changes

| Table | Purpose | RLS |
|---|---|---|
| `banking_customers` | Bank-managed customer profiles | Bank-scoped via institution_id |
| `banking_api_logs` | API request/response audit trail | Developer-scoped |
| `widget_sessions` | Ephemeral widget token sessions | Service role only |

No existing tables modified.

## Files Created/Modified Summary

| Category | Count |
|---|---|
| New edge functions | 2 (banking-api-router, seed-demo-banks) |
| New React pages | ~15 (bank dashboard, widgets, compliance, developer dashboard) |
| New React components | ~10 (widgets, dashboard components) |
| Modified files | ~5 (App.tsx routes, Changelog, OpenAPI spec, Postman) |
| New documentation | 3 pages (standards, security, bank-onboarding) |
| Database migrations | 1 (3 new tables) |

## Execution Order

1. Database migration (banking_customers, banking_api_logs, widget_sessions)
2. Banking API Router edge function
3. Bank Dashboard pages (7 pages)
4. Embeddable Widget System (3 widgets + SDK page)
5. Developer Dashboard pages (3 pages)
6. Compliance pages (3 pages)
7. OpenAPI spec update to v4.9.0
8. Changelog + RSS feed
9. Demo bank seed data
10. Test report page
11. Postman + SDK updates
12. Architecture diagram




# Kang Open Banking - Full Audit and Build Plan (15 Checkpoints)

## Scope Assessment

This is a comprehensive audit and build initiative covering the entire KOB platform: 150+ edge functions, 75+ database migrations, full API spec alignment, and new domain implementations. The platform is built on React/Vite (frontend) with Supabase Edge Functions (backend) and Postgres (database).

---

## Current State Summary

**What exists today:**
- 150+ edge functions across OAuth, AISP, PISP, Savings, Loans, Mobile Money, Flutterwave, Certificates, Admin, KYC, CrediQ, WooCommerce, ISO20022, SWIFT, and more
- 75+ database migrations with tables for accounts, consents, payments, savings, loans, certificates, and compliance
- OpenAPI spec served dynamically via `public-api-spec` edge function (4,139 lines)
- Postman collection served via `postman-collection` edge function
- Shared middleware: role-based auth, security utilities, mTLS support, token validation
- Public docs site at `/documentation` with SEO, sitemap, robots.txt

**What is missing or needs work:**
- No `/v1` prefix on any endpoints (all are flat function names)
- No idempotency support on any write endpoint
- No ledger/double-entry accounting system (no tables, no functions)
- No Redis (not available in Supabase Edge Functions environment)
- Savings exists but lacks interest accrual job endpoint
- Loans exist but lack schedule generation, repayment allocation, and full lifecycle
- No contract tests or test infrastructure
- OpenAPI spec is v3.0.3, not v3.1; not fully aligned with all implemented endpoints
- No seed script

---

## Checkpoint-by-Checkpoint Plan

### CHECKPOINT 1: Repo Boot + Inventory

**Actions:**
- Create `/docs/inventory.md` documenting:
  - Backend: Supabase Edge Functions (Deno runtime), Postgres via Lovable Cloud
  - All 150+ edge functions listed with their JWT verification status
  - Environment variables (from `.env` and Supabase secrets)
  - How to run locally (npm run dev for frontend; edge functions deploy automatically)
- Verify the application builds and runs via the preview URL

**Output:** `/docs/inventory.md`

---

### CHECKPOINT 2: Spec Reconciliation (Gap Report)

**Actions:**
- Parse the existing `public-api-spec` edge function (4,139 lines of OpenAPI)
- Parse the `postman-collection` edge function
- Cross-reference with all 150+ implemented edge functions
- Generate gap table: Endpoint | In OpenAPI | In Postman | In Backend | Fix Action | Priority

**Key gaps already identified:**
- Many edge functions exist in code but may not be in OpenAPI/Postman (e.g., CrediQ endpoints, WooCommerce endpoints, PostiQ endpoints)
- No `/v1` prefix anywhere
- Missing tags for some domains

**Output:** `/docs/gap-report.md`

---

### CHECKPOINT 3: Target API Design (Single Source of Truth)

**Actions:**
- Rewrite the `public-api-spec` edge function to serve OpenAPI 3.1 spec with all paths under `/v1`
- Add schemas for: Error model (RFC 7807 style), Pagination, Idempotency headers, Status lifecycle enums
- Add examples in XAF and Cameroon context
- Create `/docs/api-styleguide.md` covering:
  - Error format: `{ error, error_code, details, error_id }`
  - Pagination: cursor-based with `limit`, `offset`, `total`
  - Idempotency: `Idempotency-Key` header on all POST/PUT endpoints
  - Status lifecycles for payments, consents, loans, savings

**Note on `/v1` prefix:** Since Supabase Edge Functions are invoked by function name (e.g., `/functions/v1/aisp-accounts`), the `/v1` is already implicit in the URL path. The OpenAPI spec will document paths as `/v1/aisp/accounts` etc. with the custom domain routing handling the mapping. Deprecated aliases will be documented for any renamed endpoints.

**Output:** Updated `public-api-spec` function, `/docs/api-styleguide.md`

---

### CHECKPOINT 4: DB Schema + Migrations + Seed

**Actions:**
- Create migration for missing tables:
  - `idempotency_keys` (key, response, status, created_at, expires_at)
  - `ledger_accounts` (id, account_type, name, currency, balance, institution_id)
  - `journal_entries` (id, entry_date, description, reference_type, reference_id)
  - `journal_lines` (id, journal_entry_id, ledger_account_id, debit, credit)
  - `loan_schedule` (id, loan_id, installment_number, due_date, principal, interest, fees, status)
  - `loan_repayments` (id, loan_id, schedule_id, amount, principal_paid, interest_paid, fees_paid)
  - `loan_events` (id, loan_id, event_type, metadata, created_at)
  - `interest_accruals` (id, savings_account_id, accrual_date, rate, amount, balance_before, balance_after)
  - `payment_routes` (id, payment_id, rail, external_ref, status)
  - `payment_events` (id, payment_id, event_type, metadata)
  - `webhook_inbox` (id, source, payload, signature, processed, created_at)
- Existing tables that are already present: tenants(institutions), users(profiles), api_clients, certificates(client_certificates), consents(aisp_consents/pisp_consents), payments, savings_products, savings_accounts, savings_transactions, loan_products, loan_applications
- Create seed script for test/demo data
- Create `/docs/db-schema.md`

**Output:** Migration SQL, seed script, `/docs/db-schema.md`

---

### CHECKPOINT 5: Auth + Directory Implementation

**Already implemented:**
- `oauth-token` with PKCE, mTLS, rate limiting
- `oauth-authorize`, `oauth-introspect`, `par-endpoint`, `dcr-register`
- `jwks-endpoint`, `oidc-config`
- `certificate-upload`, `certificate-list`, `certificate-revoke`
- `api-health`, `system-health-check`
- Role middleware with admin gating

**Actions needed:**
- Add a `/v1/ready` endpoint (simple readiness probe)
- Ensure all auth endpoints have adequate test coverage
- Add idempotency support to `dcr-register`
- Update OpenAPI spec entries

**Output:** New `api-ready` edge function, test documentation

---

### CHECKPOINT 6: AISP Implementation

**Already implemented:**
- `aisp-accounts`, `aisp-balances`, `aisp-transactions`
- `aisp-beneficiaries`, `aisp-standing-orders`, `aisp-direct-debits`
- `aisp-create-consent`, `consent-authorize`, `consent-revoke`

**Actions needed:**
- Ensure pagination/filtering on `aisp-transactions` (verify cursor/offset params)
- Add integration test examples
- Create `/docs/aisp-examples.md` with curl samples

**Output:** `/docs/aisp-examples.md`

---

### CHECKPOINT 7: PISP Payments

**Already implemented:**
- `pisp-create-consent`, `pisp-domestic-payment`, `pisp-payment-details`, `pisp-payment-submission`

**Actions needed:**
- Add idempotency support to payment submission
- Add `payment_events` tracking on status transitions
- Ensure status lifecycle: `pending` -> `authorized` -> `submitted` -> `completed`/`failed`
- Create event subscription mechanism via webhooks
- Create `/docs/pisp-examples.md`

**Output:** Updated PISP functions with idempotency, `/docs/pisp-examples.md`

---

### CHECKPOINT 8: Rails - Flutterwave + Webhooks

**Already implemented:**
- `facilitated-mobile-money-charge`, `flutterwave-bank-transfer`, `flutterwave-transfer-webhook`
- `flutterwave-list-banks`, `flutterwave-verify-bank`
- Webhook signature verification exists in `flutterwave-transfer-webhook`

**Actions needed:**
- Add webhook deduplication via `webhook_inbox` table
- Add reconciliation logic for stuck payments (recon job)
- Ensure webhook signature failure returns 401 without mutating state (already partially done)
- Create `/docs/flutterwave-integration.md`

**Output:** Updated webhook handler with dedupe, `/docs/flutterwave-integration.md`

---

### CHECKPOINT 9: Ledger (Double-Entry)

**Not yet implemented - NEW BUILD**

**Actions:**
- Create `ledger-accounts`, `journal-post`, `ledger-balance` edge functions
- Implement posting rules:
  - Payment received: DR Cash, CR Revenue
  - Loan disbursement: DR Loan Receivable, CR Cash
  - Loan repayment: DR Cash, CR Loan Receivable + CR Interest Income
  - Savings deposit: DR Cash, CR Customer Liability
  - Savings withdrawal: DR Customer Liability, CR Cash
  - Interest accrual: DR Interest Expense, CR Interest Payable
- Ensure balanced journal entries (sum of debits = sum of credits)
- Admin-only access via role middleware

**Output:** New edge functions, migration, `/docs/ledger-model.md`

---

### CHECKPOINT 10: Savings (Full Lifecycle)

**Partially implemented:**
- `savings-create`, `savings-deposit`, `savings-withdraw` exist
- `savings_products`, `savings_accounts`, `savings_transactions` tables exist

**Actions needed:**
- Create `savings-accrue-interest` edge function (cron-compatible)
- Create `interest_accruals` table for tracking
- Integrate with ledger (post journal entries on deposit/withdraw/accrue)
- Create `/docs/savings-guide.md`

**Output:** New interest accrual function, `/docs/savings-guide.md`

---

### CHECKPOINT 11: Loans (Full Lifecycle)

**Partially implemented:**
- `loan-apply`, `loan-calculate`, `loan-repay` exist
- `loan_products`, `loan_applications` tables exist

**Actions needed:**
- Create `loan-approve` edge function (admin)
- Create `loan-disburse` edge function (with ledger posting)
- Create `loan-generate-schedule` edge function
- Create `loan_schedule`, `loan_repayments`, `loan_events` tables
- Implement repayment allocation (principal/interest/fees split)
- Integrate with ledger
- Create `/docs/loans-guide.md`

**Output:** New loan lifecycle functions, migration, `/docs/loans-guide.md`

---

### CHECKPOINT 12: Admin + Audit + Reporting

**Partially implemented:**
- `admin-metrics`, `admin-transaction-review`, `admin-webhooks`, `admin-system-config` exist
- `audit_logs`, `security_audit_logs`, `compliance_reports` tables exist
- `generate_compliance_report` DB function exists

**Actions needed:**
- Add admin listing endpoints for loans, savings, consents with filtering
- Ensure RBAC enforcement on all admin endpoints (already using role middleware)
- Create `/docs/admin-api.md`

**Output:** `/docs/admin-api.md`

---

### CHECKPOINT 13: Postman + Contract Tests

**Actions:**
- Update the `postman-collection` edge function to match all endpoints in OpenAPI
- Ensure 1:1 correspondence between OpenAPI paths and Postman requests
- Create contract test documentation showing response schema validation
- Export as `/docs/kob.postman_collection.json` (static file)

**Output:** `/docs/kob.postman_collection.json`, `/docs/contract-test-report.md`

---

### CHECKPOINT 14: Public Docs - Indexable

**Already implemented:**
- Documentation page at `/documentation` with SSR-friendly React rendering
- `robots.txt` allows crawling of all documentation paths
- SEO component with meta tags, OG tags, canonical URLs
- Sitemap reference in robots.txt

**Actions needed:**
- Add downloadable OpenAPI YAML/JSON and Postman collection links (already partially done)
- Verify no `noindex` headers/tags on documentation pages
- Add tag-based navigation for API domains
- Create `/docs/docs-publish.md` with indexing checklist

**Output:** `/docs/docs-publish.md`, verified indexing

---

### CHECKPOINT 15: Final Report

**Actions:**
- Create `/docs/final-gap-closure-report.md` with:
  - Original issues and resolutions
  - Endpoint coverage table (target: 100%)
  - Test coverage metrics
  - Remaining TODOs
  - Run instructions and deployment notes
  - PASS/FAIL matrix for all checkpoints

**Output:** `/docs/final-gap-closure-report.md`

---

## Important Constraints and Notes

1. **Redis:** Supabase Edge Functions do not support Redis. Rate limiting is handled via Postgres `rate_limits` table with the `check_rate_limit` DB function. This is functionally equivalent for the current scale.

2. **No terminal access:** All changes are made through Lovable's file editing and migration tools. No CLI commands can be run directly.

3. **Edge function deployment:** Functions deploy automatically when code is written. No manual deployment step needed.

4. **Implementation order:** Checkpoints 1-3 (documentation/inventory) will be done first, then 4 (DB schema), then 5-12 (implementation), then 13-15 (validation/docs).

5. **Scope management:** This is an extremely large undertaking. Each checkpoint will be implemented incrementally, with the most critical gaps (idempotency, ledger, loan lifecycle) prioritized.

## Technical Details

### New Database Tables Required
- `idempotency_keys`: Prevents duplicate processing of write operations
- `ledger_accounts`, `journal_entries`, `journal_lines`: Double-entry accounting
- `loan_schedule`, `loan_repayments`, `loan_events`: Full loan lifecycle
- `interest_accruals`: Savings interest tracking
- `payment_events`, `payment_routes`: Payment status tracking
- `webhook_inbox`: Webhook deduplication

### New Edge Functions Required
- `api-ready`: Readiness probe
- `ledger-accounts`, `journal-post`, `ledger-balance`: Ledger system
- `savings-accrue-interest`: Interest calculation cron
- `loan-approve`, `loan-disburse`, `loan-generate-schedule`: Loan lifecycle

### Files to Create/Update
- 10+ new edge functions
- 1 large database migration
- 1 seed script
- 10+ documentation files in `/docs/`
- Updated `public-api-spec` and `postman-collection` functions


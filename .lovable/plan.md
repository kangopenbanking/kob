

# Update Admin, Institution, and Developer Backends to v1 API Standards

## Problem Summary

After auditing all admin, institution, and developer-facing pages, there are **systemic issues** across the codebase where API endpoint paths, error models, authentication patterns, and documentation do not align with the v1 API standards established in Checkpoints 1-15.

---

## Issues Found

### A. Admin Pages

**1. `src/pages/admin/ApiDocumentation.tsx` (Admin Swagger Generator)**
- OpenAPI version says `3.0.0` -- should be `3.1.0`
- Only 31 endpoints listed; missing ~40+ endpoints added in checkpoints (loan-approve, loan-disburse, savings-accrue-interest, journal-post, ledger-accounts, ledger-balance, admin-list-loans, admin-list-savings, admin-list-consents, admin-reports, pisp-payment-submission, pisp-payment-details, mobile-money-verify, mobile-money-to-bank, dcr-register, oauth-authorize, par-request, etc.)
- Server URL exposes raw Supabase project URL -- should use `https://api.kangopenbanking.com/v1`
- Error schema only has `error` and `message` -- missing RFC 7807 fields: `error_code`, `details`, `error_id`, `timestamp`
- Missing tags: Admin, Ledger, DCR/Registration
- Paths use bare function names (`/aisp-accounts`) not v1-prefixed paths (`/v1/aisp/accounts`)
- Title says "KoB Banking API" -- should be "Kang Open Banking API"
- Counter text says "70+" but only 31 endpoints

**2. `src/pages/admin/ApiTesting.tsx` (Admin API Tester)**
- Same 31-endpoint list as ApiDocumentation, missing the same ~40+ endpoints
- No Idempotency-Key header support for POST endpoints
- Missing categories: Admin, Ledger, DCR

### B. Developer Pages

**3. `src/pages/developer/GettingStarted.tsx`**
- OAuth token URL uses `/oauth-token` instead of `/v1/oauth/token`
- AISP accounts URL uses `/aisp-accounts` instead of `/v1/aisp/accounts`
- Token request sends JSON body but the v1 spec requires `application/x-www-form-urlencoded`
- Missing DCR step (register via SSA before obtaining tokens)
- Missing `x-consent-id` header in AISP examples
- Stale dates (2025 instead of 2026)

**4. `src/pages/developer/QuickStart.tsx`**
- All URLs use `/functions/v1/oauth-token` and `/functions/v1/aisp-accounts` -- should be `https://api.kangopenbanking.com/v1/oauth/token` and `/v1/aisp/accounts`
- OAuth token request sends JSON instead of form-encoded
- Missing `x-consent-id` header in account fetch example
- Missing Idempotency-Key mention

**5. `src/pages/developer/AispReference.tsx`**
- Endpoints use bare function names: `/aisp-create-consent`, `/aisp-accounts`, `/aisp-balances/{accountId}`, `/api-account-detail/{accountId}`
- Should use: `/v1/aisp/consents`, `/v1/aisp/accounts`, `/v1/aisp/accounts/{accountId}/balances`, `/v1/aisp/accounts/{accountId}`
- Stale dates (2025)
- Missing pagination parameters in transactions endpoint
- Missing RFC 7807 error examples

**6. `src/pages/developer/PispReference.tsx`**
- Same bare function name pattern: `/pisp-create-consent`, `/pisp-domestic-payment`, `/pisp-payment-submission`, `/pisp-payment-details/{paymentId}`
- Should use: `/v1/pisp/consents`, `/v1/pisp/domestic-payments`, `/v1/pisp/payment-submissions`, `/v1/pisp/domestic-payments/{paymentId}`
- Payment status lifecycle uses `AcceptedSettlementInProgress` / `AcceptedSettlementCompleted` instead of the v1 standard: `pending -> authorized -> submitted -> completed`
- Error codes use generic names (`INSUFFICIENT_FUNDS`) instead of domain-prefixed codes (`PISP_004`)
- Missing Idempotency-Key header in POST examples
- Stale dates (2025)

**7. `src/pages/developer/MobileMoneyReference.tsx`**
- Endpoints use bare function names: `/mobile-money-charge`, `/mobile-money-verify`, `/mobile-money-transfer`, `/mobile-money-to-bank`
- Should use: `/v1/mobile-money/charge`, `/v1/mobile-money/verify`, `/v1/mobile-money/transfer`, `/v1/mobile-money/to-bank`
- Error codes use generic names instead of domain-prefixed codes (`MM_001`)
- Missing Idempotency-Key headers on POST examples
- Webhook event format doesn't match v1 standard envelope

**8. `src/pages/developer/BankingReference.tsx`**
- Same bare function name pattern for all endpoints
- Should use v1 paths: `/v1/banking/reconcile`, `/v1/banking/statement`, etc.
- Stale dates

**9. `src/pages/developer/CertificateReference.tsx`**
- Paths show `/functions/v1/certificate-upload`, `/functions/v1/certificate-list`, `/functions/v1/certificate-revoke`
- Should use: `/v1/certificates/upload`, `/v1/certificates/list`, `/v1/certificates/revoke`

**10. `src/pages/developer/CodeExamples.tsx`**
- All code examples use bare endpoint paths (`/aisp-accounts`, `/pisp-create-consent`, `/oauth-token`)
- No Idempotency-Key headers in payment examples
- Missing `x-consent-id` header in some examples

**11. `src/pages/developer/ApiPlayground.tsx`**
- Uses `API_CONFIG.BASE_URL` which resolves to `/functions/v1` path -- correct for internal calls, but displayed paths lack v1 prefixing for user-facing documentation
- Limited endpoint list (only 5 endpoints)

### C. Institution Pages

**12. `src/pages/institution/InstitutionApiClients.tsx`**
- Functionally correct (uses Supabase client directly, not API paths)
- Missing display of OAuth scopes aligned with v1 standard (`openid`, `accounts`, `balances`, `transactions`, `payments`, `offline_access`)
- No mention of rate tier information

---

## Implementation Plan

### Phase 1: Admin Pages (2 files)

**File: `src/pages/admin/ApiDocumentation.tsx`**
- Update `EDGE_FUNCTIONS` array from 31 to ~70+ endpoints covering all domains
- Add missing categories: Admin, Ledger, DCR/Registration
- Update all paths to use v1-prefixed format (e.g., `/v1/aisp/accounts`)
- Change OpenAPI version from `3.0.0` to `3.1.0`
- Update server URL to `https://api.kangopenbanking.com/v1`
- Update title to "Kang Open Banking API"
- Expand Error schema to include all 6 RFC 7807 fields (`error`, `error_code`, `message`, `details`, `error_id`, `timestamp`)
- Add missing tags: Admin, Ledger, DCR, ISO20022
- Update counter text to reflect actual endpoint count

**File: `src/pages/admin/ApiTesting.tsx`**
- Sync `API_ENDPOINTS` array with the updated list from ApiDocumentation
- Add Idempotency-Key header input for POST endpoints
- Add missing categories and endpoints

### Phase 2: Developer Pages (8 files)

**File: `src/pages/developer/GettingStarted.tsx`**
- Update all URLs to use `https://api.kangopenbanking.com/v1/oauth/token` and `/v1/aisp/accounts`
- Fix token request to use `application/x-www-form-urlencoded` content type
- Add DCR registration as Step 1 (before obtaining tokens)
- Update dates to 2026
- Add `x-consent-id` header to AISP examples

**File: `src/pages/developer/QuickStart.tsx`**
- Replace all `/functions/v1/` URLs with `https://api.kangopenbanking.com/v1/`
- Fix OAuth token request from JSON to form-encoded
- Add `x-consent-id` header to account examples
- Update dates to 2026

**File: `src/pages/developer/AispReference.tsx`**
- Replace all endpoint paths with v1 format:
  - `/aisp-create-consent` -> `/v1/aisp/consents`
  - `/aisp-accounts` -> `/v1/aisp/accounts`
  - `/aisp-balances/{accountId}` -> `/v1/aisp/accounts/{accountId}/balances`
  - `/api-account-detail/{accountId}` -> `/v1/aisp/accounts/{accountId}`
  - `/aisp-transactions/{accountId}` -> `/v1/aisp/accounts/{accountId}/transactions`
  - `/aisp-beneficiaries/{accountId}` -> `/v1/aisp/accounts/{accountId}/beneficiaries`
  - `/aisp-standing-orders/{accountId}` -> `/v1/aisp/accounts/{accountId}/standing-orders`
  - `/aisp-direct-debits/{accountId}` -> `/v1/aisp/accounts/{accountId}/direct-debits`
- Add pagination parameters to transactions endpoint
- Update dates to 2026

**File: `src/pages/developer/PispReference.tsx`**
- Replace all endpoint paths with v1 format:
  - `/pisp-create-consent` -> `/v1/pisp/consents`
  - `/pisp-domestic-payment` -> `/v1/pisp/domestic-payments`
  - `/pisp-payment-submission` -> `/v1/pisp/payment-submissions`
  - `/pisp-payment-details/{paymentId}` -> `/v1/pisp/domestic-payments/{paymentId}`
  - `/bulk-transfers` -> `/v1/pisp/bulk-transfers`
  - `/swift-mt103-generator` -> `/v1/banking/swift/mt103`
- Update payment status lifecycle to match v1: `pending -> authorized -> submitted -> completed / failed / cancelled`
- Replace error codes with domain-prefixed versions (e.g., `PISP_004` for insufficient funds)
- Add `Idempotency-Key` header to POST examples
- Update dates to 2026

**File: `src/pages/developer/MobileMoneyReference.tsx`**
- Replace endpoint paths with v1 format:
  - `/mobile-money-charge` -> `/v1/mobile-money/charge`
  - `/mobile-money-verify` -> `/v1/mobile-money/verify`
  - `/mobile-money-transfer` -> `/v1/mobile-money/transfer`
  - `/mobile-money-to-bank` -> `/v1/mobile-money/to-bank`
- Replace error codes with MM_-prefixed codes
- Add `Idempotency-Key` header to POST examples
- Update webhook event format to match v1 standard

**File: `src/pages/developer/BankingReference.tsx`**
- Replace all endpoint paths with v1 format
- Update dates to 2026

**File: `src/pages/developer/CertificateReference.tsx`**
- Replace paths:
  - `/functions/v1/certificate-upload` -> `/v1/certificates/upload`
  - `/functions/v1/certificate-list` -> `/v1/certificates/list`
  - `/functions/v1/certificate-revoke` -> `/v1/certificates/revoke`

**File: `src/pages/developer/CodeExamples.tsx`**
- Update all API_BASE references from `https://api.kangopenbanking.com` to `https://api.kangopenbanking.com/v1`
- Update all endpoint paths to v1 format
- Add `Idempotency-Key` headers to payment POST examples

### Phase 3: Developer Portal Markdown Files (6 files)

Create the 6 production-ready markdown files in `docs/portal/`:

1. **`docs/portal/quickstart.md`** -- 5-minute onboarding with DCR, OAuth, and first AISP call
2. **`docs/portal/authentication.md`** -- OAuth grants, DCR, mTLS, scopes, rate limits
3. **`docs/portal/aisp-guide.md`** -- Consent lifecycle, all 7 AISP endpoints with pagination
4. **`docs/portal/pisp-guide.md`** -- Payment lifecycle, idempotency rules, status polling
5. **`docs/portal/error-reference.md`** -- RFC 7807 schema, all domain error code catalogues
6. **`docs/portal/flutterwave-setup.md`** -- Mobile money and bank transfer flows, webhook verification

All portal docs will use the v1 path format, current dates (2026), RFC 7807 error examples, and Idempotency-Key headers throughout.

---

## Technical Details

### v1 Path Convention
All user-facing documentation will reference paths as:
```text
https://api.kangopenbanking.com/v1/{domain}/{resource}
```
These map to edge functions internally, but developers see clean RESTful paths.

### Files Changed Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `src/pages/admin/ApiDocumentation.tsx` | Update | 70+ endpoints, v1 paths, OpenAPI 3.1, RFC 7807 errors |
| `src/pages/admin/ApiTesting.tsx` | Update | Sync endpoints, add Idempotency-Key support |
| `src/pages/developer/GettingStarted.tsx` | Update | v1 URLs, form-encoded auth, DCR step, 2026 dates |
| `src/pages/developer/QuickStart.tsx` | Update | v1 URLs, form-encoded auth, consent headers |
| `src/pages/developer/AispReference.tsx` | Update | v1 paths for all 8 endpoints, pagination, 2026 dates |
| `src/pages/developer/PispReference.tsx` | Update | v1 paths, status lifecycle, PISP_ error codes, idempotency |
| `src/pages/developer/MobileMoneyReference.tsx` | Update | v1 paths, MM_ error codes, idempotency, webhook format |
| `src/pages/developer/BankingReference.tsx` | Update | v1 paths, 2026 dates |
| `src/pages/developer/CertificateReference.tsx` | Update | v1 paths |
| `src/pages/developer/CodeExamples.tsx` | Update | v1 base URL and paths, idempotency headers |
| `docs/portal/quickstart.md` | Create | Public quickstart guide |
| `docs/portal/authentication.md` | Create | OAuth/DCR/mTLS reference |
| `docs/portal/aisp-guide.md` | Create | AISP consent + endpoints guide |
| `docs/portal/pisp-guide.md` | Create | PISP lifecycle + idempotency guide |
| `docs/portal/error-reference.md` | Create | Complete error code catalogue |
| `docs/portal/flutterwave-setup.md` | Create | Flutterwave integration guide |

Total: **10 files updated + 6 files created = 16 files**


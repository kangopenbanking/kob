

# Full Health Audit: Developer Pages and Admin Pages -- v1 API Alignment

## Audit Summary

Audited all 30 developer pages and 29 admin pages. Found **7 files with legacy issues** requiring updates.

---

## Pages PASSING (No Changes Needed)

### Developer Pages (23 of 30 passing)
- DeveloperHome.tsx -- Clean, no API paths
- GettingStarted.tsx -- All v1 paths, form-encoded OAuth, x-consent-id
- QuickStart.tsx -- All v1 paths, form-encoded OAuth
- AispReference.tsx -- All /v1/aisp/ paths, 2026 dates
- PispReference.tsx -- All /v1/pisp/ paths, Idempotency-Key, 2026 dates
- MobileMoneyReference.tsx -- All /v1/mobile-money/ paths, Idempotency-Key, 2026 dates
- BankingReference.tsx -- All /v1/banking/ paths, ISO 20022, SWIFT, 2026 dates
- CertificateReference.tsx -- /v1/certificates/ paths, Idempotency-Key
- CodeExamples.tsx -- All v1 paths, Idempotency-Key, RFC 7807 error handling
- Changelog.tsx -- v2.0.0 entry dated 2026-02-16 (older releases keep historical dates, correct)
- SDKsPage.tsx -- No API path issues
- Sandbox.tsx -- Internal edge function calls via supabase.functions.invoke (correct)
- SandboxDataGenerator.tsx -- Internal calls only
- SandboxUsage.tsx -- Internal calls only
- SandboxWebhooks.tsx -- Internal calls only
- WebhookTesting.tsx -- Internal calls only
- CreditScoreTesting.tsx -- Internal calls only
- MobileIntegration.tsx -- No API path issues
- WebIntegration.tsx -- No API path issues
- ApiKeys.tsx -- Internal calls only
- CertificateManagement.tsx -- Internal calls only
- ApiDirectorySubmissions.tsx -- Postman collection URL uses /functions/v1/ but this is a valid edge function URL (acceptable for direct function access)

### Admin Pages (29 of 29 passing)
All admin pages use `import.meta.env.VITE_SUPABASE_URL` + `/functions/v1/` for runtime API calls, which is the correct internal pattern. Admin pages are not public documentation -- they make actual function invocations, not documentation examples. No changes needed.

---

## Pages FAILING (7 files need updates)

### 1. `src/pages/developer/ApiConsole.tsx`
**Issues:**
- Lines 17-39: `API_ENDPOINTS` array uses legacy edge function names (`/aisp-accounts`, `/pisp-create-consent`, `/mobile-money-charge`, `/bank-reconcile`, etc.) instead of v1 paths
- Line 46: Date `2025-12-31` in consent example body
- Line 153: curl URL generated as `https://api.kangopenbanking.com/aisp-accounts` (missing `/v1/` prefix)

**Fix:** Update all endpoint values to use `/v1/` prefix format:
- `/aisp-accounts` to `/v1/aisp/accounts`
- `/aisp-balances/{accountId}` to `/v1/aisp/accounts/{accountId}/balances`
- `/aisp-transactions/{accountId}` to `/v1/aisp/accounts/{accountId}/transactions`
- `/aisp-create-consent` to `/v1/aisp/consents`
- `/pisp-create-consent` to `/v1/pisp/consents`
- `/pisp-domestic-payment` to `/v1/pisp/domestic-payments`
- `/pisp-payment-submission` to `/v1/pisp/payment-submissions`
- `/pisp-payment-details/{paymentId}` to `/v1/pisp/domestic-payments/{paymentId}`
- `/mobile-money-charge` to `/v1/mobile-money/charge`
- `/mobile-money-verify` to `/v1/mobile-money/verify`
- `/mobile-money-transfer` to `/v1/mobile-money/transfer`
- `/mobile-money-to-bank` to `/v1/mobile-money/to-bank`
- `/bank-reconcile` to `/v1/banking/reconcile`
- `/generate-bank-statement` to `/v1/banking/statement`
- `/iso20022-pain001-parser` to `/v1/banking/iso20022/pain001`
- `/swift-mt103-generator` to `/v1/banking/swift/mt103/generate`
- Update consent expiration date from `2025` to `2026`
- Add `Idempotency-Key` to default headers for POST endpoints

### 2. `src/pages/developer/Playground.tsx`
**Issues:**
- Lines 79, 82: curl command generates `https://api.kangopenbanking.com/functions/v1/${selectedEndpoint}` -- uses legacy `/functions/v1/` path instead of `/v1/`

**Fix:** Change curl URL pattern from `/functions/v1/${selectedEndpoint}` to `/v1/${selectedEndpoint}` and update endpoint values to match v1 naming

### 3. `src/pages/developer/AIIntegrationGuide.tsx`
**Issues:**
- Line 219, 223: Postman collection URL uses `/functions/v1/postman-collection` -- acceptable as direct edge function URL, but the code examples below are wrong
- Line 301: `${this.baseUrl}/functions/v1/oauth-token` -- should be `${this.baseUrl}/v1/oauth/token`
- Line 317: `${this.baseUrl}/functions/v1/aisp-accounts` -- should be `${this.baseUrl}/v1/aisp/accounts`
- Line 331: `${this.baseUrl}/functions/v1/aisp-balances/${accountId}` -- should be `${this.baseUrl}/v1/aisp/accounts/${accountId}/balances`
- OAuth token request sends JSON body -- should use `application/x-www-form-urlencoded`
- Missing `x-consent-id` header in AISP examples

**Fix:** Update all 3 API paths in the KangOpenBanking class code example to v1 format, fix OAuth content type, add x-consent-id header

### 4. `src/pages/developer/WebhooksGuide.tsx`
**Issues:**
- Line 165: `"created_at": "2025-10-27T10:30:00Z"` -- should be `2026-`
- Line 182: `"reference": "INV-2025-001"` -- should be `INV-2026-001`
- Line 183: `"created_at": "2025-10-27T10:00:00Z"` -- should be `2026-`
- Line 184: `"completed_at": "2025-10-27T10:30:00Z"` -- should be `2026-`

**Fix:** Update all 4 dates from 2025 to 2026

### 5. `src/pages/developer/PaymentFacilitation.tsx`
**Issues:**
- Lines 282-283: `"period_start": "2025-01-01T00:00:00Z"` and `"period_end": "2025-01-31T23:59:59Z"` -- should be `2026-`
- Lines 298-299: Same dates in response example

**Fix:** Update all 4 dates from 2025 to 2026

### 6. `src/pages/Documentation.tsx`
**Issue:**
- Line 322: Still shows `Authorization: Bearer YOUR_API_KEY` -- should use `{access_token}` to match OAuth pattern

**Fix:** Replace `YOUR_API_KEY` with `{access_token}`

### 7. `src/pages/integrations/WooCommercePluginCode.tsx`
**Issue:**
- Line 68: `define('WFK_API_BASE_URL', 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1')` -- exposes raw project URL

**Fix:** Replace with `https://api.kangopenbanking.com/v1`

---

## Admin Pages -- Not Needing Changes

The admin pages (`ApiHealthDashboard.tsx`, `WooCommerceManagement.tsx`) use `import.meta.env.VITE_SUPABASE_URL + /functions/v1/` for runtime edge function calls. This is the correct internal invocation pattern -- these are actual API calls, not documentation examples. No changes needed.

The `ApiExplorer.tsx` fallback URL exposes the raw project URL but only as a programmatic fallback when the custom domain fails. This is acceptable for resilience.

---

## Implementation Plan

### File 1: `src/pages/developer/ApiConsole.tsx`
- Replace all 16 endpoint values in `API_ENDPOINTS` with v1 path format
- Update consent example body date from 2025 to 2026
- Add Idempotency-Key to default POST headers

### File 2: `src/pages/developer/Playground.tsx`
- Update curl URL pattern from `/functions/v1/` to `/v1/`

### File 3: `src/pages/developer/AIIntegrationGuide.tsx`
- Update 3 API paths in the KangOpenBanking class from `/functions/v1/` to `/v1/`
- Fix OAuth to use form-encoded body
- Add x-consent-id header to AISP calls

### File 4: `src/pages/developer/WebhooksGuide.tsx`
- Update 4 dates from 2025 to 2026

### File 5: `src/pages/developer/PaymentFacilitation.tsx`
- Update 4 dates from 2025 to 2026

### File 6: `src/pages/Documentation.tsx`
- Replace `YOUR_API_KEY` with `{access_token}` on line 322

### File 7: `src/pages/integrations/WooCommercePluginCode.tsx`
- Replace raw project URL with `https://api.kangopenbanking.com/v1`

### Post-Implementation: Full Browser Test
Navigate to each updated page to verify rendering:
- `/developer` (console tab)
- `/developer/playground`
- `/developer/guides/ai-integration`
- `/developer/api/webhooks`
- `/developer/payment-facilitation`
- `/documentation`
- `/integrations/woocommerce`

---

## Totals

| Category | Files | Changes |
|----------|-------|---------|
| Developer console/playground | 2 | v1 paths, dates |
| Developer guides | 2 | v1 paths, dates, auth |
| Developer reference | 1 | Dates only |
| Main documentation | 1 | Auth pattern |
| Integration plugin | 1 | Remove raw URL |
| **Total** | **7 files** | |


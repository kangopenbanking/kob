

# Direct Backend E2E Infrastructure Correction Plan

## Discovery Summary

**Total matches found across the codebase:**

| Domain | Files | Matches |
|---|---|---|
| `api.kangopenbanking.com` | 164 files | ~2,148 matches |
| `sandbox.kangopenbanking.com` | 26 files | ~228 matches |
| `mtls.api.kangopenbanking.com` | 4 files | ~34 matches |

**Classification of affected areas:**

| Layer | Files Affected | Type |
|---|---|---|
| OpenAPI static specs (`public/openapi*.json`, `public/openapi*.yaml`) | 4 files | Spec contract |
| OpenAPI dynamic spec (`supabase/functions/public-api-spec/index.ts`) | 1 file | Backend spec generator |
| Central config (`src/config/api.ts`) | 1 file | Runtime config |
| Frontend doc/example pages (`src/pages/developer/*.tsx`, `src/pages/*.tsx`) | ~60 files | Developer docs |
| Backend edge functions (`supabase/functions/*/index.ts`) | ~20 files | Backend runtime |
| SDK packages (`packages/sdk-node`, `packages/sdk-php`, `packages/sdk-python`) | ~6 files | SDK defaults |
| Public metadata (`public/apis.json`) | 1 file | API discovery |
| Tests (`src/test/*.test.ts`) | ~3 files | Test fixtures |
| Docs markdown (`docs/`) | ~3 files | Markdown guides |

---

## Implementation Plan (7 Phases)

### PHASE 1 -- Canonical Backend URL Constant

**File: `src/config/api.ts`**

- Replace `BASE_URL` with the direct Supabase URL: `${VITE_SUPABASE_URL}/functions/v1`
- Remove `BASE_URL_FALLBACK` (the old hardcoded supabase.co URL)
- Remove `API_EXAMPLE_BASE_URL` pointing to `api.kangopenbanking.com`
- Keep `SITE_URL` (`kangopenbanking.com`) -- this is a website URL, not an API endpoint
- Keep `DOCS_URL`, `EXPLORER_URL` as website URLs
- Change `OPENAPI_SPEC` and `POSTMAN_COLLECTION` to use direct backend
- Remove `fetchWithFallback` function -- no longer needed
- Export a single `API_BACKEND_BASE` constant

### PHASE 2 -- OpenAPI Specification Correction

**4 static files + 1 dynamic generator = 5 files**

For all spec files (`public/openapi.json`, `public/openapi.yaml`, `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`, `supabase/functions/public-api-spec/index.ts`):

- Replace `servers[]` block: remove `api.kangopenbanking.com/v1` and `sandbox.kangopenbanking.com/v1`, replace with single server entry using direct Supabase URL
- Fix OAuth `authorizationUrl`, `tokenUrl`, `refreshUrl` to use direct backend path
- Fix `mtls.api.kangopenbanking.com` examples to use direct backend
- Fix `example` fields containing old domain URLs (OIDC discovery response examples, RFC 7807 error type URIs)
- Keep non-API website URLs (terms, contact, changelog) unchanged

### PHASE 3 -- Backend Edge Function Corrections

**~20 edge functions** containing `api.kangopenbanking.com` in response bodies:

- `aisp-accounts`, `aisp-standing-orders`, `aisp-direct-debits`, `aisp-beneficiaries`: Fix `Links.Self` URLs
- `pisp-create-consent`: Fix `Links.Self` URL
- `api-health`: Fix `documentation` URLs (openapi, postman, oidc_discovery)
- `gateway-cancel-payout` and similar: Fix RFC 7807 `type` URI prefix
- Keep email domains (`notify.kangopenbanking.com`, `support.kangopenbanking.com`) unchanged -- these are email infrastructure, not API endpoints
- Keep website redirect URLs (`kangopenbanking.com/app/auth`, `kangopenbanking.com/gateway/callback`) unchanged -- these are browser redirect targets

### PHASE 4 -- Developer Portal / Docs Pages

**~60 frontend files** with code examples:

All code examples in developer documentation pages must replace API domain references with a placeholder or the direct backend URL. Strategy:

- Create a shared constant `API_DOCS_BASE_URL` that resolves to the direct Supabase URL
- Update all `curl`, JavaScript, Python, and PHP code examples across:
  - `QuickStart.tsx`, `GettingStarted.tsx`, `ForDevelopers.tsx`
  - `ApiConsole.tsx`, `ApiReferenceOverview.tsx`
  - `SandboxConsole.tsx`, `SandboxMobileMoney.tsx`
  - `OpenBankingConsents.tsx`, `ComplianceAml.tsx`
  - `PostmanGuide.tsx`, `ApiReferencePagination.tsx`, `ApiReferenceVersioning.tsx`
  - `RemittanceCreateTransfer.tsx`
  - `CreditAPIDocumentation.tsx`
  - `Documentation.tsx`
  - All other developer guide pages
  - `docs/public/quickstarts/*.md`
  - Integration pages (`WooCommerceGuide.tsx`, `MakeGuide.tsx`)

### PHASE 5 -- SDK and Package Corrections

**6 files across 3 SDK packages:**

- `packages/sdk-node/src/client.ts`: Change `DEFAULT_BASE_URL`
- `packages/sdk-php/src/KangOpenBanking.php`: Change `DEFAULT_BASE_URL`
- `packages/sdk-php/config/kob.php`: Change default `base_url`
- `packages/sdk-php/src/Laravel/KOBServiceProvider.php`: Change fallback URL
- `packages/sdk-python/kangopenbanking/client.py`: Change `DEFAULT_BASE_URL`
- SDK README files: Update example URLs

### PHASE 6 -- Public Metadata and Tests

- `public/apis.json`: Update `baseURL` and function URLs
- `src/test/api-config.test.ts`: Update assertions to match new URL pattern
- `src/test/gateway-integration.test.ts`: Fix hardcoded URL assertions
- `src/components/SEO.tsx`: Update API URL in structured data

### PHASE 7 -- Regression Guards and Report

- Add a new test file `src/test/direct-backend-guard.test.ts` that greps the codebase for forbidden domains and fails if found in active API references
- Update `api-contract-test` edge function to validate servers[] in the spec
- Update changelog entry
- Produce final validation report

---

## What Will NOT Change

- Website URLs: `kangopenbanking.com/developer`, `/terms`, `/contact`, `/pricing` etc.
- Email domains: `notify.kangopenbanking.com`, `support.kangopenbanking.com`
- Firebase config: `kangopenbanking.com` as authDomain
- Browser redirect URLs: `kangopenbanking.com/app/auth`, `/gateway/callback`
- DNS verification targets: `checkout.kangopenbanking.com`
- Status page: `status.kangopenbanking.com`
- Logo/image URLs on `kangopenbanking.com`
- No operationIds, schema names, route paths, or response shapes will change
- No business logic modifications

## Estimated Scope

- ~90 files to modify
- ~2,400 URL replacements
- Zero breaking changes to API contracts, auth flows, or payment processing


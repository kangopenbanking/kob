

# Full Footer Pages Audit: v1 API Alignment and Fixes

## Audit Scope

Every unique page linked from the footer (34 distinct routes) was audited for:
- Legacy `/functions/v1/` paths instead of `/v1/` paths
- Exposed raw Supabase project URLs (`ftwbtzbeqkqrdmxmyvvz.supabase.co`)
- Stale dates (2025 instead of 2026)
- Legacy auth patterns (`YOUR_API_KEY` instead of OAuth tokens)
- Missing `Idempotency-Key` / `x-consent-id` headers
- Missing RFC 7807 error models
- Copyright year (2025 in footer)

---

## Pages PASSING (No Changes Needed)

| Page | Route | Status |
|------|-------|--------|
| Documentation | `/documentation` | Updated in last round |
| Pricing | `/pricing` | No API references |
| Status | `/status` | No API references |
| Embed Widget | `/embed-status-widget` | No API references |
| Developer Portal | `/developer` | Clean |
| Getting Started | `/developer/getting-started` | Updated |
| AISP APIs | `/developer/api/aisp` | Updated |
| PISP APIs | `/developer/api/pisp` | Updated |
| Mobile Money | `/developer/api/mobile-money` | Updated |
| API Console | `/developer/console` | Internal calls only |
| No-Code Integrations | `/integrations` | No API references |
| Zapier | `/integrations/zapier` | No API references |
| Make | `/integrations/make` | No API references |
| Bubble | `/integrations/bubble` | No API references |
| Retool | `/integrations/retool` | No API references |
| About | `/about` | No API references |
| Contact | `/contact` | No API references |
| FAQ | `/faq` | No API references |
| Data Protection | `/data-protection` | No dates to update |
| Compliance | `/compliance` | No dates to update |
| CrediQ | `/crediq` | Landing page, no API refs |
| Loans | `/loans` | User dashboard, internal calls |
| Savings | `/savings` | User dashboard, internal calls |
| Virtual Cards | `/virtual-cards` | User dashboard, internal calls |
| Credit Score | `/credit-score` | User dashboard, internal calls |

---

## Pages FAILING (10 files need updates)

### 1. `src/components/Footer.tsx`
- **Line 111**: Copyright says `2025` -- should be `2026`

### 2. `src/pages/guides/AISP.tsx`
- **Line 165**: Path `POST /aisp/create-consent` -- should be `POST /v1/aisp/consents`
- **Line 166**: `Authorization: Bearer YOUR_API_KEY` -- should be `Authorization: Bearer {access_token}`
- **Lines 175-177**: Dates `2025-12-31` and `2025-12-31` -- should be `2026-12-31`

### 3. `src/pages/guides/PISP.tsx`
- **Line 161**: Path `POST /pisp/domestic-payment` -- should be `POST /v1/pisp/domestic-payments`
- **Line 162**: `Authorization: Bearer YOUR_API_KEY` -- should be `Authorization: Bearer {access_token}`
- **Line 177**: Reference `INV-2025-001` -- should be `INV-2026-001`
- Missing `Idempotency-Key` header in POST example

### 4. `src/pages/guides/Security.tsx`
- **Line 115**: `X-API-Key: YOUR_API_KEY` -- should mention OAuth Bearer token as the primary method, with API key as sandbox-only

### 5. `src/pages/Privacy.tsx`
- **Line 8**: `Last updated: January 15, 2025` -- should be `February 16, 2026`

### 6. `src/pages/Terms.tsx`
- **Line 8**: `Last updated: January 15, 2025` -- should be `February 16, 2026`

### 7. `src/pages/SecurityPolicy.tsx`
- **Line 12**: `Last updated: October 18, 2025` -- should be `February 16, 2026`

### 8. `src/pages/SLA.tsx`
- **Line 13**: `Effective: October 18, 2025` -- should be `February 16, 2026`

### 9. `src/pages/CreditAPIDocumentation.tsx` (linked from footer via Documentation > Credit Reports)
- **Lines 93, 122, 157, 193, 352, 363**: All paths use `/functions/v1/credit-api-auth` and `/functions/v1/credit-api-query-score` -- should be `/v1/credit/auth` and `/v1/credit/query`
- **Lines 113, 138, 182, 415, 426**: Expose raw Supabase URL `ftwbtzbeqkqrdmxmyvvz.supabase.co` -- should use `https://api.kangopenbanking.com`
- **Lines 174, 176**: Dates `2025-01-15` and `2025-02-14` -- should be `2026-...`
- Missing `Idempotency-Key` header on POST examples

### 10. `src/pages/ForDevelopers.tsx` (landing page linked from navigation)
- **Line 40**: URL `https://api.kangopenbanking.com/functions/v1/oauth-token` -- should be `https://api.kangopenbanking.com/v1/oauth/token`
- **Line 48**: URL `https://api.kangopenbanking.com/functions/v1/aisp-accounts` -- should be `https://api.kangopenbanking.com/v1/aisp/accounts`
- OAuth token request sends JSON -- should use `application/x-www-form-urlencoded`
- Missing `x-consent-id` header in AISP example

### 11. `src/pages/StatusWidget.tsx` (footer link)
- **Line 27**: Uses raw Supabase URL `https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/api-health` -- should use `https://api.kangopenbanking.com/v1/health` (note: this is a runtime fetch, so we use the fallback pattern with `import.meta.env.VITE_SUPABASE_URL` for actual calls)

---

## Implementation Plan

### File 1: `src/components/Footer.tsx`
- Update copyright year from `2025` to `2026` (line 111)

### File 2: `src/pages/guides/AISP.tsx`
- Update consent endpoint from `POST /aisp/create-consent` to `POST /v1/aisp/consents`
- Replace `YOUR_API_KEY` with `{access_token}` and add `x-consent-id` header
- Update expiration dates from `2025` to `2026`

### File 3: `src/pages/guides/PISP.tsx`
- Update payment endpoint from `POST /pisp/domestic-payment` to `POST /v1/pisp/domestic-payments`
- Replace `YOUR_API_KEY` with `{access_token}`
- Add `Idempotency-Key` header
- Update invoice reference to `INV-2026-001`

### File 4: `src/pages/guides/Security.tsx`
- Update API key section to clarify OAuth Bearer as primary auth, API key as sandbox-only

### File 5: `src/pages/Privacy.tsx`
- Update date to `February 16, 2026`

### File 6: `src/pages/Terms.tsx`
- Update date to `February 16, 2026`

### File 7: `src/pages/SecurityPolicy.tsx`
- Update date to `February 16, 2026`

### File 8: `src/pages/SLA.tsx`
- Update date to `February 16, 2026`

### File 9: `src/pages/CreditAPIDocumentation.tsx`
- Replace all 6 endpoint paths from `/functions/v1/credit-api-*` to `/v1/credit/*`
- Replace all 5 raw Supabase URLs with `https://api.kangopenbanking.com`
- Update dates from 2025 to 2026
- Add `Idempotency-Key` header to POST examples

### File 10: `src/pages/ForDevelopers.tsx`
- Update OAuth URL to `/v1/oauth/token`
- Update AISP URL to `/v1/aisp/accounts`
- Fix content type to `application/x-www-form-urlencoded` for token request
- Add `x-consent-id` header to AISP example

### File 11: `src/pages/StatusWidget.tsx`
- Replace hardcoded Supabase URL with `import.meta.env.VITE_SUPABASE_URL` + `/functions/v1/api-health` for the runtime health check call (this is an actual API call, not documentation, so it should use the environment variable)

---

## Summary

| Category | Files | Changes |
|----------|-------|---------|
| Footer component | 1 | Copyright year |
| Guide pages | 3 | v1 paths, auth patterns, dates |
| Legal pages | 4 | Date updates |
| API documentation | 1 | v1 paths, remove raw URLs, dates |
| Developer landing | 1 | v1 paths, auth fix |
| Status widget | 1 | Environment variable for API URL |
| **Total** | **11 files** | |


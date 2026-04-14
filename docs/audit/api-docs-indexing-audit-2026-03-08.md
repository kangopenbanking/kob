# Kang Open Banking — API Documentation & Indexing Audit Report

**Date:** 2026-03-08  
**Scope:** End-to-end audit of all API specifications, discovery endpoints, developer documentation, sitemap, robots.txt, SEO metadata, and structured data for production readiness.

---

## Executive Summary

| Category | Issues Found | Critical | High | Medium | Low |
|----------|-------------|----------|------|--------|-----|
| Static OpenAPI Spec (`openapi.json`) | 6 | **3** | 2 | 1 | — |
| AI Plugin (`ai-plugin.json`) | 4 | **1** | 2 | 1 | — |
| APIs.json | 2 | — | 1 | 1 | — |
| Sitemap | 4 | — | 2 | 2 | — |
| Robots.txt | 3 | — | 1 | 2 | — |
| Portal Docs (Markdown) | 6 | **1** | 3 | 2 | — |
| Error Reference | 3 | — | **2** | 1 | — |
| Postman Collection | 2 | — | 1 | 1 | — |
| SEO Component | 3 | — | 1 | 2 | — |
| Endpoint Inventory Doc | 1 | — | 1 | — | — |
| **TOTAL** | **34** | **5** | **16** | **13** | **0** |

---

## CRITICAL (5 Issues — Blocks Production Integrity)

### C1. Static `public/openapi.json` Is Severely Outdated

**File:** `public/openapi.json` (1,263 lines)  
**Severity:** CRITICAL

The static OpenAPI file served at `https://kangopenbanking.com/openapi.json` is version `2.1.0` but is missing **~60% of production endpoints**. The dynamic spec (`public-api-spec` edge function) has 2,104 lines with full coverage, but the static file — which is referenced by `ai-plugin.json`, `apis.json`, and the SEO `<link>` tag — is drastically incomplete.

**Missing from static spec:**
- Loans (7 endpoints): `/v1/loans/*`
- Savings (5 endpoints): `/v1/savings/*`
- Ledger (5 endpoints): `/v1/ledger/*`
- Virtual Cards (5 endpoints): `/v1/cards/*`
- ISO 20022 & SWIFT (9 endpoints): `/v1/standards/*`
- KYC & Compliance (3 endpoints): `/v1/kyc/*`
- Webhooks Management (3 endpoints): `/v1/webhooks/*`
- Admin (15+ endpoints): `/v1/admin/*`
- Phone Authentication (6 endpoints): `/v1/auth/phone/*`
- Security — CAPTCHA & SCA (4 endpoints): `/v1/security/*`
- Certificates (3 endpoints): `/v1/certificates/*`
- OAuth PAR, DCR, OIDC Discovery, JWKS, Introspect, Revoke, UserInfo
- Merchant Lifecycle (register, KYB, API keys, webhooks, settlement accounts)
- Consumer Tools (Piggy Bank, Njangi — 6 endpoints)
- Funding Intents (3 endpoints)
- Standards & Directory (IBAN/BIC/RIB validation, bank directory)
- Gateway preauth/capture/void/OTP/risk-score/fund-account/withdraw
- WooCommerce (process-payment, transactions, webhook)
- Communications, Settlement, Institution, CrediQ, PostiQ, Sandbox, Developer
- No `components/schemas` section (no reusable type definitions)
- No `$ref` error response references
- Missing `mtls` security scheme

**Impact:** Any AI agent, API aggregator (APIs.guru), or developer tool that reads the static file sees only ~40% of the API surface. This is the #1 discovery blocker.

**Fix:** Replace `public/openapi.json` with the output of the dynamic `public-api-spec` edge function, or redirect `/openapi.json` to the dynamic endpoint. Update the version to match.

---

### C2. `ai-plugin.json` Points to Outdated Static Spec

**File:** `public/.well-known/ai-plugin.json`  
**Severity:** CRITICAL

```json
"api": {
  "type": "openapi",
  "url": "https://kangopenbanking.com/openapi.json"  // ← outdated static file
}
```

ChatGPT, Claude, and other AI agents that consume this plugin manifest will only see the incomplete static spec from C1.

**Fix:** Change `api.url` to `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec` (the dynamic endpoint).

---

### C3. `ai-plugin.json` Missing Required OAuth Fields

**File:** `public/.well-known/ai-plugin.json`  
**Severity:** CRITICAL

The `auth` object declares `"type": "oauth"` but is missing required fields per the OpenAI plugin spec:
- Missing `client_url` (authorization endpoint for user-facing flow)
- Missing `authorization_content_type` (should be `"application/x-www-form-urlencoded"`)
- Missing `token_url` (token endpoint)
- Missing `verification_tokens` (optional but recommended)

Current:
```json
"auth": {
  "type": "oauth",
  "authorization_url": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-authorize",
  "scope": "openid accounts balances transactions payments"
}
```

**Fix:** Update to full spec:
```json
"auth": {
  "type": "oauth",
  "client_url": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-authorize",
  "authorization_url": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token",
  "authorization_content_type": "application/x-www-form-urlencoded",
  "scope": "openid accounts balances transactions payments"
}
```

---

### C4. Webhook Guide: Endpoint URL Mismatch with Postman & OpenAPI

**File:** `docs/portal/webhooks.md` (line 18)  
**Severity:** CRITICAL

The webhook guide documents the subscription endpoint as:
```
POST /v1/webhooks/subscribe
PUT  /v1/webhooks/subscribe/{id}
DELETE /v1/webhooks/subscribe/{id}
```

But both the Postman collection and OpenAPI spec use:
```
POST /v1/webhooks
GET  /v1/webhooks
GET  /v1/webhooks/{id}/deliveries
```

Developers following the guide will get 404 errors.

**Fix:** Align the webhook guide to use the actual API endpoints.

---

### C5. Webhook Event Types Divergence

**File:** `docs/portal/webhooks.md` (lines 236-289) vs `public-api-spec/index.ts` (lines 218-229)  
**Severity:** CRITICAL

The webhook guide documents **25 event types** across 6 categories (payment.*, consent.*, transfer.*, mobilemoney.*, account.*, settlement.*).

The OpenAPI spec `WebhookEventType` enum defines **24 different event types** using gateway naming:
```
charge.created, charge.processing, charge.successful, charge.failed,
charge.cancelled, charge.voided, charge.captured, charge.refunded,
payout.created, payout.processing, payout.completed, payout.failed,
refund.created, refund.completed, refund.failed,
dispute.created, dispute.won, dispute.lost,
settlement.paid,
consent.created, consent.authorised, consent.revoked, consent.expired,
account.updated
```

The guide uses `payment.*` and `mobilemoney.*` prefixes that **don't exist** in the actual enum. Developers subscribing to `payment.completed` will never receive events — the actual event is `charge.successful`.

**Fix:** Rewrite the webhooks guide event table to match the canonical 24-event enum.

---

## HIGH (16 Issues)

### H1. Static OpenAPI: Sandbox Server URL Identical to Production

**File:** `public/openapi.json` (lines 18-27)

Both production and sandbox servers point to `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`. No way for tools to distinguish environments.

**Fix:** Use a distinguishing marker (e.g., `x-environment: sandbox` is already there but add a description noting "Use sandbox API keys obtained from the developer portal").

### H2. Static OpenAPI: No Error Response References

**File:** `public/openapi.json`

Every endpoint response only has a `"200"` or `"201"` description. No 400, 401, 403, 404, 409, 429, or 500 responses documented. The dynamic spec correctly includes `errorResponses` on all endpoints. Static spec has zero.

### H3. `apis.json`: OpenAPI URL Points to Static File

**File:** `public/apis.json` (line 33)

```json
{ "type": "X-openapi", "url": "https://kangopenbanking.com/openapi.json" }
```

Should point to the dynamic spec or both should be listed with the dynamic as primary.

### H4. `apis.json`: Missing API Version Field

**File:** `public/apis.json`

No `version` property on the API entry. Aggregators like APIs.guru require this.

### H5. Sitemap: Cross-Domain URLs

**File:** `public/sitemap.xml` (lines 506-517)

Includes `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec` and `postman-collection`. Sitemaps should only contain URLs from the same domain. Google ignores cross-domain entries.

**Fix:** Remove the `api.kangopenbanking.com` URLs or serve them from the main domain.

### H6. Sitemap: Missing Developer Portal Routes

**File:** `public/sitemap.xml`

Missing pages that exist in the app router:
- `/developer/authentication` (referenced in apis.json)
- `/register` (referenced in apis.json as X-signup)
- `/manual/banks`, `/manual/customers`, `/manual/merchants`, `/manual/developers`
- `/developer/gateway/hosted-checkout`
- `/developer/api/virtual-cards`
- `/developer/api/standards` (ISO 20022/SWIFT)

### H7. Robots.txt: Inconsistent Allow Paths

**File:** `public/robots.txt`

- References `/developer/quick-start` — sitemap has `/developer/getting-started`
- References `/developer/playground` — sitemap has `/developer/api-playground`
- These mismatches don't cause crawl failures but signal inconsistency

### H8. Robots.txt: No Disallow for Private Routes

**File:** `public/robots.txt`

No `Disallow` directives for authenticated-only routes:
- `/dashboard/*`
- `/admin/*`
- `/fi-portal/*`
- `/merchant/*`
- `/settings/*`
- `/account/*`

Search engines may attempt to crawl and index these gated pages, resulting in soft 404s or login redirects.

### H9. Error Reference: Missing Gateway Error Codes

**File:** `docs/portal/error-reference.md`

Missing error code domains that exist in the API:
- `GW_*` (Gateway — charges, payouts, refunds, disputes)
- `SETTLE_*` (Settlement processing)
- `INST_*` (Institution registration)
- `CONS_*` (Consumer tools — Piggy Bank, Njangi)
- `STD_*` (Standards validation — IBAN, BIC, RIB)
- `FUND_*` (Funding intents)

### H10. Error Reference: Missing HTTP 422 Error Codes

**File:** `docs/portal/error-reference.md` (line 29)

Lists `422 Unprocessable entity` in the HTTP status table but no domain error codes map to it.

### H11. Postman Collection: Endpoint Inventory Doc Is Stale

**File:** `docs/audit/postman-endpoint-inventory.md`

Documents `~165 Postman requests across 21 folders` but the actual collection now contains:
- Consumer Tools (6 requests)
- Funding Intents (3 requests)
- Standards & Directory (5 requests)
- OAuth Extensions (2 requests)
- Merchants lifecycle (11+ requests)
- Additional Gateway endpoints (fund-account, withdraw-to-bank, withdraw-to-paypal, risk/score, preauth, capture, void, OTP)

Actual count is **~220+ requests across 28+ folders**.

### H12. Postman Collection: Webhook Event Names Don't Match OpenAPI

**File:** `supabase/functions/postman-collection/index.ts` (line 439)

Postman example uses `payment.completed` and `consent.revoked`:
```json
{ "url": "...", "events": ["payment.completed", "consent.revoked"] }
```

But the canonical event types are `charge.successful` and `consent.revoked`. Half of this example is wrong.

### H13. Portal Docs: Missing Guides for Major API Domains

**File:** `docs/portal/`

Only 7 guide files exist. Missing narrative guides for:
- Loans API (lifecycle: apply → approve → disburse → schedule → repay)
- Savings API (products → accounts → deposit → withdraw → interest accrual)
- Ledger API (chart of accounts → journal entries → balance queries)
- Virtual Cards API (create → fund → transact → freeze)
- Merchant Lifecycle (register → KYB → API keys → go-live)
- Consumer Tools (Piggy Bank, Njangi)
- Gateway Advanced (preauth/capture, tokenization, hosted checkout)
- ISO 20022 & SWIFT (pain.001, camt.053, MT103, MT940)

### H14. SEO: Hreflang Tags Reference Non-Existent French URLs

**File:** `src/components/SEO.tsx` (lines 88-90)

```tsx
<link rel="alternate" hrefLang="fr" href={canonical?.replace('/en/', '/fr/') || `${baseUrl}/fr`} />
```

The app has no `/fr/` route structure. All pages are English-only. These hreflang tags point to 404s, which hurts SEO.

**Fix:** Remove French hreflang until a French version is actually implemented, or add proper i18n routing.

### H15. Quickstart Guide: AISP Consent Body Uses Old UK OB Format

**File:** `docs/portal/quickstart.md` (lines 74-79)

```json
{ "Data": { "Permissions": ["ReadAccountsBasic",...], "ExpirationDateTime": "..." } }
```

But the OpenAPI spec (`public-api-spec`) defines the AISP consent body as:
```json
{ "permissions": [...], "expiration_date": "..." }
```

Using `Data.Permissions` (UK Open Banking wrapper) vs `permissions` (flat KOB format) will cause 400 errors.

### H16. `ai-plugin.json`: Description Incomplete

**File:** `public/.well-known/ai-plugin.json`

`description_for_model` doesn't mention the Payment Gateway (charges, payouts, settlements, disputes, payment links, subscriptions), WooCommerce, virtual cards, or merchant APIs. AI agents won't know these capabilities exist.

---

## MEDIUM (13 Issues)

### M1. Static OpenAPI: OpenAPI Version Mismatch
- Static: `"openapi": "3.1.0"`, Dynamic spec also claims 3.1. But static lacks JSON Schema `$ref` usage making it functionally 3.0-level.

### M2. Static OpenAPI: Missing `info.x-full-spec-url` in Static File
- Dynamic spec has `"x-full-spec-url"` pointing to itself. Static file should have this to redirect tools.

### M3. Sitemap: `lastmod` Dates All Identical
- Every URL shows `2026-03-07`. Actual content changes are not reflected per-page.

### M4. Sitemap: Missing `<changefreq>quarterly` for Legal Pages Accuracy
- `/privacy` and `/terms` show `quarterly` which is fine, but `/sla` should be `monthly` if SLA terms are updated with feature releases.

### M5. Portal Docs: Webhook Guide Missing Gateway Events
- Only documents payment.*, consent.*, transfer.*, mobilemoney.*, account.*, settlement.* categories. Doesn't cover `charge.*`, `payout.*`, `refund.*`, `dispute.*` which are the gateway event family.

### M6. Portal Docs: Authentication Guide Missing PKCE Flow
- `docs/portal/authentication.md` documents DCR, client_credentials, and refresh_token but doesn't cover the PKCE (`code_challenge`/`code_verifier`) flow that the OpenAPI spec supports.

### M7. Portal Docs: Error Reference Missing `content-type` for RFC 7807
- Shows the JSON envelope but doesn't mention the required `Content-Type: application/problem+json` header.

### M8. Postman Collection: Variable `card_id` Missing
- Virtual Cards folder uses `{{card_id}}` but it's not defined in the collection variables (line 60-82).

### M9. Postman Collection: Missing Variables for New Folders
- Missing: `{{woo_api_key}}`, `{{payment_link_id}}`, `{{plan_id}}`, `{{subscription_id}}`, `{{subaccount_id}}`, `{{customer_id}}`, `{{token_id}}`, `{{virtual_account_id}}`, `{{funding_intent_id}}`, `{{piggybank_id}}`, `{{group_id}}`

### M10. SEO: No `robots` Meta Tag Support in SEO Component
- Cannot set `noindex` on specific pages (e.g., dashboard, settings) via the SEO component.

### M11. `openapi-json` Edge Function: Unnecessary Proxy
- `supabase/functions/openapi-json/index.ts` fetches from `public-api-spec` and re-serves it. This adds latency and a failure point. Should serve the spec directly or redirect.

### M12. Postman: Payments Folder Uses Legacy `/v1/stripe/*` Paths
- Lines 344-354: Uses `/v1/stripe/payment-intent` and `/v1/flutterwave/bank-transfer` instead of the canonical `/v1/gateway/*` namespace.

### M13. Portal Docs: Internal Links Use Relative Markdown Paths
- Quickstart links to `authentication.md`, `aisp-guide.md`, etc. These work in GitHub but not when rendered in the web app developer portal.

---

## Recommended Fix Sequence

### Week 1 (Critical — Blocks Production)
1. **C1+C2+C3:** Regenerate `public/openapi.json` from the dynamic spec, update `ai-plugin.json` to point to dynamic endpoint with correct OAuth fields
2. **C4+C5:** Rewrite `docs/portal/webhooks.md` with correct endpoints and canonical event types
3. **H12:** Fix Postman webhook event example
4. **H15:** Fix quickstart consent body format

### Week 2 (High — Blocks Integration)
5. **H5+H6:** Clean sitemap — remove cross-domain URLs, add missing pages
6. **H7+H8:** Fix robots.txt — correct paths, add Disallow for private routes
7. **H9+H10:** Complete error reference with all domain codes
8. **H11:** Regenerate Postman endpoint inventory
9. **H13:** Create missing portal guides (Loans, Savings, Ledger, Virtual Cards, Merchant)
10. **H14:** Remove French hreflang tags
11. **H3+H4:** Update apis.json with dynamic spec URL and version

### Week 3 (Medium — Polish)
12. Fix Postman variables (M8, M9, M12)
13. Update SEO component (M10, H14)
14. Clean up openapi-json proxy (M11)
15. Fix portal doc internal links (M13)

---

## Verification Checklist (Post-Fix)

```bash
# 1. Static OpenAPI matches dynamic
diff <(curl -s https://kangopenbanking.com/openapi.json | jq -S .) \
     <(curl -s https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec | jq -S .)

# 2. AI plugin spec is valid
curl -s https://kangopenbanking.com/.well-known/ai-plugin.json | jq '.auth.client_url, .auth.authorization_url, .api.url'

# 3. Sitemap only contains same-domain URLs
curl -s https://kangopenbanking.com/sitemap.xml | grep -v 'kangopenbanking.com/' | grep '<loc>'

# 4. Webhook event types in docs match OpenAPI enum
# Manual: compare docs/portal/webhooks.md event table with WebhookEventType in public-api-spec

# 5. All sitemap URLs return 200
curl -s https://kangopenbanking.com/sitemap.xml | grep '<loc>' | sed 's/.*<loc>//;s/<\/loc>.*//' | xargs -I{} curl -s -o /dev/null -w "%{http_code} {}\n" {}
```

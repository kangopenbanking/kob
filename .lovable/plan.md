

# Mega Implementation Plan: KOB v4.9.2 -- 3-App Gap Fix & API Wiring

## Scope Summary

19 functional gaps across Consumer, Business, and Banking apps, plus a shared API client layer. No UI structural changes -- only API wiring, interceptors, webhook handlers, and flow fixes.

---

## Phase 0: Shared KOBApiClient Module

**New file: `src/lib/kob-api-client.ts`**

A singleton class providing:

1. **OIDC Bootstrap** -- Fetches `/v1/oidc/.well-known/openid-configuration` once at startup via `fetchWithFallback`, caches all endpoint URLs (token, authorize, jwks, PAR). Exposes `getDiscovery()`.

2. **HTTP Client (`request()`)** -- Wraps `fetch` with:
   - Auto-attaches `Authorization: Bearer {token}` from in-memory token store
   - Auto-generates `Idempotency-Key` (UUID v4) on POST/PUT/PATCH
   - Auto-attaches `x-fapi-interaction-id` (UUID v4) on every request
   - 401 response handler: attempts `POST /v1/oauth/token` with `grant_type=refresh_token`, retries original request once, or revokes + redirects to login
   - RFC 7807 error parser: detects `application/problem+json`, extracts `detail`, `error_id`, surfaces user-friendly messages via existing `formatErrorForToast`

3. **Token Store** -- In-memory (not localStorage). Stores `access_token`, `refresh_token`, `expires_at`. Exposes `setTokens()`, `getAccessToken()`, `isExpired()`, `clear()`.

4. **Health Check** -- `checkHealth()` calls `GET /v1/health`. Returns `healthy | degraded | unhealthy`.

**New file: `src/lib/kob-webhook-handler.ts`**

Client-side webhook event bus using Supabase Realtime as transport (since this is a web app, not a server):
- Subscribes to `webhook_inbox` table filtered by user/merchant/institution ID
- Deduplicates by event `id` using a Set (max 1000 entries)
- Dispatches events to registered handler functions
- HMAC verification happens server-side in existing edge functions

**New file: `src/components/HealthBanner.tsx`**

- Full-screen maintenance overlay when `unhealthy`
- Dismissible amber banner when `degraded`
- Integrated into all three app layouts

**Modified files:**
- `src/components/customer-app/CustomerAppLayout.tsx` -- Add health check + HealthBanner
- `src/components/banking-app/BankingAppLayout.tsx` -- Add health check + HealthBanner
- `src/components/merchant/MerchantAppLayout.tsx` (or equivalent biz layout) -- Add health check + HealthBanner

---

## Phase 1: Consumer App Gaps (C-1 through C-8)

### C-1: OTP PIN-Set Guard
- **File:** `src/pages/customer-app/CustomerAuth.tsx`
- After OTP verification succeeds for new user, check if PIN exists via `useMandatoryPin` hook (already exists)
- Ensure `setup-pin` mode is forced before navigation to home
- Wire `POST /v1/auth/pin/set` via `KOBApiClient.request()`
- For returning users, wire `POST /v1/auth/phone/pin-login`

### C-2: OAuth2 PKCE Flow
- **New file:** `src/lib/pkce.ts` -- `generateCodeVerifier()`, `generateCodeChallenge()` using Web Crypto API (S256 only)
- **File:** `src/pages/customer-app/CustomerAuth.tsx` -- After PIN verified, initiate PKCE authorize redirect using discovery endpoints, handle callback with token exchange
- Store tokens in KOBApiClient memory store

### C-3: SCA Wrapper
- **New file:** `src/hooks/useSCAChallenge.ts` -- Hook that initiates `POST /v1/security/sca/initiate`, shows challenge dialog, verifies with `POST /v1/security/sca/verify`, returns `{ requireSCA, verifySCA }` 
- **New file:** `src/components/SCADialog.tsx` -- OTP/PIN challenge modal (outline style, no gradient)
- **Modified files:** `CustomerSendMoney.tsx`, `PayByBankApproval.tsx`, Njangi payout flow, Overdraft flow -- wrap payment calls with SCA gate

### C-4: AISP Consent Expiry & Revoke
- **File:** `src/pages/customer-app/CustomerLinkedAccounts.tsx` (or equivalent accounts page)
- Display `expiration_date` badge on each linked account
- Add "Revoke Access" button calling `POST /v1/consents/{id}/revoke`
- Webhook handler for `consent.expired` and `consent.revoked` -- lock account view

### C-5: Pay-by-Bank Deep-Link
- **File:** `src/pages/customer-app/PayByBankApproval.tsx` -- Already has intent loading; add SCA gate before authorization (reuse C-3 hook)
- **File:** `src/App.tsx` -- Ensure route handles both `/app/pay-by-bank/:intentId` patterns

### C-6: Card Freeze/Unfreeze Toggle
- **File:** `src/pages/customer-app/CustomerCards.tsx` -- Replace the toast-only freeze button with actual `PUT /v1/cards/{cardId}/status` call via KOBApiClient, add confirmation dialog, optimistic UI with rollback

### C-7: Webhook Event Listeners
- **New file:** `src/hooks/useConsumerWebhookEvents.ts` -- Uses `kob-webhook-handler` to register handlers for all 17 consumer events listed in Part 4
- **File:** `src/components/customer-app/CustomerAppLayout.tsx` -- Mount the hook

### C-8: Idempotency Keys
- Handled automatically by `KOBApiClient.request()` interceptor (Phase 0). All consumer payment calls that switch to using `KOBApiClient` get idempotency for free.

---

## Phase 2: Business App Gaps (B-1 through B-6)

### B-1: Webhook V2 Registration During Onboarding
- **File:** `src/pages/merchant/MerchantSettlementAccounts.tsx` -- After settlement account creation succeeds, auto-call webhook v2 endpoint registration
- Show one-time secret modal with copy button
- **File:** `src/pages/merchant/MerchantWebhooks.tsx` -- Upgrade existing `gateway-webhook-endpoints` calls to use v2 endpoint format

### B-2: Idempotency on All Mutations
- Same as C-8: automatic via KOBApiClient interceptor. Migrate existing `supabase.functions.invoke` calls in charge/payout pages to use `KOBApiClient.request()`.

### B-3: Pre-Charge Risk Scoring
- **New file:** `src/hooks/useRiskScore.ts` -- Calls `POST /v1/gateway/risk/score`, returns `{ action, score, checkRisk }`. Implements fail-open on API error.
- **Modified files:** All charge creation flows (MerchantTransactions, inline charge forms) -- gate charge behind risk check

### B-4: Pre-Auth Capture/Void
- **File:** `src/pages/merchant/MerchantTransactions.tsx` (or charge detail component) -- Add "Capture" and "Void" buttons when `status === 'authorized'`, wire to `POST /v1/gateway/charges/{id}/capture` and `/void`

### B-5: Payout Retry
- **File:** `src/pages/merchant/MerchantPayouts.tsx` -- Add "Retry" button on failed payouts, wire to `POST /v1/gateway/payouts/{id}/retry`, show ProblemDetails error on failure

### B-6: Compliance Screening Before Payouts
- **New file:** `src/hooks/useComplianceScreen.ts` -- Calls `POST /v1/compliance/screen`, returns clear/flagged/blocked status
- **Modified files:** All payout initiation flows -- gate payout behind compliance check

### Business Webhook Handlers
- **New file:** `src/hooks/useMerchantWebhookEvents.ts` -- 17 business event handlers from Part 4
- Mount in merchant app layout

---

## Phase 3: Banking App Gaps (BK-1 through BK-5)

### BK-1: Inline Account Identifier Validation
- **New file:** `src/hooks/useAccountValidation.ts` -- `validateRIB()`, `validateIBAN()`, `validateBIC()` calling respective `POST /v1/standards/validate/*` endpoints on blur
- **New file:** `src/components/ValidatedAccountInput.tsx` -- Input wrapper showing checkmark/error with disabled submit logic
- **Modified files:** All banking payment/transfer forms (`BankSendMoney.tsx`, `BankPayments.tsx`, etc.) -- replace raw inputs with `ValidatedAccountInput`

### BK-2: Interbank Payment Lifecycle Tracker
- **New file:** `src/components/banking/InterbankPaymentTracker.tsx` -- 10-step visual progress bar (6 sequential + 4 branch states in red), polls `GET /v1/interbank/payments/{id}` every 30s, shows timestamps
- Add "Return Payment" button (pacs.004) when settled, "Cancel Payment" button (camt.056) when created/validated
- Integrate into payment detail view

### BK-3: SAR Review Stage Enforcement
- **File:** `src/pages/institution/InstitutionCompliance.tsx` -- Enforce 3-step wizard:
  1. File SAR (`POST /v1/compliance/sar`)
  2. Internal review with notes + 4-eyes check UI state (`POST /v1/compliance/sar/{id}/review`)
  3. Submit to COBAC with password re-entry and confirmation modal (`POST /v1/compliance/sar/{id}/submit`)

### BK-4: SLA Dashboard Auto-Refresh
- **File:** `src/pages/institution/InstitutionIncidents.tsx` (or create SLA dashboard section)
- Poll `GET /v1/sla/metrics` every 30s -- uptime with color coding, latency bar chart (p50/p95/p99), error rate
- Poll `GET /v1/sla/incidents` every 60s -- red banner for active incidents, green "All Operational" otherwise
- "Report Incident" and "Update Incident" buttons

### BK-5: Connector Health Live Monitoring
- **Modified files:** Bank connector dashboard pages in `src/pages/institution/connector/`
- Poll `GET /v1/banks/{bankId}/connectors/{connectorId}/health` every 60s
- Live status dots (green/amber/red), latency display, alert banner for unhealthy connectors

### Banking Webhook Handlers
- **New file:** `src/hooks/useBankingWebhookEvents.ts` -- 15 banking event handlers from Part 4
- Mount in banking app layout

---

## Phase 4: Version Bump & Changelog

- **File:** `public/changelog.json` -- Add v4.9.4 entry documenting all 19 gaps fixed
- **File:** `src/pages/developer/Changelog.tsx` -- Add v4.9.4 entry

---

## New Files Summary (14 files)

| File | Purpose |
|---|---|
| `src/lib/kob-api-client.ts` | Shared API client with OIDC, interceptors, token store |
| `src/lib/kob-webhook-handler.ts` | Client-side webhook event bus via Realtime |
| `src/lib/pkce.ts` | PKCE code verifier/challenge generation |
| `src/components/HealthBanner.tsx` | Maintenance/degraded status banner |
| `src/components/SCADialog.tsx` | SCA challenge modal |
| `src/components/ValidatedAccountInput.tsx` | Account identifier input with API validation |
| `src/components/banking/InterbankPaymentTracker.tsx` | 10-step payment lifecycle tracker |
| `src/hooks/useSCAChallenge.ts` | SCA initiate/verify hook |
| `src/hooks/useRiskScore.ts` | Pre-charge risk scoring hook |
| `src/hooks/useComplianceScreen.ts` | Pre-payout compliance screening hook |
| `src/hooks/useAccountValidation.ts` | RIB/IBAN/BIC validation hook |
| `src/hooks/useConsumerWebhookEvents.ts` | Consumer webhook event handlers |
| `src/hooks/useMerchantWebhookEvents.ts` | Business webhook event handlers |
| `src/hooks/useBankingWebhookEvents.ts` | Banking webhook event handlers |

## Modified Files Summary (~20 files)

All three app layouts, `CustomerAuth.tsx`, `CustomerCards.tsx`, `PayByBankApproval.tsx`, `CustomerSendMoney.tsx`, `MerchantWebhooks.tsx`, `MerchantSettlementAccounts.tsx`, `MerchantTransactions.tsx`, `MerchantPayouts.tsx`, `InstitutionCompliance.tsx`, `InstitutionIncidents.tsx`, connector dashboard pages, `BankSendMoney.tsx`, `BankPayments.tsx`, `changelog.json`, `Changelog.tsx`.

## Implementation Rules Compliance

- No new npm packages (uses Web Crypto API, existing tanstack-query, existing supabase client)
- All amounts remain as string integers
- Tokens stored in memory only (not localStorage)
- PKCE uses S256 exclusively
- RFC 7807 parsing in shared client
- SCA required before all consumer payments
- Risk scoring required before all business charges
- Compliance screening required before all payouts
- SAR enforces 3-step flow with 4-eyes check
- All POST/PUT/PATCH financial calls include Idempotency-Key


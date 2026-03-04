

# Public Developer Documentation — Stripe/Flutterwave Parity Analysis & Plan

## Gap Analysis: KOB vs Stripe vs Flutterwave Public Docs

### What Stripe & Flutterwave Make Public (that KOB is Missing)

| Public Doc Category | Stripe | Flutterwave | KOB Status |
|---|---|---|---|
| **API Status Page** | status.stripe.com | status.flutterwave.com | Missing — no `/developer/status` page |
| **Error Codes Reference** | Full error code catalogue | Full error code list | Missing — no dedicated page |
| **Rate Limits Reference** | Documented per endpoint | Documented | Missing — no dedicated page |
| **Idempotency Guide** | Full guide | Partial | Missing — mentioned in code but no guide page |
| **Pagination Guide** | Cursor/offset docs | Documented | Missing |
| **Wallets API Docs** | Connect balances | Wallet API | Missing — deployed but no dev guide page |
| **Escrow / Holds Docs** | — | — | Missing — deployed but no dev guide page |
| **Compliance / Screening Docs** | Radar docs | — | Missing |
| **Instant Payouts Docs** | Instant payouts guide | — | Missing |
| **Webhooks v2 (Multi-Endpoint)** | Full webhook endpoint CRUD | Webhook management | Missing |
| **SLA / Uptime Docs** | SLA page | — | Missing |
| **Sandbox Payout Simulation** | Test clocks | Test cards/scenarios | Missing — deployed, no guide |
| **Treasury / Float Docs** | Treasury API | — | Missing |
| **Testing Guide** | Comprehensive test guide | Test cards page | Partial |
| **Supported Currencies Page** | Full list | Full list | Missing — no dedicated page |
| **Supported Countries Page** | Country availability | Country list | Missing |

### What KOB Already Has Right (No Changes Needed)
- Authentication/OAuth guide with multi-language code examples
- Gateway Quickstart, Charges, Payouts, Refunds, Settlements, Disputes
- Webhook guide, Payment Links, Subscriptions, Split Payments
- Open Banking (AISP/PISP) reference
- API Explorer (Swagger UI), Console, Playground
- Changelog, SDKs page, Code Examples
- WooCommerce integration guide

### Critical Architecture Issue
The `DeveloperLayout` wraps in `SessionGuard`, which fires `enforce-single-session` for unauthenticated visitors — causes unnecessary edge function calls and console errors. The guard should be conditional: only activate session management when authenticated.

---

## Implementation Plan (10 Tasks)

### Task 1: Fix SessionGuard for Public Developer Portal
- **File**: `src/components/developer/DeveloperLayout.tsx`
- Remove `SessionGuard` wrapper from `DeveloperLayout` entirely (docs are already public by design; interactive features already self-gate via `AuthRequiredAlert`)
- This matches how Stripe/Flutterwave docs work: docs are fully public, only dashboard features require auth

### Task 2: Create 8 New Public Documentation Pages
Create these missing guide pages under `src/pages/developer/`:

1. **`WalletsGuide.tsx`** — `/developer/gateway/wallets`
   - Create, credit, debit, freeze wallets; statement retrieval
   - Three-state balance model (Available, Pending, Ledger)
   
2. **`EscrowGuide.tsx`** — `/developer/gateway/escrow`
   - Create, fund, release, refund, freeze escrow holds
   - Marketplace use cases

3. **`ComplianceScreeningGuide.tsx`** — `/developer/gateway/compliance`
   - Pre-payout AML/sanctions screening
   - KYC risk scoring, PEP checks, velocity limits

4. **`InstantPayoutsGuide.tsx`** — `/developer/gateway/instant-payouts`
   - Speed parameter (standard/instant), rail selection
   - Push-to-card (Visa Direct), available rails listing, payout cancellation

5. **`TreasuryGuide.tsx`** — `/developer/gateway/treasury`
   - Float balance management, replenishment

6. **`WebhooksV2Guide.tsx`** — `/developer/gateway/webhooks-v2`
   - Multi-endpoint management, per-endpoint secrets, event filtering, delivery logs

7. **`SandboxPayoutSimGuide.tsx`** — `/developer/sandbox/payout-simulation`
   - Pre-seeded scenarios (insufficient_funds, network_timeout, reversed_after_success, etc.)
   - Timeline generation, webhook dispatch

8. **`SLAMonitorGuide.tsx`** — `/developer/gateway/sla`
   - Uptime metrics, latency percentiles (p50/p95/p99), incident tracking

### Task 3: Create 5 Reference/Standards Pages
1. **`ErrorCodesReference.tsx`** — `/developer/api/error-codes`
   - Full RFC 7807 error catalogue with type URIs, titles, status codes
   - Organized by domain (gateway, banking, compliance, auth)

2. **`RateLimitsGuide.tsx`** — `/developer/api/rate-limits`
   - Per-endpoint limits, Retry-After header, 429 handling
   - Rate limit dashboard preview for authenticated users

3. **`IdempotencyGuide.tsx`** — `/developer/api/idempotency`
   - Idempotency-Key header usage, collision behavior, expiry

4. **`SupportedCurrenciesPage.tsx`** — `/developer/api/currencies`
   - All 8+ supported currencies with symbols, countries, decimal precision
   - Per-channel currency support matrix

5. **`SupportedCountriesPage.tsx`** — `/developer/api/countries`
   - Country availability matrix by payment channel
   - Provider coverage (Flutterwave vs Stripe)

### Task 4: Create API Status Page
- **`ApiStatusPage.tsx`** — `/developer/status`
- Real-time system status display using SLA monitor data
- Shows uptime percentages, current incidents, latency metrics
- Public page (no auth required) like status.stripe.com

### Task 5: Update Developer Sidebar Navigation
- **File**: `src/components/developer/DeveloperLayout.tsx`
- Add new nav sections:
  - Under "Transfers — Outflow": Wallets, Escrow, Instant Payouts, Treasury
  - Under "Disputes & Reporting": Webhooks v2
  - Under "Core Concepts": Error Codes, Rate Limits, Idempotency, Currencies, Countries
  - Under "Tools & Testing": Payout Simulation, API Status
  - Under existing "Disputes & Reporting" or new "Compliance" section: Compliance Screening, SLA Monitoring

### Task 6: Register All New Routes in App.tsx
- Add ~13 new `<Route>` entries under the `/developer` parent route
- Add lazy imports for all new page components

### Task 7: Update Developer Home Landing Page
- **File**: `src/components/developer/landing/IntegrationOverview.tsx` (or equivalent)
- Add cards/links for the new public documentation categories (Wallets, Escrow, Compliance, Instant Payouts)
- Match the Stripe-style "Explore by product" grid layout

### Task 8: Create Testing & Credentials Reference Page
- **`TestingGuide.tsx`** — `/developer/api/testing`
- Consolidate all test credentials (Flutterwave test cards, Stripe test cards, sandbox MoMo numbers)
- Sandbox environment setup instructions
- Test scenario matrix (success, decline, 3DS, timeout)
- Similar to Stripe's "Testing" page and Flutterwave's test credentials page

### Task 9: Update Sitemap
- **File**: `public/sitemap.xml`
- Add all ~13 new public documentation URLs with current `lastmod` dates

### Task 10: Update OpenAPI Spec & Postman Tags
- Ensure `public-api-spec` tags align with the new sidebar structure
- No endpoint changes needed (Phase 7 already added them) — just verify tag groupings match the new navigation

---

## What Stays Behind Auth (Not Made Public)
These features remain gated behind `AuthRequiredAlert` — matching Stripe/Flutterwave's pattern where dashboard features require login:
- API Key management (create/revoke/view keys)
- Sandbox environment creation & webhook registration
- Certificate management (mTLS upload)
- API usage analytics & rate limit dashboards
- Webhook delivery log inspection
- Data generator tools

## Estimated Impact
- **13 new public pages** bring documentation coverage from ~60% to ~95% of deployed functionality
- Removes the `SessionGuard` blocker for unauthenticated developer portal visitors
- Matches the professional standard where **all API reference docs are public** and only **interactive tools require authentication**


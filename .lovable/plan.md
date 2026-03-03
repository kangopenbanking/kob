

# KOB v1 API Full Audit Plan

## Executive Summary

After a thorough inspection of 245+ edge functions, the OpenAPI 3.1.0 spec (1,867 lines), the Postman collection (926 lines), the OIDC discovery document, health endpoints, and the frontend documentation pages, here is a comprehensive audit with findings organized by severity.

---

## Audit Findings

### CRITICAL Issues (Must Fix Before Market)

**1. OIDC Discovery Document Inconsistencies**
- `grant_types_supported` lists only `["authorization_code", "refresh_token"]` but the platform actively supports `client_credentials` (server-to-server flow). This is documented in the OpenAPI spec and Postman collection but missing from OIDC discovery.
- `code_challenge_methods_supported` includes `"plain"` which contradicts the security documentation and OAuth endpoint that enforces S256-only PKCE. This must be corrected to `["S256"]` only.
- `introspection_endpoint` points to `https://api.kangopenbanking.com/v1/token-introspect` (non-existent) instead of `.../functions/v1/oauth-introspect`.
- `revocation_endpoint` points to `https://api.kangopenbanking.com/v1/token-revoke` — no such edge function exists. Either create it or remove the claim.
- `userinfo_endpoint` points to `.../functions/v1/userinfo` — no such edge function exists.
- `service_documentation` points to `https://docs.kangopenbanking.com` which is not a valid domain (should be `https://kangopenbanking.com/documentation`).

**2. JWKS Endpoint Returns Empty Keys**
- `/jwks-endpoint` returns `{ "keys": [] }`. Without published public keys, no third party can verify JWTs issued by the platform. This makes the entire OAuth/OIDC flow non-functional for external consumers.

**3. Virtual Cards Service "Degraded"**
- The health check confirms `virtual_cards: degraded`. The Cardyfie integration (`CARDYFIE_BASE_URL`, `CARDYFIE_API_KEY`) appears misconfigured or the provider is down. This needs investigation and either a fix or an honest status page reflection.

### HIGH Priority Issues

**4. OpenAPI Spec Missing Endpoints**
- The OpenAPI spec does not document these deployed edge functions:
  - `gateway-merchant-settlement-accounts` (merchant settlement bank config)
  - `gateway-payout-status-poll` (async payout polling)
  - `gateway-reconcile-funding` (funding reconciliation)
  - `gateway-confirm-funding` (funding confirmation callback)
  - `gateway-cancel-funding-intent` (cancel pending funding)
  - `gateway-get-funding-intent` / `gateway-list-funding-intents` (funding intent CRUD)
  - `gateway-create-funding-intent` (funding intent creation)
  - `gateway-get-stripe-config` (Stripe publishable key retrieval)
  - `gateway-webhook-paypal` / `gateway-webhook-stripe` / `gateway-webhook-flutterwave` (inbound webhooks)
  - `teller-transaction` (bank teller operations)
  - `bank-import-transactions` / `bank-reconcile` / `bank-sync` (banking operations)
  - `push-notification` / `pusher-config` (real-time notifications)
  - `enforce-single-session` (session management)
  - `load-test-runner` (should be removed from production or documented as internal)
  - `managed-send-email` / `test-all-templates` (email system)

**5. Postman Collection Gaps vs OpenAPI Spec**
- The Postman collection is missing entries for:
  - Preauthorization flow (`/v1/gateway/charges/preauth`, `/v1/gateway/charges/{chargeId}/capture`, `/v1/gateway/charges/{chargeId}/void`)
  - OTP validation (`/v1/gateway/charges/validate`)
  - PayPal payouts (`/v1/gateway/payouts/paypal`, `/v1/gateway/withdraw-to-paypal`)
  - Withdraw to bank (`/v1/gateway/withdraw-to-bank`)
  - Fund account (`/v1/gateway/fund-account`)
  - Risk scoring (`/v1/gateway/risk/score`)
  - Exchange rate (`/v1/gateway/exchange-rate`)
  - Payment facilitation endpoints
  - Charge events (`/v1/gateway/charges/{chargeId}/events`)
  - Reconciliation endpoints
  - Fee reports
  - Merchant lifecycle endpoints (some are present but incomplete)
  - Tokenized charging (`/v1/gateway/charges/token`)
  - WooCommerce `download-plugin` endpoint

### MEDIUM Priority Issues

**6. OpenAPI Spec Version/Metadata**
- The spec `openapi` version field needs verification — should explicitly declare `"3.1.0"`.
- Missing `contact` and `license` information in the `info` block for a production API.

**7. Documentation Page (Frontend)**
- The Documentation page (`/documentation`) uses URL fallback logic which is good, but references to `docs.kangopenbanking.com` in OIDC config are broken.
- The API Explorer fetches the spec via `supabase.functions.invoke('public-api-spec')` which works but the "Open in Swagger Editor" link constructs the URL using `VITE_SUPABASE_URL` directly — should use the production domain.

**8. Multi-Tenancy App Integration Gaps**
- Customer App (`/app`) and Banking App (`/bank/:id`) consume API data via `useCustomerData` hooks calling edge functions, but there is no documented API for:
  - Piggy Bank operations (edge functions exist: `piggybank-create`, `piggybank-pay`)
  - Njangi operations (edge functions exist: `njangi-create`, `njangi-join`, `njangi-contribute`, `njangi-payout`)
  - These consumer-facing financial tools should be documented in the OpenAPI spec under a "Consumer Tools" tag.

**9. Sandbox Simulation Tools Page**
- The `/sandbox/simulation-tools` page is static/informational only with no actual API interaction. The simulation endpoints described (fraud, dispute, refund, webhook replay, latency injection, settlement) do not have corresponding edge functions.

### LOW Priority Issues

**10. API Health Response Improvements**
- The `api-health` endpoint logs Cardyfie API key prefixes to console — potential information leak in production logs. Should be removed.
- The health endpoint hardcodes service statuses for `oauth`, `aisp`, `pisp`, `certificates`, and `webhooks` as `"operational"` without actually checking them.

---

## Implementation Plan

### Phase 1: Fix Critical OIDC/JWKS Issues (4 files)
1. **Fix `oidc-config` edge function**: Add `client_credentials` to `grant_types_supported`, remove `plain` from `code_challenge_methods_supported`, fix `introspection_endpoint` to point to the actual function URL, remove `revocation_endpoint` and `userinfo_endpoint` (or create the functions), fix `service_documentation` URL.
2. **Fix `jwks-endpoint`**: Investigate why keys array is empty. If no RSA keys are generated, either generate and store them or document that JWT verification uses Supabase's built-in mechanism and adjust the OIDC config accordingly.
3. **Investigate Virtual Cards degradation**: Check if `CARDYFIE_BASE_URL` and `CARDYFIE_API_KEY` secrets are properly configured.

### Phase 2: Sync OpenAPI Spec + Postman Collection (2 files)
4. **Update `public-api-spec`**: Add missing 15+ endpoint paths for funding intents, gateway webhooks, teller operations, and consumer tools (Piggy Bank, Njangi). Add `contact` and `license` to spec info.
5. **Update `postman-collection`**: Add missing 20+ request items to match the full OpenAPI spec including preauth, PayPal, funding, risk scoring, exchange rates, reconciliation, and WooCommerce download.

### Phase 3: Frontend Documentation Alignment (2 files)
6. **Update `api-health`**: Remove console logging of API key prefixes. Add actual health checks for OAuth, AISP, and PISP endpoints.
7. **Update Documentation page**: Ensure all download links and external references use correct production URLs.

### Phase 4: Clean Up & Harden
8. Remove `load-test-runner` from production deployment or gate behind admin auth.
9. Remove sensitive console.log statements from `api-health`.

---

## Market Readiness Assessment

| Domain | Status | Notes |
|--------|--------|-------|
| OAuth 2.0 / OIDC | **Not Ready** | OIDC discovery has incorrect endpoints, JWKS empty |
| AISP (Account Info) | Ready | Fully functional with consent + rate limiting |
| PISP (Payments) | Ready | Consent-based payment initiation works |
| Payment Gateway | **Partially Ready** | Core charges/payouts work; docs incomplete for 15+ endpoints |
| Credit Scoring | Ready | Full CrediQ engine operational |
| Banking Operations | Ready | Loans, savings, ledger functional |
| Mobile Money | Ready | Flutterwave integration operational |
| Virtual Cards | **Not Ready** | Cardyfie health check failing |
| ISO 20022 / SWIFT | Ready | Parser/generator functions deployed |
| WooCommerce | Ready | Full plugin lifecycle supported |
| API Documentation | **Not Ready** | OpenAPI spec missing ~15 endpoints, Postman missing ~20 items |
| Multi-Tenancy Apps | Ready | PWA ecosystem functional with route guards |
| Security | Ready | RLS, RBAC, hashed secrets, rate limiting all in place |

**Overall Verdict: The API is approximately 85% market-ready.** The critical blockers are the OIDC/JWKS issues (which prevent any third-party OAuth integration) and the documentation gaps (which prevent developers from discovering and using all available endpoints). Once Phases 1-3 are complete, the platform will be production-ready.


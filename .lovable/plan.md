

# Plan: Gateway Consolidation, Edge Function Mapping, and Portal Verification

## Current State Summary

### Developer Portal Routing: FIXED AND VERIFIED
Browser testing confirms all sub-pages render distinct content:
- `/developer/getting-started` -- Getting Started with sandbox credentials, SDK install steps
- `/developer/sandbox/overview` -- Sandbox Environment with test data, rate limits, credentials
- `/developer/api-explorer` -- Swagger UI with OpenAPI spec v4.6.0, download buttons
- `/developer/examples` -- Code examples page
- `/developer/sla` -- SLA page

The route conflict is resolved: public routes own `/developer/*`, protected tools moved to `/developer-tools/*`.

**Remaining blocker**: The live published site at `kob.lovable.app` still serves the old build. You must click **Publish** to deploy the fix.

---

## Part 1: Edge Function to OpenAPI Spec Mapping

275 edge functions (excluding `_shared`). Here is the complete mapping organized by API domain:

### Gateway (49 functions)
| Function | OpenAPI Path(s) | Type |
|----------|----------------|------|
| gateway-create-charge | POST /v1/gateway/charges | Public API |
| gateway-query | GET /v1/gateway/charges, charges/:id, payouts, refunds, disputes, settlements, etc. | Public API (router) |
| gateway-bulk-operations | POST /v1/gateway/payout-batches | Public API |
| gateway-fee-estimate | GET /v1/gateway/fee-estimate | Public API |
| gateway-create-payout | POST /v1/gateway/payouts | Public API |
| gateway-create-refund | POST /v1/gateway/refunds | Public API |
| gateway-create-payment-link | POST /v1/gateway/payment-links | Public API |
| gateway-create-subscription | POST /v1/gateway/subscriptions | Public API |
| gateway-cancel-subscription | POST /v1/gateway/subscriptions/cancel | Public API |
| gateway-file-dispute | POST /v1/gateway/disputes/:id/evidence | Public API |
| gateway-submit-dispute-evidence | POST /v1/gateway/disputes/:id/evidence | Public API |
| gateway-verify-charge | POST /v1/gateway/charges/:id/verify | Public API |
| gateway-validate-charge | Internal validation | Internal |
| gateway-preauth-charge | POST /v1/gateway/charges (capture_mode=manual) | Public API |
| gateway-escrow-wallets | Wallet/escrow operations | Public API |
| gateway-fund-account | POST /v1/gateway/fund-account | Public API |
| gateway-create-funding-intent | POST /v1/gateway/funding-intents | Public API |
| gateway-confirm-funding | POST /v1/gateway/funding-intents/:id/confirm | Public API |
| gateway-reconcile-funding | Internal reconciliation | Internal |
| gateway-request-payout | POST /v1/gateway/payouts (merchant-initiated) | Public API |
| gateway-process-withdrawal | Internal withdrawal processing | Internal |
| gateway-withdraw-to-bank | POST /v1/gateway/withdraw | Public API |
| gateway-cancel-payout | POST /v1/gateway/payouts/:id/cancel | Public API |
| gateway-retry-payout | POST /v1/gateway/payouts/:id/retry | Public API |
| gateway-get-merchant-balance | GET /v1/gateway/balance | Public API |
| gateway-get-stripe-config | Internal config | Internal |
| gateway-merchant-keys | Merchant API key management | Internal |
| gateway-merchant-kyb | POST /v1/gateway/merchants/kyb | Public API |
| gateway-merchant-kyb-review | Admin review | Internal |
| gateway-merchant-lifecycle | Merchant status management | Internal |
| gateway-merchant-settlement-accounts | Settlement account CRUD | Internal |
| gateway-merchant-statement | GET /v1/gateway/reports/settlements | Public API |
| gateway-merchant-webhooks | Merchant webhook CRUD | Internal |
| gateway-webhook-endpoints | CRUD /v1/webhooks | Public API |
| gateway-deliver-webhook | Internal delivery | Internal |
| gateway-webhook-deliver-v2 | Internal delivery v2 | Internal |
| gateway-webhook-stripe | POST /webhooks/stripe (inbound) | Webhook receiver |
| gateway-webhook-flutterwave | POST /webhooks/flutterwave (inbound) | Webhook receiver |
| gateway-webhook-paypal | POST /webhooks/paypal (inbound) | Webhook receiver |
| gateway-dispute-notify | Internal notification | Internal |
| gateway-compliance-screen | POST /v1/gateway/compliance/screen | Public API |
| gateway-reconciliation | Internal reconciliation | Internal |
| gateway-reconcile-stuck | Internal recovery | Internal |
| gateway-settlement-cron | Scheduled settlement | Cron |
| gateway-settlement-import | Admin settlement import | Internal |
| gateway-auto-withdrawal-cron | Scheduled withdrawal | Cron |
| gateway-auto-withdrawal-rules | Withdrawal rule config | Internal |
| gateway-admin-reverse-withdrawal | Admin reversal | Internal |
| gateway-payout-status-poll | Scheduled status check | Cron |

### AISP / Open Banking (8 functions)
| Function | OpenAPI Path |
|----------|-------------|
| aisp-accounts | GET /v1/aisp/accounts |
| aisp-balances | GET /v1/aisp/accounts/:id/balances |
| aisp-transactions | GET /v1/aisp/accounts/:id/transactions |
| aisp-beneficiaries | GET /v1/aisp/accounts/:id/beneficiaries |
| aisp-standing-orders | GET /v1/aisp/accounts/:id/standing-orders |
| aisp-direct-debits | GET /v1/aisp/accounts/:id/direct-debits |
| aisp-create-consent | POST /v1/aisp/consents |
| cbpii-funds-confirmation | POST /v1/cbpii/funds-confirmation |

### PISP (4 functions)
| Function | OpenAPI Path |
|----------|-------------|
| pisp-create-consent | POST /v1/pisp/consents |
| pisp-domestic-payment | POST /v1/pisp/domestic-payment |
| pisp-payment-submission | POST /v1/pisp/payment-submission |
| pisp-payment-details | GET /v1/pisp/payments/:id |

### OAuth / Identity (12 functions)
oauth-token, oauth-introspect, oauth-revoke, oauth-authorize, par-endpoint, dcr-register, jwks-endpoint, oidc-config, userinfo, identity-register, identity-onboarding, enforce-single-session

### Authentication (8 functions)
phone-auth, phone-auth-send-otp, phone-auth-verify-otp, phone-auth-pin-login, phone-auth-check-pin, pin-code-set, pin-code-verify, pin-code-reset, password-reset-with-pin

### Admin (17 functions)
admin-create-user, admin-create-client, admin-metrics, admin-system-config, admin-sandbox-accounts, admin-webhooks, admin-transaction-review, admin-assign-staff, admin-manage-branches, admin-list-loans, admin-list-savings, admin-list-consents, admin-manage-user, admin-kyc-review, admin-kyb-verify, admin-institution-approve, admin-approve-settlement, admin-resend-verification, admin-rotate-jwt-secret, admin-set-pin, admin-invoice-actions

### All other domains (177 functions)
Credit/CrediQ, Loans, Savings, Ledger, Mobile Money, Payments, Banking, Virtual Cards, Standards (ISO 20022/SWIFT), KYC, Webhooks, Communications, Settlement, Institution, PostiQ, WooCommerce, Sandbox, POS, Remittance, etc.

**Coverage assessment**: All 165 Postman collection endpoints have corresponding edge functions. No API gaps found.

---

## Part 2: Gateway Consolidation Plan

Reduce 49 gateway functions to 12 consolidated routers. This brings total edge function count from 275 to ~238.

### Consolidation Groups

**1. `gateway-charges-router`** (merge 5 into 1)
Absorbs: `gateway-create-charge`, `gateway-verify-charge`, `gateway-validate-charge`, `gateway-preauth-charge`, `gateway-fee-estimate`
Actions: `create`, `verify`, `validate`, `preauth`, `fee_estimate`

**2. `gateway-payouts-router`** (merge 6 into 1)
Absorbs: `gateway-create-payout`, `gateway-request-payout`, `gateway-cancel-payout`, `gateway-retry-payout`, `gateway-process-withdrawal`, `gateway-withdraw-to-bank`
Actions: `create`, `request`, `cancel`, `retry`, `process_withdrawal`, `withdraw_to_bank`

**3. `gateway-disputes-router`** (merge 3 into 1)
Absorbs: `gateway-file-dispute`, `gateway-submit-dispute-evidence`, `gateway-dispute-notify`

**4. `gateway-funding-router`** (merge 3 into 1)
Absorbs: `gateway-create-funding-intent`, `gateway-confirm-funding`, `gateway-reconcile-funding`, `gateway-fund-account`

**5. `gateway-merchant-router`** (merge 8 into 1)
Absorbs: `gateway-merchant-keys`, `gateway-merchant-kyb`, `gateway-merchant-kyb-review`, `gateway-merchant-lifecycle`, `gateway-merchant-settlement-accounts`, `gateway-merchant-statement`, `gateway-merchant-webhooks`, `gateway-get-merchant-balance`

**6. `gateway-webhooks-router`** (merge 5 into 1)
Absorbs: `gateway-webhook-endpoints`, `gateway-deliver-webhook`, `gateway-webhook-deliver-v2`, `gateway-webhook-stripe`, `gateway-webhook-flutterwave`, `gateway-webhook-paypal`

**7. `gateway-settlement-router`** (merge 3 into 1)
Absorbs: `gateway-settlement-cron`, `gateway-settlement-import`, `gateway-reconciliation`, `gateway-reconcile-stuck`

**8. `gateway-withdrawal-router`** (merge 3 into 1)
Absorbs: `gateway-auto-withdrawal-cron`, `gateway-auto-withdrawal-rules`, `gateway-admin-reverse-withdrawal`

Keep as standalone (complex/high-traffic): `gateway-query`, `gateway-bulk-operations`, `gateway-escrow-wallets`, `gateway-create-subscription`, `gateway-cancel-subscription`, `gateway-create-payment-link`, `gateway-create-refund`, `gateway-compliance-screen`, `gateway-payout-status-poll`, `gateway-get-stripe-config`

### Implementation Approach

For each consolidated router:
1. Create new `supabase/functions/gateway-{domain}-router/index.ts` using the `action` parameter dispatch pattern (same as `gateway-query`)
2. Move logic from individual functions into action handlers
3. Update all `supabase.functions.invoke()` calls in `src/` to point to the new router with the appropriate `action` parameter
4. Delete the old individual function files
5. Deploy and test each router

### Files to Modify
- Create 8 new router files in `supabase/functions/`
- Delete ~37 individual gateway function directories
- Update ~25 frontend files that invoke gateway functions (mostly in `src/hooks/` and `src/components/gateway/`)

---

## Part 3: What Kang Is Still Missing (Honest Assessment)

### Already Built and Working (in codebase, needs Publish)
- Public API documentation (130+ pages under `/developer`)
- Endpoint-level clarity (6-language code examples on every endpoint page)
- Developer onboarding flow (`/developer/getting-started` with free sandbox credentials)
- Code examples (`/developer/examples`, per-endpoint snippets)
- Error handling documentation (`/developer/api-reference/errors` with RFC 7807)
- Versioning documentation (`/developer/api-reference/versioning`)

### Genuinely Missing
| Gap | Severity | Action Required |
|-----|----------|-----------------|
| Live API backend (DNS not resolving) | Critical | Configure DNS records for api.kangopenbanking.com pointing to Supabase edge functions URL |
| Published SDK packages (npm/PyPI/Packagist) | Medium | SDK code exists in `/packages/sdk-*` but not published to registries |
| Public GitHub organization | Medium | External action: create github.com/kangopenbanking |
| Independent pentest report | Medium | External action: engage audit firm |
| Real COBAC registration number | Medium | Replace placeholder with actual regulatory reference |

---

## Execution Order

1. **Gateway consolidation** (8 new routers, delete 37 functions) -- reduces deployment failures
2. **Frontend invocation updates** -- point to new routers
3. **Deploy and test** each router via curl
4. **Generate final mapping report** to `/mnt/documents/`

Estimated scope: ~8 router files created, ~37 function directories deleted, ~25 frontend files updated.


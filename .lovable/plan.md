

## PayPal Integration into Kang Open Banking v1 API

### Feature Gap Analysis

**PayPal Capabilities Required vs Current KOB State:**

| Capability | PayPal API | KOB Current State | Gap |
|---|---|---|---|
| OAuth2 Token Exchange | `POST /v1/oauth2/token` (Basic Auth, client_credentials) | OAuth2 implemented for KOB's own clients (oauth-token) | Need PayPal-specific OAuth2 adapter |
| Payouts (Send Money) | `POST /v1/payments/payouts` (batch, up to 15k items) | Gateway payouts via Flutterwave only | Need PayPal payout adapter |
| Payout Status | `GET /v1/payments/payouts/{id}` | Status polling for Flutterwave only | Need PayPal status polling |
| Webhook Events | PayPal webhook signature verification (CRC32+SHA256) | HMAC-SHA256 webhook verification for Flutterwave/Stripe | Need PayPal webhook receiver |
| Withdrawals to Bank | PayPal doesn't expose a direct "withdraw to bank" API; this is a PayPal dashboard action | Withdrawal to bank via Flutterwave payout | Can model as "PayPal payout to bank" using PayPal Payouts API |
| Orders/Checkout | `POST /v2/checkout/orders` | Payment links exist for Stripe/Flutterwave | Optional — out of initial scope |
| Fee Calculation | PayPal fees are provider-side (not KOB-calculated) | Fee calculation in gateway-adapters.ts | Need PayPal fee tier |
| Status Mapping | PayPal statuses: SUCCESS, FAILED, PENDING, UNCLAIMED, RETURNED, ONHOLD, BLOCKED, REFUNDED, REVERSED | Mapping functions for Flutterwave & Stripe exist | Need `mapPayPalStatus()` |
| Provider in GatewayCharge schema | `flutterwave`, `stripe` | Two providers | Add `paypal` to enum |

**PayPal API Authentication:**
- OAuth2 client_credentials grant
- `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` (sandbox)
- `POST https://api-m.paypal.com/v1/oauth2/token` (production)
- Basic Auth: `client_id:client_secret`
- Returns `access_token` with `expires_in` (typically 32400s / 9 hours)
- Token must be cached and refreshed before expiry

**PayPal Payouts API:**
- `POST /v1/payments/payouts` — batch payouts (EMAIL, PHONE, PAYPAL_ID)
- `sender_batch_id` provides built-in idempotency (30-day window)
- Items: `recipient_type`, `amount`, `receiver`, `note`, `sender_item_id`
- Currencies: USD, EUR, GBP, etc. (XAF NOT directly supported — requires conversion)
- Webhook events: `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.FAILED`, `PAYMENT.PAYOUTS-ITEM.BLOCKED`, etc.

**PayPal Webhook Verification:**
- Uses transmission ID, timestamp, webhook ID, and CRC32 checksum
- Verify via `POST /v1/notifications/verify-webhook-signature`

---

### Implementation Plan

#### Phase 1: Secrets & PayPal OAuth2 Adapter

**1a. Request PayPal API credentials** (2 secrets needed):
- `PAYPAL_CLIENT_ID` — PayPal REST app client ID
- `PAYPAL_CLIENT_SECRET` — PayPal REST app client secret

**1b. Add PayPal adapter to gateway-adapters.ts:**
- `mapPayPalStatus()` — map PayPal payout item statuses to KOB canonical statuses
- `getPayPalAccessToken()` — OAuth2 token exchange with in-memory caching
- `createPayPalPayout()` — batch payout creation via PayPal Payouts API
- `getPayPalPayoutStatus()` — poll payout batch/item status
- `calculateGatewayFee()` — add `paypal` channel (3.5% + $0.25 USD equivalent)

**1c. Create edge function: `paypal-oauth-token/index.ts`**
- Internal utility endpoint for testing PayPal token exchange
- Validates credentials and returns token metadata (not the raw token)

#### Phase 2: PayPal Payouts Edge Function

**2a. Create edge function: `gateway-create-paypal-payout/index.ts`**
- Accepts: `merchant_id`, `amount`, `currency`, `recipient_type` (EMAIL/PHONE/PAYPAL_ID), `receiver`, `note`, `tx_ref`
- Calls `getPayPalAccessToken()` → `createPayPalPayout()`
- Records payout in `gateway_payouts` table with `provider = 'paypal'`
- Enforces idempotency via existing `idempotency_keys` table
- Enforces merchant risk limits via existing velocity checks

**2b. Create edge function: `gateway-get-paypal-payout/index.ts`**
- Poll PayPal payout batch/item status
- Update internal payout record status

#### Phase 3: PayPal Webhook Receiver

**3a. Create edge function: `gateway-webhook-paypal/index.ts`**
- Receives PayPal webhook events
- Verifies signature via PayPal's verify-webhook-signature API
- Handles events:
  - `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` → update payout status to `completed`
  - `PAYMENT.PAYOUTS-ITEM.FAILED` → update payout status to `failed`
  - `PAYMENT.PAYOUTS-ITEM.BLOCKED` → update payout status to `failed`
  - `PAYMENT.PAYOUTS-ITEM.UNCLAIMED` → update payout status to `pending`
  - `PAYMENT.PAYOUTS-ITEM.RETURNED` → update payout status to `failed`, trigger reversal
- Deduplication via `webhook_inbox` table
- Publishes to merchant outbound webhooks via existing `gateway-deliver-webhook`
- Logs to `audit_logs`

**3b. Add secret: `PAYPAL_WEBHOOK_ID`** — PayPal webhook ID for signature verification

#### Phase 4: PayPal Withdrawal Flow (KOB Account → PayPal → Bank)

**4a. Create edge function: `gateway-withdraw-to-paypal/index.ts`**
- Debits KOB account balance
- Initiates PayPal payout to user's PayPal email
- On webhook success, marks withdrawal as completed
- On webhook failure, reverses the debit (same pattern as `gateway-withdraw-to-bank`)

#### Phase 5: OpenAPI Spec & Postman Collection Updates

**5a. Update `public-api-spec/index.ts`:**
- Add `paypal` to `GatewayCharge.provider` and `GatewayPayout.channel` enums
- Add 3 new paths:
  - `POST /v1/gateway/payouts/paypal` — Create PayPal payout
  - `GET /v1/gateway/payouts/paypal/{payoutId}` — Get PayPal payout status
  - `POST /v1/gateway/withdraw-to-paypal` — Withdraw KOB balance to PayPal
- Add PayPal webhook event types to webhook documentation

**5b. Update `postman-collection/index.ts`:**
- Add "PayPal Payout" request
- Add "Get PayPal Payout Status" request
- Add "Withdraw to PayPal" request

#### Phase 6: Developer Portal Documentation

**6a. Create `src/pages/developer/PayPalIntegrationGuide.tsx`:**
- Authentication setup (how to get PayPal credentials)
- Payout flow with request/response examples
- Withdrawal flow with diagrams
- Webhook event reference
- Error codes and troubleshooting
- Currency limitations (XAF not directly supported — auto-conversion note)

**6b. Update `TransfersGuide.tsx`:**
- Add 7th transfer channel: "PayPal Payout" alongside the existing 6

**6c. Update `GatewayPayoutsGuide.tsx`:**
- Add PayPal payout endpoint documentation

**6d. Update `GatewayWebhooksGuide.tsx`:**
- Add PayPal webhook event types to event table

**6e. Add route in `App.tsx`:**
- `developer/gateway/paypal` → `PayPalIntegrationGuide`

**6f. Update `DeveloperLayout.tsx`:**
- Add "PayPal Integration" under "Integration Guides" section

#### Phase 7: Tests

**7a. Expand `gateway-integration.test.ts`:**
- PayPal status mapping tests (all 8 statuses)
- PayPal fee calculation test
- PayPal payout adapter schema validation
- Provider enum includes `paypal`

#### Phase 8: Changelog

**8a. Update `Changelog.tsx` to v2.5.0:**
- PayPal Payouts API — send money to PayPal/Venmo recipients
- PayPal Withdrawal — withdraw KOB balance to PayPal
- PayPal Webhook receiver with signature verification
- PayPal OAuth2 token adapter with auto-refresh
- Developer portal: PayPal Integration Guide
- OpenAPI spec & Postman collection updated with PayPal endpoints

---

### Files to Create (4)

| File | Purpose |
|---|---|
| `supabase/functions/gateway-create-paypal-payout/index.ts` | PayPal batch payout edge function |
| `supabase/functions/gateway-webhook-paypal/index.ts` | PayPal webhook receiver with signature verification |
| `supabase/functions/gateway-withdraw-to-paypal/index.ts` | Withdraw KOB balance to PayPal recipient |
| `src/pages/developer/PayPalIntegrationGuide.tsx` | Developer portal documentation page |

### Files to Modify (8)

| File | Change |
|---|---|
| `supabase/functions/_shared/gateway-adapters.ts` | Add `mapPayPalStatus()`, `getPayPalAccessToken()`, `createPayPalPayout()`, PayPal fee tier |
| `supabase/functions/public-api-spec/index.ts` | Add 3 PayPal paths, update provider enums |
| `supabase/functions/postman-collection/index.ts` | Add 3 PayPal requests |
| `src/pages/developer/TransfersGuide.tsx` | Add PayPal as 7th transfer channel |
| `src/pages/developer/GatewayPayoutsGuide.tsx` | Add PayPal payout endpoint |
| `src/pages/developer/GatewayWebhooksGuide.tsx` | Add PayPal webhook events |
| `src/components/developer/DeveloperLayout.tsx` | Add PayPal nav item |
| `src/App.tsx` | Add PayPal guide route |
| `src/pages/developer/Changelog.tsx` | Add v2.5.0 entry |
| `src/test/gateway-integration.test.ts` | Add PayPal adapter tests |

### Secrets Required (3)

| Secret | Source |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal Developer Dashboard → App → Client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Dashboard → App → Secret |
| `PAYPAL_WEBHOOK_ID` | PayPal Developer Dashboard → Webhooks → Webhook ID |

### Non-Breaking Guarantee

All changes are additive. Existing Flutterwave and Stripe flows are untouched. The `paypal` provider is added alongside existing providers in enums and adapters. No database schema changes required — PayPal payouts use the existing `gateway_payouts` table with `provider = 'paypal'`.

### Currency Note

PayPal does not directly support XAF. The integration will document that PayPal payouts must use supported currencies (USD, EUR, GBP) and that merchants should use the existing `/v1/gateway/exchange-rate` endpoint for conversion before initiating PayPal payouts.


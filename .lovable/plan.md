

## Audit: Current State vs. Required "Funding Intents" Domain

**What exists today:**
- `gateway-fund-account` edge function: routes to Flutterwave (MoMo/bank) or Stripe (card), stores record in `gateway_charges`, uses idempotency
- `gateway-withdraw-to-bank` edge function: Flutterwave payouts, immediate debit + reversal on failure
- `gateway-webhook-flutterwave`: auto-credits KOB account for `fund_account` charges on success
- `gateway-webhook-stripe`: handles `payment_intent.*` events but does NOT auto-credit fund_account charges
- `gateway-webhook-paypal`: handles payouts only — no funding/charge flow
- `gateway-adapters.ts`: shared adapters for Flutterwave, Stripe, PayPal (payouts + OAuth2 + webhook verify)
- `GatewayFundingGuide.tsx`: docs page covering fund-account and withdraw-to-bank
- `Changelog.tsx`: in-app changelog with release entries

**What is missing:**
1. `funding_intents` canonical table (currently reuses `gateway_charges`)
2. `funding_events` immutable event log
3. PayPal as a funding inbound channel (currently outbound payouts only)
4. Bank transfer funding instructions + reference matching
5. Stripe webhook auto-credit for fund_account charges
6. Dedicated funding reconciliation job
7. Admin funding ops endpoints
8. New API route pattern (`/v1/accounts/{id}/funding-intents`)
9. Comprehensive developer docs section
10. E2E test suite for all 4 funding methods

---

## Implementation Plan

### Phase 1 — Database Migration

Create additive migration with:

**Table `funding_intents`:**
- `id uuid PK DEFAULT gen_random_uuid()`
- `account_id uuid NOT NULL` (FK accounts)
- `user_id uuid NOT NULL`
- `institution_id uuid`
- `amount numeric NOT NULL`
- `currency text DEFAULT 'XAF'`
- `method text NOT NULL` (mobile_money | card | paypal | bank_transfer)
- `provider text NOT NULL` (flutterwave | stripe | paypal | bank)
- `status text DEFAULT 'created'` (created | pending_provider | pending_customer_action | pending_verification | succeeded | failed | cancelled | expired)
- `reference text`
- `idempotency_key text`
- `provider_reference text`
- `provider_payload jsonb DEFAULT '{}'`
- `failure_code text`, `failure_message text`
- `fee_amount numeric DEFAULT 0`, `net_amount numeric DEFAULT 0`
- `next_action jsonb` (client_secret, approval_url, bank instructions)
- `return_url text`
- `metadata jsonb DEFAULT '{}'`
- `expires_at timestamptz`
- `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- RLS: users read/insert own intents, service_role full access
- Unique index on `(account_id, idempotency_key)` where idempotency_key is not null

**Table `funding_events`:**
- `id uuid PK`, `funding_intent_id uuid FK`, `event_type text`, `payload jsonb`, `created_at timestamptz DEFAULT now()`
- RLS: service_role only for insert, users can read own (via intent join)

**Trigger:** `updated_at` auto-update on `funding_intents`

### Phase 2 — Edge Functions (6 new/updated)

**2a. `gateway-create-funding-intent/index.ts`** (NEW)
- POST handler: auth user, validate input (amount > 0, valid method/provider, account ownership)
- Idempotency check via `funding_intents.idempotency_key`
- Fee calculation via `calculateGatewayFee`
- Route by provider:
  - **Flutterwave (MoMo/bank):** call `createFlutterwaveCharge`, store provider_reference, return redirect_url
  - **Stripe (card):** call `createStripeCharge`, return `client_secret` in `next_action`
  - **PayPal:** create PayPal order via Orders API v2, return `approval_url` in `next_action`
  - **Bank transfer:** generate unique reference + bank instructions in `next_action`, set `expires_at` to +48h
- Insert `funding_intents` record + `funding_events` entry (type: `created`)
- Return intent object with `next_action`

**2b. `gateway-get-funding-intent/index.ts`** (NEW)
- GET by intent ID, verify account ownership

**2c. `gateway-list-funding-intents/index.ts`** (NEW)
- GET with filters: status, from/to dates, limit/offset
- Scoped to user's account

**2d. `gateway-cancel-funding-intent/index.ts`** (NEW)
- POST: only if status is non-final (created, pending_*)
- Update status to `cancelled`, record `funding_events` entry

**2e. Update `gateway-webhook-flutterwave`**
- After existing charge logic, also look up `funding_intents` by `provider_reference`
- On success: update intent status to `succeeded`, call `creditAccount()`, record `funding_events`

**2f. Update `gateway-webhook-stripe`**
- Add fund_account auto-credit logic (matching the Flutterwave webhook pattern)
- Also look up `funding_intents` by `provider_reference` (Stripe PI id)
- On `payment_intent.succeeded`: update intent, credit account, record event

**2g. Update `gateway-webhook-paypal`**
- Add handling for `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` events
- Look up `funding_intents` by `provider_reference`
- On capture completed: update intent to `succeeded`, credit account, record event

**2h. `gateway-reconcile-funding/index.ts`** (NEW)
- Scan `funding_intents` stuck in non-final status > 30 min
- Poll provider status (Flutterwave verify, Stripe retrieve, PayPal get order)
- Finalize or expire intents > 24h
- Record events

**2i. PayPal adapter additions in `gateway-adapters.ts`**
- Add `createPayPalOrder()`: creates PayPal checkout order, returns order_id + approval_url
- Add `capturePayPalOrder()`: captures approved order
- Add `getPayPalOrderStatus()`: retrieves order status for reconciliation

### Phase 3 — Config Updates

**`supabase/config.toml`** — add entries for new edge functions:
- `gateway-create-funding-intent`, `gateway-get-funding-intent`, `gateway-list-funding-intents`, `gateway-cancel-funding-intent`, `gateway-reconcile-funding` (all `verify_jwt = false`)

### Phase 4 — Developer Documentation

**4a. New page `src/pages/developer/FundingIntentsGuide.tsx`**
Comprehensive docs covering:
1. Overview: Funding Intent lifecycle, status diagram, idempotency
2. Create Funding Intent endpoint with examples for all 4 methods
3. Get/List/Cancel endpoints
4. Provider-specific flows (MoMo STK push, Stripe client_secret, PayPal redirect, bank reference)
5. Webhook finalization explanation
6. Error codes and troubleshooting
7. Sandbox testing guide
8. Code samples (curl, Node.js, Python)

**4b. Update `GatewayFundingGuide.tsx`**
- Add link to new Funding Intents Guide as the recommended API
- Mark `gateway-fund-account` as legacy/simplified endpoint

**4c. Update `Changelog.tsx`**
- Add v1.2.0 release entry with:
  - Funding Intents domain (4 endpoints)
  - PayPal funding support
  - Bank transfer funding instructions
  - Funding reconciliation
  - Stripe auto-credit for fund_account

**4d. Update routing** to include new docs page

### Phase 5 — E2E Tests

**`src/test/funding-intents.test.tsx`**
- Test funding intent creation for each method
- Test intent status transitions
- Test cancel on non-final status
- Test idempotency (duplicate key returns same response)
- Test listing with filters
- Test webhook status mapping logic
- Test fee calculations for each channel
- Negative tests: expired intent, invalid method, insufficient validation

### Phase 6 — OpenAPI/Postman References

**Update `public-api-spec` and `postman-collection`** edge functions:
- Add `Account Funding` tag with 4 new endpoints
- Add `FundingIntent`, `FundingEvent`, `FundingNextAction` schemas
- Add request/response examples for all methods

---

## Technical Details

### Ledger Posting on Successful Funding
```
Debit:  Provider Clearing (asset)      — amount
Credit: Customer Account (liability)   — amount
Debit:  Customer Account (liability)   — fee_amount
Credit: Fee Income (revenue)           — fee_amount
```

### Status Machine
```text
created → pending_provider → pending_customer_action → succeeded
                           → pending_verification    → succeeded
                           → failed
created → cancelled
any non-final → expired (via reconciliation after 24h)
```

### PayPal Order Flow
1. Create intent → `createPayPalOrder()` → return `approval_url`
2. Customer approves on PayPal → redirected to `return_url`
3. Webhook `PAYMENT.CAPTURE.COMPLETED` → finalize intent → credit account

### Files to Create/Modify
- **Create:** migration SQL, 5 new edge functions, `FundingIntentsGuide.tsx`, test file
- **Modify:** `gateway-webhook-flutterwave`, `gateway-webhook-stripe`, `gateway-webhook-paypal`, `gateway-adapters.ts`, `config.toml`, `Changelog.tsx`, `GatewayFundingGuide.tsx`, routing config, `public-api-spec`, `postman-collection`


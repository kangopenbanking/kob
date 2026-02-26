

## End-to-End Gateway Integration Audit, Enhancement & Documentation Plan

This plan covers a comprehensive audit of the existing Flutterwave and Stripe gateway middleware, identifies missing "add funds" and bank transfer features, creates new edge functions, writes E2E tests at each stage, and synchronizes all documentation.

---

### Current State Summary

**What exists:**
- **Flutterwave Mobile Money**: `gateway-create-charge` (channel=mobile_money → Flutterwave), `facilitated-mobile-money-charge`, `mobile-money-to-bank`, webhooks via `gateway-webhook-flutterwave` and `flutterwave-transfer-webhook`
- **Stripe Card Payments**: `gateway-create-charge` (channel=card → Stripe), `stripe-payment-intent`, `stripe-confirm-payment`, webhooks via `gateway-webhook-stripe`
- **Bank Transfers**: `flutterwave-bank-transfer` (outbound), `facilitated-bank-transfer`, `api-transfers` (internal account-to-account)
- **Shared Adapters**: `_shared/gateway-adapters.ts` with `createFlutterwaveCharge`, `createStripeCharge`, `createFlutterwavePayout`, `createStripeRefund`, fee calculation
- **Missing**: No dedicated "add funds to account" endpoint that uses Flutterwave/Stripe to credit a user's KOB account. No "payout to external bank from user account" via gateway. No bank-to-bank transfer via Flutterwave for arbitrary users.

**What's missing / needs implementation:**
1. `gateway-fund-account` — Allow users to add funds to their KOB account via Flutterwave (MoMo/bank) or Stripe (card)
2. `gateway-withdraw-to-bank` — Allow users to withdraw from their KOB account to an external bank account via Flutterwave transfers
3. `gateway-account-to-bank` — Transfer from KOB user account to external bank (Flutterwave payout)
4. Tests for all existing and new gateway functions
5. Documentation updates across OpenAPI spec, Postman collection, static openapi.json, and all developer pages

---

### Implementation Stages (with tests at each stage)

#### Stage 1: E2E Test Suite for Existing Gateway Functions
Create `src/test/gateway-integration.test.ts` covering:
- Gateway adapter unit tests (fee calculation, status mapping for both providers)
- API config validation (existing endpoints reachable)
- Component rendering tests for all Gateway developer pages

#### Stage 2: New Edge Function — `gateway-fund-account`
Create `supabase/functions/gateway-fund-account/index.ts`:
- Accepts `{ amount, currency, channel, source_phone?, source_email?, account_id }`
- Routes to Flutterwave (mobile_money/bank_transfer) or Stripe (card) based on channel
- On webhook completion, credits the user's KOB `account_balances` (InterimAvailable)
- Records transaction in `transactions` table with `credit_debit_indicator: 'Credit'`
- Integrates with ledger (DR Payment Gateway Receivable, CR Customer Account)
- Audit trail via `audit_logs`

**Test**: Edge function test validating request/response schema and error handling

#### Stage 3: New Edge Function — `gateway-withdraw-to-bank`
Create `supabase/functions/gateway-withdraw-to-bank/index.ts`:
- Accepts `{ amount, account_id, bank_code, account_number, beneficiary_name, narration }`
- Validates sufficient balance in user's KOB account
- Debits user's `account_balances`
- Initiates Flutterwave transfer via `createFlutterwavePayout`
- Records debit transaction
- Webhook updates status on completion/failure; reverses debit if failed

**Test**: Validate balance check, debit logic, and Flutterwave payout call structure

#### Stage 4: Update Webhook Handlers
- **`gateway-webhook-flutterwave`**: Add handler for `fund-account` charge completions — detect `metadata.fund_account: true` and auto-credit the target account
- **`flutterwave-transfer-webhook`**: Add handler for `withdraw-to-bank` transfer completions — update withdrawal status, reverse debit if failed

**Test**: Webhook payload processing for new transaction types

#### Stage 5: Update Gateway Adapters
- Add `createFlutterwaveBankCharge` to `_shared/gateway-adapters.ts` for direct bank debit charges (Flutterwave's `?type=debit_cm_account`)
- Add fee tier for `account_funding` channel type

**Test**: Adapter unit tests for new charge type and fee calculation

#### Stage 6: Update OpenAPI Specification
Add to `supabase/functions/public-api-spec/index.ts`:
```text
/v1/gateway/fund-account        POST  — Fund a KOB account via MoMo/Card/Bank
/v1/gateway/withdraw-to-bank    POST  — Withdraw from KOB account to external bank
```

Update `public/openapi.json` with matching static entries.

**Test**: API config test validates new endpoints exist in spec

#### Stage 7: Update Postman Collection
Add new requests to `supabase/functions/postman-collection/index.ts`:
- "Fund Account via Mobile Money"
- "Fund Account via Card"
- "Withdraw to External Bank"

#### Stage 8: Update Developer Portal Pages
1. **New page**: `src/pages/developer/GatewayFundingGuide.tsx` — Add Funds & Withdrawals documentation with code samples (cURL, Node.js, Python)
2. **Update `BankingReference.tsx`**: Add "Fund Account" and "Withdraw to Bank" sections with API endpoint references
3. **Update `GatewayChargesGuide.tsx`**: Add note about account funding channel
4. **Update `GatewayPayoutsGuide.tsx`**: Add note about user withdrawal flow
5. **Update `DeveloperHome.tsx` landing page**: Add "Account Funding" use case card
6. **Update `CodeSnippetSection.tsx`**: Add funding example snippet
7. **Add route** in `DeveloperLayout.tsx` sidebar navigation and `App.tsx` routing

#### Stage 9: Update Changelog
Add entries to `src/pages/developer/Changelog.tsx`:
- `gateway-fund-account` endpoint added
- `gateway-withdraw-to-bank` endpoint added
- Banking API enhanced with funding and withdrawal flows
- Documentation synchronized

#### Stage 10: Final E2E Test Suite
Create comprehensive `src/test/gateway-e2e.test.ts`:
- All gateway developer pages render without errors
- OpenAPI spec includes all new endpoints
- Fee calculations are correct for all channels including new `account_funding`
- Navigation links in developer portal resolve correctly
- Adapter status mapping covers all provider states

---

### Technical Details

**Database**: No new tables required. Uses existing `transactions`, `account_balances`, `audit_logs`, and `gateway_charges` tables. The `gateway-fund-account` function will create entries in `gateway_charges` with `metadata.fund_account: true` for webhook correlation.

**Edge Functions** (2 new):
- `gateway-fund-account/index.ts` — ~120 lines
- `gateway-withdraw-to-bank/index.ts` — ~100 lines

**Config**: Add to `supabase/config.toml`:
```toml
[functions.gateway-fund-account]
verify_jwt = false

[functions.gateway-withdraw-to-bank]
verify_jwt = false
```

**Frontend Files** (1 new, ~8 updated):
- New: `GatewayFundingGuide.tsx`
- Updated: `BankingReference.tsx`, `GatewayChargesGuide.tsx`, `GatewayPayoutsGuide.tsx`, `DeveloperHome.tsx`, `CodeSnippetSection.tsx`, `DeveloperLayout.tsx`, `App.tsx`, `Changelog.tsx`

**Spec Files** (3 updated):
- `public-api-spec/index.ts`
- `public/openapi.json`
- `postman-collection/index.ts`

**Test Files** (2 new):
- `src/test/gateway-integration.test.ts`
- `src/test/gateway-e2e.test.ts`

---

### Non-Breaking Guarantee
All changes are additive. No existing endpoints, routes, or data structures are modified. New edge functions use the same shared adapter pattern. Existing webhook handlers gain additional `if` branches for new transaction types without altering current behavior.


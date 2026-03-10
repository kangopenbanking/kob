

# Plan: Consolidate Edge Functions to Reduce Deployment Timeouts

## Problem
The project has ~260 separate edge functions. The deployment pipeline times out bundling them all, causing persistent "Bundle generation timed out" and "connection reset" errors that block publishing.

## Strategy
Consolidate groups of closely related functions into single "router" functions that use an `action` parameter to dispatch internally. This preserves the same client API contract — the only change on the frontend is updating `supabase.functions.invoke('old-name', ...)` calls to `supabase.functions.invoke('new-name', { body: { action: 'old-action', ... } })`.

**Target: reduce from ~260 to ~140 functions** (eliminate ~120 separate deployable units).

## Consolidation Groups

### Group 1: Gateway List/Get → `gateway-query` (eliminates ~28 functions)
Merge all read-only gateway query functions into one router:
- `gateway-list-charges`, `gateway-list-refunds`, `gateway-list-payouts`, `gateway-list-settlements`, `gateway-list-disputes`, `gateway-list-beneficiaries`, `gateway-list-customers`, `gateway-list-customer-tokens`, `gateway-list-payment-links`, `gateway-list-payment-plans`, `gateway-list-subaccounts`, `gateway-list-subscriptions`, `gateway-list-virtual-accounts`, `gateway-list-funding-intents`, `gateway-list-wallet-ledger`
- `gateway-get-charge`, `gateway-get-refund`, `gateway-get-payout`, `gateway-get-settlement`, `gateway-get-dispute`, `gateway-get-customer`, `gateway-get-payment-link`, `gateway-get-payment-plan`, `gateway-get-subaccount`, `gateway-get-subscription`, `gateway-get-virtual-account`, `gateway-get-funding-intent`, `gateway-get-payout-batch`

Pattern: `{ action: 'list-charges' | 'get-charge' | ... }` routes to the appropriate handler internally.

### Group 2: Gateway Reports → `gateway-reports` (eliminates ~2 functions)
- `gateway-report-fees`, `gateway-report-settlements`, `gateway-report-transactions` → 1 function

### Group 3: Gateway Webhooks → `gateway-webhooks` (eliminates ~4 functions)
- `gateway-webhook-stripe`, `gateway-webhook-flutterwave`, `gateway-webhook-paypal`, `gateway-deliver-webhook`, `gateway-webhook-deliver-v2` → 1 function with provider routing

### Group 4: Gateway Webhook Endpoints → `gateway-webhook-mgmt` (eliminates ~1 function)
- `gateway-webhook-endpoints`, `gateway-merchant-webhooks` → 1 function

### Group 5: CrediQ Emails → `crediq-emails` (eliminates ~4 functions)
- `crediq-send-welcome-email`, `crediq-send-score-change-email`, `crediq-send-monthly-report`, `crediq-send-weekly-digest`, `crediq-send-goal-achieved-email` → 1 function
- No client-side callers — only invoked server-side from other edge functions

### Group 6: Credit Score Operations → `credit-score` (eliminates ~4 functions)
- `credit-score-calculate`, `credit-score-fetch`, `credit-score-engine`, `credit-score-simulate`, `credit-score-tips` → 1 function
- Client calls: `CreditScore.tsx`, `useBankingData.ts`, `ScoreSimulator.tsx` — update invoke names

### Group 7: Credit Operations → `credit-ops` (eliminates ~3 functions)
- `credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute` → 1 function

### Group 8: Virtual Cards → `virtual-cards` (eliminates ~4 functions)
- `virtual-card-create`, `virtual-card-list`, `virtual-card-topup`, `virtual-card-update-status`, `virtual-card-transactions` → 1 function
- All share the same Cardyfie API helper — deduplicates that code too

### Group 9: Sandbox → `sandbox` (eliminates ~5 functions)
- `sandbox-create-account`, `sandbox-create-api-key`, `sandbox-generate-data`, `sandbox-register-webhook`, `sandbox-test-webhook`, `sandbox-trigger-webhook`, `sandbox-validate-api-key` → 1 function

### Group 10: Loan Operations → `loan-ops` (eliminates ~5 functions)
- `loan-apply`, `loan-approve`, `loan-calculate`, `loan-disburse`, `loan-repay`, `loan-overdue-detect` → 1 function

### Group 11: Savings Operations → `savings-ops` (eliminates ~3 functions)
- `savings-create`, `savings-deposit`, `savings-withdraw`, `savings-accrue-interest` → 1 function

### Group 12: Njangi Operations → `njangi-ops` (eliminates ~4 functions)
- `njangi-create`, `njangi-join`, `njangi-contribute`, `njangi-payout`, `njangi-overdue-detect` → 1 function

### Group 13: PiggyBank → `piggybank` (eliminates ~2 functions)
- `piggybank-create`, `piggybank-pay`, `piggybank-overdue-detect` → 1 function

### Group 14: ISO 20022/SWIFT → `iso-messaging` (eliminates ~4 functions)
- `iso20022-camt053-parser`, `iso20022-pacs002-generator`, `iso20022-pacs008-generator`, `iso20022-pain001-parser`, `swift-mt103-generator`, `swift-mt103-parser`, `swift-mt940-parser` → 1 function

### Group 15: OAuth/OIDC → `oauth` (eliminates ~4 functions)
- `oauth-authorize`, `oauth-token`, `oauth-introspect`, `oauth-revoke`, `oidc-config`, `par-endpoint`, `jwks-endpoint` → 1 function (URL-path routing)

### Group 16: AISP → `aisp` (eliminates ~6 functions)
- `aisp-accounts`, `aisp-balances`, `aisp-beneficiaries`, `aisp-create-consent`, `aisp-direct-debits`, `aisp-standing-orders`, `aisp-transactions` → 1 function

### Group 17: Admin Operations → `admin-ops` (eliminates ~10 functions)
- `admin-approve-settlement`, `admin-assign-staff`, `admin-create-client`, `admin-create-user`, `admin-institution-approve`, `admin-invoice-actions`, `admin-kyb-verify`, `admin-kyc-review`, `admin-list-consents`, `admin-list-loans`, `admin-list-savings` → 1 function

### Group 18: Certificate Management → `certificate-mgmt` (eliminates ~3 functions)
- `certificate-upload`, `certificate-list`, `certificate-revoke`, `certificate-expiry-monitor` → 1 function

### Group 19: Captcha/SCA → `security-challenge` (eliminates ~3 functions)
- `captcha-generate`, `captcha-verify`, `sca-initiate`, `sca-verify` → 1 function

### Group 20: Woocommerce → `woocommerce` (eliminates ~4 functions)
- `woocommerce-register-merchant`, `woocommerce-process-payment`, `woocommerce-payment-webhook`, `woocommerce-transaction-sync`, `woocommerce-validate-install`, `woocommerce-download-plugin` → 1 function

### Group 21: CrediQ Compute → `crediq-compute` (eliminates ~2 functions)
- `crediq-calculate-health-metrics`, `crediq-generate-action-plan`, `crediq-generate-baseline-score`, `crediq-health-check` → 1 function

### Group 22: Gateway Payout Operations → `gateway-payout-ops` (eliminates ~5 functions)
- `gateway-create-payout`, `gateway-create-payout-batch`, `gateway-create-paypal-payout`, `gateway-cancel-payout`, `gateway-retry-payout`, `gateway-payout-status-poll`, `gateway-payout-rails`, `gateway-instant-payout`, `gateway-request-payout`, `gateway-payout-webhook` → 1 function

### Group 23: Gateway Charge Operations → `gateway-charge-ops` (eliminates ~6 functions)
- `gateway-create-charge`, `gateway-validate-charge`, `gateway-verify-charge`, `gateway-capture-charge`, `gateway-cancel-charge`, `gateway-void-charge`, `gateway-preauth-charge`, `gateway-charge-token`, `gateway-get-charge-events` → 1 function

### Group 24: Phone Auth → `phone-auth` (eliminates ~3 functions)
- `phone-auth-send-otp`, `phone-auth-verify-otp`, `phone-auth-pin-login`, `phone-auth-check-pin` → 1 function

### Group 25: PIN Management → `pin-mgmt` (eliminates ~2 functions)
- `pin-code-set`, `pin-code-verify`, `pin-code-reset`, `password-reset-with-pin` → 1 function

### Group 26: Flutterwave Utils → `flutterwave-utils` (eliminates ~1 function)
- `flutterwave-list-banks`, `flutterwave-verify-bank` → 1 function

### Group 27: Gateway Funding → `gateway-funding` (eliminates ~3 functions)
- `gateway-create-funding-intent`, `gateway-confirm-funding`, `gateway-cancel-funding-intent`, `gateway-reconcile-funding`, `gateway-fund-account` → 1 function

### Group 28: Gateway Withdrawal → `gateway-withdrawal` (eliminates ~2 functions)
- `gateway-withdraw-to-bank`, `gateway-withdraw-to-paypal`, `gateway-process-withdrawal`, `gateway-admin-reverse-withdrawal` → 1 function

## Implementation Approach

For each consolidated function:

1. **Create the new router function** with an `action` body parameter that dispatches to handler functions (all in the same `index.ts` file)
2. **Move logic** from each individual function into handler functions within the router
3. **Update client-side calls** (in `src/`) to use the new function name + action parameter
4. **Update server-side cross-calls** (in other edge functions) similarly
5. **Delete the old individual function directories**
6. **Update `config.toml`** — remove old entries, add new consolidated entries

## Execution Order (phased to reduce risk)

**Phase 1** — Highest impact, lowest client-side touch:
- Groups 5 (CrediQ emails — 0 client callers), 14 (ISO/SWIFT), 17 (Admin ops), 1 (Gateway queries)

**Phase 2** — Moderate client updates:
- Groups 8 (Virtual cards), 9 (Sandbox), 10 (Loans), 11 (Savings), 12 (Njangi)

**Phase 3** — Remaining:
- Groups 6, 7, 15, 16, 22, 23, 24, 25, and others

## Frontend Change Pattern

```typescript
// Before
await supabase.functions.invoke('virtual-card-create', { body: { card_name, program_id } });

// After
await supabase.functions.invoke('virtual-cards', { body: { action: 'create', card_name, program_id } });
```

## Estimated Result
- **Before**: ~260 edge functions
- **After**: ~140 edge functions (45% reduction)
- This should bring deployment well within timeout limits


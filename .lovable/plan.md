

# Full Payment Infrastructure Audit — Plan & Report

## Audit Scope

Systematic end-to-end verification of all payment-related edge functions, webhooks, database flows, cross-app synchronization, and error handling across the Kang Open Banking platform.

---

## 1. API Health Check — Findings

### Edge Functions Verified (Payment-Related)

| Function | Auth | CORS | Status |
|---|---|---|---|
| `stripe-payment-intent` | ✅ Bearer JWT | ✅ shared cors.ts | ✅ OK |
| `stripe-confirm-payment` | ⚠️ Webhook (no user auth) | ✅ | ✅ OK |
| `gateway-create-charge` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-create-refund` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-create-payout` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-preauth-charge` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-verify-charge` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-webhook-stripe` | ✅ HMAC-SHA256 sig | ✅ | ✅ OK |
| `gateway-webhook-flutterwave` | ✅ verif-hash | ✅ | ✅ OK |
| `gateway-webhook-paypal` | ✅ PayPal sig verify | ✅ | ✅ OK |
| `mobile-money-charge` | ✅ Bearer JWT | ✅ | ✅ OK |
| `flutterwave-bank-transfer` | ✅ Bearer JWT | ✅ | ✅ OK |
| `facilitated-mobile-money-charge` | ✅ Bearer JWT | ✅ | ✅ OK |
| `facilitated-bank-transfer` | ✅ Bearer JWT | ✅ | ✅ OK |
| `gateway-settlement-cron` | ✅ Cron auth | ✅ | ⚠️ Issue found |
| `gateway-reconcile-stuck` | ✅ Cron auth | ✅ | ✅ OK |
| `gateway-reconciliation` | ✅ Admin RBAC | ✅ | ✅ OK |

### Secrets Verified
All required provider secrets are configured: `STRIPE_SECRET_KEY`, `STRIPE_WEBSECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (as `PAYPAL_CLIENT_SECRET`), `PAYPAL_WEBHOOK_ID`.

⚠️ **Issue P1**: `PAYPAL_SECRET` is the expected env var name in `gateway-adapters.ts` (line 314), but the configured secret is `PAYPAL_CLIENT_SECRET`. This will cause PayPal payouts and webhook verification to fail with "PayPal credentials not configured".

---

## 2. Payment Provider Integration — Findings

### Stripe
- **Charge flow**: `stripe-payment-intent` → Stripe API → `stripe-confirm-payment` webhook → updates `card_payment_transactions`. ✅
- **Gateway charge flow**: `gateway-create-charge` (channel=card) → `createStripeCharge` adapter → PaymentIntent → webhook updates `gateway_charges`. ✅
- **XAF handling**: `toStripeAmount()` correctly treats XAF as zero-decimal. ✅
- **Refund flow**: `gateway-create-refund` → `createStripeRefund` with correct XAF amount. ✅ Over-refund guard present. ✅

### Flutterwave Mobile Money
- **Charge flow**: `mobile-money-charge` → Flutterwave `/v3/charges?type=mobile_money_franco` → webhook updates `mobile_money_transactions`. ✅
- **Gateway charge flow**: `gateway-create-charge` (channel=mobile_money) → `createFlutterwaveCharge` adapter. ✅
- **Country detection**: Based on phone prefix (237=CM, 225=CI, etc.). ✅

### Local Bank Transfer
- **Transfer flow**: `flutterwave-bank-transfer` → Flutterwave `/v3/transfers`. ✅
- **Facilitated flow**: `facilitated-bank-transfer` → institution-scoped with KOB fee calculation. ✅
- **Bank list**: `flutterwave-list-banks` fetches from Flutterwave by country. ✅
- **Account verification**: `flutterwave-verify-bank` → `/v3/accounts/resolve`. ✅

### PayPal
- **Payout flow**: `gateway-create-paypal-payout` → PayPal Payouts API. ✅
- ⚠️ **Issue P1** (repeated): `PAYPAL_SECRET` env var mismatch — see above.

---

## 3. Webhook Processing — Findings

### Webhook Endpoints

| Webhook | Events Handled | Dedupe | Sig Verify | Wallet Update | Status |
|---|---|---|---|---|---|
| `gateway-webhook-stripe` | payment_intent.*, charge.dispute.*, charge.refunded | ✅ webhook_inbox | ✅ HMAC-SHA256 | ✅ atomic_charge_wallet_credit | ✅ |
| `gateway-webhook-flutterwave` | charge success/fail, payout success/fail, VA credit | ✅ webhook_inbox | ✅ verif-hash | ✅ atomic + upsert | ✅ |
| `gateway-webhook-paypal` | PAYMENT.CAPTURE.*, payout events | ✅ webhook_inbox | ✅ PayPal API verify | ✅ balance rollback | ✅ |
| `stripe-confirm-payment` | payment_intent.succeeded/failed | ⚠️ No dedupe | ⚠️ Optional sig | ✅ | ⚠️ Issues |
| `flutterwave-transfer-webhook` | transfer events | ✅ webhook_inbox | ✅ HMAC-SHA256 | ✅ | ✅ |

⚠️ **Issue P2**: `stripe-confirm-payment` has no deduplication and only optionally verifies the webhook signature (`STRIPE_WEBHOOK_SECRET` env var — **not configured** in secrets, it uses `STRIPE_WEBSECRET_KEY`). This is a **legacy duplicate** of `gateway-webhook-stripe` which handles the same events with proper security. The legacy endpoint could process duplicate events.

### Outbound Merchant Webhooks
- `gateway-webhook-events` table stores pending events → `gateway-deliver-webhook` / `gateway-webhook-deliver-v2` delivers them with HMAC signing. ✅
- Event types covered: `charge.successful`, `charge.failed`, `payout.completed`, `payout.failed`, `refund.completed`, `refund.failed`, `dispute.created`, `dispute.won`, `dispute.lost`, `virtualaccount.credit`. ✅

---

## 4. Database Validation — Findings

### Tables Updated Per Payment Flow

| Flow | Tables Updated | ID Matching | Status |
|---|---|---|---|
| Card Payment (legacy) | `card_payment_transactions` | stripe_payment_intent_id ↔ Stripe PI | ✅ |
| Gateway Charge | `gateway_charges`, `gateway_charge_events`, `gateway_merchant_wallets` | provider_ref ↔ Stripe PI / FLW ref | ✅ |
| Gateway Payout | `gateway_payouts`, `gateway_merchant_wallets` | provider_ref ↔ FLW transfer ID | ✅ |
| Gateway Refund | `gateway_refunds`, `gateway_merchant_wallets` | provider_ref ↔ Stripe refund ID | ✅ |
| MoMo Transaction | `mobile_money_transactions` | transaction_ref ↔ FLW tx_ref | ✅ |
| Bank Transfer | `bank_transfer_transactions` | transaction_ref ↔ FLW reference | ✅ |
| Funding Intent | `funding_intents`, `funding_events`, `account_balances`, `transactions` | provider_reference ↔ provider PI | ✅ |

### Status Lifecycle
- Charges: `pending` → `processing` → `successful`/`failed`/`cancelled`. ✅
- Payouts: `pending` → `submitted` → `completed`/`failed`. ✅
- Refunds: `pending` → `successful`/`failed` with over-refund guard. ✅

### Merchant Balance Updates
- Atomic DB functions (`atomic_charge_wallet_credit`, `atomic_refund_wallet_debit`, `atomic_dispute_wallet_adjust`) ensure consistency. ✅
- Settlement cron (`gateway-settlement-cron`) processes submitted payouts and handles wallet rollbacks on failure. ✅

---

## 5. Cross-App Synchronization — Findings

### Customer App → Merchant App Flow
- Customer initiates payment via `gateway-create-charge` or `pos-qr-payment`
- Webhook updates `gateway_charges` → `gateway_merchant_wallets`
- Merchant App reads from same tables (scoped by `merchant_id`)
- Business PWA subscribes to `pos_order_payments` realtime for instant notification. ✅

### Banking App Ledger
- `facilitated-mobile-money-charge` and `facilitated-bank-transfer` create entries in institution-scoped transaction tables
- `useRealtimeBalanceSync` hook subscribes to `account_balances` and `transactions` changes, scoped by institution. ✅
- Invalidates `bank-accounts`, `account-balances`, `spending-summary`, `bank-transactions`, `customer-transactions` caches. ✅

---

## 6. Real-Time Updates — Findings

- `useRealtimeBalanceSync`: Subscribed to `account_balances` + `transactions` with institution scoping. ✅
- `BusinessHome`/`BusinessReceive`: Realtime on `pos_order_payments` for merchant alerts. ✅
- `NotificationCenter`: Realtime on `system_alerts` + `app_notifications`. ✅
- `TransactionHistory`: Realtime on `transactions` table. ✅
- `CustomerInvoices`: Realtime on `customer_invoices`. ✅

---

## 7. Error Handling — Findings

### Duplicate Payment Prevention
- **Gateway charges**: Idempotency-key support on `gateway-create-charge`, `gateway-create-refund`, `gateway-create-payout`. ✅
- **Webhooks**: `webhook_inbox` deduplication on all 3 gateway webhook handlers. ✅
- **Over-refund guard**: Prevents refund total from exceeding original charge amount. ✅

### Failed Transaction Handling
- Failed payouts trigger wallet rollback via `update_merchant_wallet`. ✅
- Failed withdraw-to-bank triggers balance restoration via upsert on `account_balances`. ✅
- `gateway-reconcile-stuck` auto-resolves stuck charges/payouts > 30 minutes by polling provider APIs. ✅

### Rate Limiting
- Webhook endpoints enforce 100 req/min via `check_webhook_rate_limit`. ✅
- Merchant velocity checks on charge creation. ✅
- Daily charge/payout limit enforcement. ✅

---

## 8. Reconciliation — Findings

- **Automated**: `gateway-reconcile-stuck` polls Stripe/Flutterwave for stuck transactions. ✅
- **Formal**: `gateway-reconciliation` provides admin-only reconciliation runs with mismatch detection across charges, payouts, refunds. ✅
- **Settlement cron**: `gateway-settlement-cron` auto-fails payouts stuck > 24 hours and processes completions. ✅

⚠️ **Issue P3**: `gateway-settlement-cron` uses `simulateProviderPoll()` which returns simulated statuses based on age rather than actual provider API calls. The comment says "In production, this would call Flutterwave/Stripe/PayPal/Visa Direct APIs" — **this is still a simulation stub, not production-ready**.

---

## 9. Monitoring — Findings

- `system-health-check`: General system health monitoring. ✅
- `api-health-collector`/`api-health`: API endpoint health checks. ✅
- `health-alert-monitor`: Monitors for health anomalies. ✅
- `gateway-sla-monitor`: SLA monitoring for gateway operations. ✅
- `transaction-monitor`: Monitors transaction anomalies. ✅
- `ai-anomaly-detection`: AI-based anomaly detection. ✅
- Audit logging: All payment operations log to `audit_logs`. ✅

---

## Critical Issues Found

### P0 — Bugs Requiring Immediate Fix

**1. `LoanApplicationForm.tsx` calls non-existent `loan-calculate` function**
- Line 66: `supabase.functions.invoke('loan-calculate', ...)` 
- Should be: `supabase.functions.invoke('loan-ops', { body: { action: 'calculate', ... } })`
- Impact: Loan calculator fails with 404 for all users

**2. `CardPaymentForm.tsx` missing XAF currency option**
- Lines 148-153 only list USD, EUR, GBP — missing XAF (the platform's primary currency)
- Impact: Users in Cameroon cannot make card payments in their local currency

**3. `stripe-payment-intent` does not handle zero-decimal currencies**
- Line 53: `Math.round(amount * 100)` — always multiplies by 100
- For XAF, this is incorrect (should pass raw amount). The gateway adapter (`toStripeAmount`) handles this correctly, but the legacy `stripe-payment-intent` does not.
- Impact: XAF card payments would be charged 100x the intended amount

### P1 — Configuration Issues

**4. PayPal secret env var mismatch**
- `gateway-adapters.ts` reads `PAYPAL_SECRET` (line 314)
- Configured secret is `PAYPAL_CLIENT_SECRET`
- Impact: All PayPal payouts and webhook verification will fail

**5. `stripe-confirm-payment` is a legacy duplicate**
- No deduplication, optional signature verification
- The secure `gateway-webhook-stripe` handles the same events
- Impact: Potential double-processing of Stripe payment events if both webhooks are registered

### P2 — Production Readiness

**6. `gateway-settlement-cron` uses simulated provider polling**
- `simulateProviderPoll()` is a stub returning time-based statuses
- Must be replaced with actual Stripe/Flutterwave/PayPal API calls for production
- Impact: Settlements will auto-complete based on age, not actual provider confirmation

---

## Implementation Plan

### Fix 1: `LoanApplicationForm.tsx` — Route to consolidated `loan-ops`
Change `supabase.functions.invoke('loan-calculate', { body: { principal, ... } })` to `supabase.functions.invoke('loan-ops', { body: { action: 'calculate', principal, ... } })`.

### Fix 2: `CardPaymentForm.tsx` — Add XAF currency
Add `<SelectItem value="XAF">XAF (FCFA)</SelectItem>` to the currency selector.

### Fix 3: `stripe-payment-intent` — Use `toStripeAmount` logic
Import and use the zero-decimal currency check from the gateway adapters pattern, or inline the same `ZERO_DECIMAL_CURRENCIES` check.

### Fix 4: `gateway-adapters.ts` — Fix PayPal secret name
Change `Deno.env.get('PAYPAL_SECRET')` to `Deno.env.get('PAYPAL_CLIENT_SECRET')` on lines 314 and everywhere it's referenced.

### Fix 5: `stripe-confirm-payment` — Add deduplication and proper sig verification
Add `webhook_inbox` deduplication and align the webhook secret env var name with the configured `STRIPE_WEBSECRET_KEY`.

### Fix 6: `gateway-settlement-cron` — Replace simulation with real provider polling
Replace `simulateProviderPoll()` with actual API calls using `getFlutterwaveTransferStatus()`, `getStripePayoutStatus()`, and `getPayPalPayoutStatus()` from `gateway-adapters.ts`.

---

## Summary

| Category | Status | Issues |
|---|---|---|
| API Health | ✅ Healthy | 0 |
| Stripe Integration | ⚠️ | P0: XAF amount bug in legacy endpoint |
| Flutterwave Integration | ✅ Healthy | 0 |
| PayPal Integration | ❌ Broken | P1: Secret name mismatch |
| Webhook Processing | ⚠️ | P1: Legacy duplicate, no dedupe |
| Database Validation | ✅ Healthy | 0 |
| Cross-App Sync | ✅ Healthy | 0 |
| Real-Time Updates | ✅ Healthy | 0 |
| Error Handling | ✅ Robust | 0 |
| Reconciliation | ⚠️ | P2: Simulated polling in production |
| Monitoring | ✅ Comprehensive | 0 |
| Frontend Forms | ⚠️ | P0: Missing currency, broken loan calc |

**Total: 3 P0 bugs, 2 P1 issues, 1 P2 gap**


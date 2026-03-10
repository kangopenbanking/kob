

# Full Payment Infrastructure QA Report

## System Architecture Map

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Customer App   │    │   Merchant App   │    │   Banking App    │
│  (Consumer PWA)  │    │  (Merchant PWA)  │    │  (FI Dashboard)  │
└───────┬──────────┘    └───────┬──────────┘    └───────┬──────────┘
        │ supabase.functions.invoke()                   │
        ▼                       ▼                       ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Supabase Edge Functions (140+)                  │
│                                                                   │
│ CHARGE           PAYOUT            WEBHOOK           CRON         │
│ gateway-create-  gateway-create-   gateway-webhook-  settlement-  │
│   charge         payout            stripe            cron         │
│ stripe-payment-  gateway-instant-  gateway-webhook-  reconcile-   │
│   intent         payout            flutterwave       stuck        │
│ mobile-money-    gateway-push-to-  gateway-webhook-  reconcile-   │
│   charge         card              paypal            funding      │
│ facilitated-*    gateway-withdraw- stripe-confirm-                │
│                  to-bank/paypal    payment (legacy)               │
│                                                                   │
│ REFUND           RECONCILIATION    MONITORING                     │
│ gateway-create-  gateway-          gateway-sla-monitor            │
│   refund         reconciliation    transaction-monitor            │
│                                    ai-anomaly-detection           │
└──────────┬───────────────┬───────────────────┬────────────────────┘
           ▼               ▼                   ▼
    ┌──────────┐    ┌──────────────┐    ┌──────────┐
    │  Stripe  │    │ Flutterwave  │    │  PayPal  │
    └──────┬───┘    └──────┬───────┘    └──────┬───┘
           │ webhooks      │ webhooks          │ webhooks
           ▼               ▼                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Supabase Database (Source of Truth)              │
│  gateway_charges | gateway_payouts | gateway_refunds              │
│  gateway_disputes | gateway_merchant_wallets                      │
│  gateway_webhook_events | webhook_inbox                           │
│  settlement_runs | reconciliation_runs/mismatches                 │
│  card_payment_transactions | mobile_money_transactions            │
│  bank_transfer_transactions | account_balances | transactions     │
│  funding_intents | funding_events | audit_logs                    │
└──────────────────────────┬────────────────────────────────────────┘
                           │ Supabase Realtime
                           ▼
│  useRealtimeBalanceSync (account_balances + transactions)         │
│  POS Realtime (pos_order_payments)                                │
│  Notification Realtime (app_notifications)                        │
```

---

## Audit Results Summary

| Category | Status | Issues |
|---|---|---|
| API Health & Auth | PASS | 0 |
| Stripe Integration | PASS | 0 (previous fixes verified) |
| Flutterwave Integration | PASS | 0 |
| PayPal Integration | PASS | 0 (secret name fixed) |
| Webhook Security | PASS | 0 (dedupe + sig verified) |
| **Wallet Accounting** | **CRITICAL** | **1 P0** |
| Settlement Cron | PASS | 0 (provider polling fixed) |
| Reconciliation | PASS | 0 (wallet credit on stuck fixed) |
| Cross-App Sync | PASS | 0 |
| Real-Time Updates | PASS | 0 |
| Idempotency | PASS | 0 |
| Test Coverage | WARNING | 1 P2 gap |
| Load Testing | PASS | Infrastructure exists |

---

## P0 Bug Found: Merchant wallet NOT debited on payout creation

**File**: `supabase/functions/gateway-create-payout/index.ts`

**Problem**: When a merchant creates a payout, the function:
1. Validates the merchant (line 25)
2. Checks daily payout limits (line 29-36)
3. Creates the payout record (line 46-51)
4. Calls Flutterwave to send funds (line 56)
5. **Never debits the merchant wallet**

The `failPayout` helper in `gateway-settlement-cron` (line 221-228) does a wallet rollback by **crediting** the wallet back — which assumes a debit already happened. But the debit never occurred.

**Impact**: Merchants can create unlimited payouts without their wallet balance decreasing. They can extract funds without limit. This is a **funds leakage vulnerability**.

**Evidence**: 
- `gateway-instant-payout` correctly debits wallet at line 172-176 before calling provider
- `gateway-push-to-card` correctly debits wallet at line 165-169
- `gateway-withdraw-to-bank` correctly debits account balance at line 75-77
- `gateway-create-payout` has **zero** wallet debit calls

**Fix**: Add wallet debit immediately after creating the payout record (before calling the provider). On provider failure, the existing rollback in `failPayout` will correctly restore the balance.

---

## P2 Gap: Test suite needs payout wallet debit verification

The existing `payment-tests/index.test.ts` covers auth rejection and CORS for 12 endpoints. A test verifying that payout creation triggers a wallet debit should be added (requires authenticated merchant context, so this is a manual/integration test).

---

## Implementation Plan

### Fix 1: `gateway-create-payout/index.ts` — Add wallet debit before provider call

After the payout record is created (line 51) and before calling the provider (line 55), add:

```typescript
// Debit merchant wallet BEFORE calling provider
const totalDebit = amount + fee;
await supabase.rpc('update_merchant_wallet', {
  _merchant_id: merchant_id,
  _currency: currency,
  _available_delta: -totalDebit,
  _ledger_delta: -totalDebit,
});
```

Also add a balance check before allowing the payout:
```typescript
const { data: wallet } = await supabase
  .from('gateway_merchant_wallets')
  .select('available_balance')
  .eq('merchant_id', merchant_id)
  .eq('currency', currency)
  .maybeSingle();

if (!wallet || wallet.available_balance < (amount + fee)) {
  return error('insufficient_balance', 400);
}
```

### Fix 2: Add payout wallet test to `payment-tests/index.test.ts`

Add a test that verifies `gateway-create-payout` rejects unauthenticated calls and validates required fields.

---

## Verified Systems (No Issues)

- **Stripe webhook** (`gateway-webhook-stripe`): HMAC-SHA256 mandatory, `webhook_inbox` dedupe, `atomic_charge_wallet_credit` on success
- **Flutterwave webhook** (`gateway-webhook-flutterwave`): verif-hash mandatory, dedupe, atomic credit, fund_account handling, VA credit
- **PayPal webhook** (`gateway-webhook-paypal`): PayPal API sig verification, dedupe, withdrawal reversal on failure
- **Legacy Stripe webhook** (`stripe-confirm-payment`): Signature mandatory via `STRIPE_WEBSECRET_KEY`, `webhook_inbox` dedupe with `stripe_legacy` prefix
- **Settlement cron**: Real provider polling via adapters, 24h auto-fail, float management, wallet rollback
- **Reconcile stuck**: Atomic wallet credit on successful resolution, 30min threshold
- **Formal reconciliation**: Admin RBAC, mismatch detection + resolution API
- **Charge creation**: Idempotency, velocity checks, daily limits, fee bearer support, split payments
- **Refund creation**: Over-refund guard, idempotency, wallet debit on success
- **Load test runner**: Admin RBAC, safety limits (50 concurrent, 30s max), persisted results
- **Real-time sync**: Institution-scoped via `useRealtimeBalanceSync`, KANG- prefix exclusion
- **Cross-app sync**: Customer QR → POS → merchant realtime notification chain verified


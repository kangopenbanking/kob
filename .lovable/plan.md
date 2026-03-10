

# Full Payment Infrastructure QA Report & Fix Plan

## System Architecture Map

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Customer App   │    │   Merchant App   │    │   Banking App    │
│  (Consumer PWA)  │    │  (Merchant PWA)  │    │  (FI Dashboard)  │
└───────┬──────────┘    └───────┬──────────┘    └───────┬──────────┘
        │                       │                       │
        │  supabase.functions.invoke()                  │
        │  Supabase Realtime subscriptions              │
        ▼                       ▼                       ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Supabase Edge Functions                       │
│                                                                   │
│  CHARGE PATH         PAYOUT PATH          WEBHOOK PATH            │
│  gateway-create─     gateway-create─      gateway-webhook─        │
│    charge            payout               stripe/flutterwave/     │
│  stripe-payment─     gateway-instant─       paypal                │
│    intent            payout              stripe-confirm─payment   │
│  mobile-money─       gateway-push─to─    flutterwave-transfer─   │
│    charge            card                  webhook                │
│  facilitated─*       gateway-withdraw─                            │
│                      to-bank/paypal      CRON PATH                │
│                                          gateway-settlement─cron  │
│  REFUND PATH         RECONCILIATION      gateway-reconcile─stuck  │
│  gateway-create─     gateway─             gateway-reconciliation  │
│    refund            reconciliation                               │
└──────────┬───────────────┬───────────────────┬────────────────────┘
           │               │                   │
           ▼               ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    Stripe    │  │ Flutterwave  │  │    PayPal    │
│   (Cards)   │  │(MoMo/Bank)   │  │  (Payouts)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │   Webhooks      │   Webhooks      │   Webhooks
       ▼                 ▼                 ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Supabase Database (Source of Truth)              │
│                                                                   │
│  gateway_charges        gateway_payouts        gateway_refunds    │
│  gateway_disputes       gateway_merchant_wallets                  │
│  gateway_webhook_events gateway_charge_events                     │
│  webhook_inbox          settlement_runs                           │
│  reconciliation_runs    reconciliation_mismatches                 │
│  card_payment_transactions  mobile_money_transactions             │
│  bank_transfer_transactions account_balances  transactions        │
│  funding_intents        funding_events                            │
│  audit_logs             security_audit_logs                       │
└───────────────────────────────────────────────────────────────────┘
           │
           │  Supabase Realtime (postgres_changes)
           ▼
┌───────────────────────────────────────────────────────────────────┐
│  useRealtimeBalanceSync (account_balances + transactions)         │
│  POS Realtime (pos_order_payments)                                │
│  Notification Realtime (app_notifications + system_alerts)        │
└───────────────────────────────────────────────────────────────────┘
```

---

## Audit Summary

| Category | Status | Issues Found |
|---|---|---|
| API Health & Auth | PASS | 0 |
| Stripe Integration | PASS | 0 (P0 XAF bug already fixed) |
| Flutterwave Integration | PASS | 0 |
| PayPal Integration | PASS | 0 (secret name already fixed) |
| Webhook Processing | PASS | 0 (legacy dedupe already fixed) |
| Database Consistency | WARNING | 1 P0 bug found |
| Settlement Cron | WARNING | 1 P1 bug found |
| Cross-App Sync | PASS | 0 |
| Real-Time Updates | PASS | 0 |
| Error Handling & Idempotency | PASS | 0 |
| Reconciliation | WARNING | 1 P0 bug found |
| Test Coverage | WARNING | Missing payment-specific tests |

---

## Bugs Found

### P0-1: `gateway-reconcile-stuck` does not credit merchant wallet on successful resolution

**File**: `supabase/functions/gateway-reconcile-stuck/index.ts` lines 30-58

When a stuck charge is resolved as `successful` by polling the provider, the function only updates the `gateway_charges` status. It does NOT call `atomic_charge_wallet_credit` to credit the merchant's wallet. This means the merchant never receives the money for charges that were initially stuck but ultimately succeeded.

**Fix**: After updating a charge to `successful`, call `atomic_charge_wallet_credit` with the charge's `merchant_id`, `currency`, and `net_amount`.

### P1-2: `pollProviderStatus` in `gateway-settlement-cron` accesses non-existent `batch_status` property

**File**: `supabase/functions/gateway-settlement-cron/index.ts` line 318

`getPayPalPayoutStatus()` returns `PayoutResult` with `{ provider_ref, status, provider_raw }`. The `status` is already mapped via `mapPayPalStatus`. But `pollProviderStatus` checks `result.batch_status` which does not exist on the return type. This means PayPal payouts will never transition from `pending` — they'll always remain stuck until auto-failed at 24 hours.

**Fix**: Change `result.batch_status === 'SUCCESS'` to `result.status === 'successful'` and `result.batch_status === 'DENIED' || result.batch_status === 'CANCELED'` to `result.status === 'failed'`.

### P2-3: Missing comprehensive payment test suite

The existing tests only cover auth rejection scenarios. There are no tests for the core charge, refund, or webhook flows. A comprehensive test file should be created.

---

## Implementation Plan

### Fix 1: `gateway-reconcile-stuck` — Credit wallet on successful charge resolution

Add `atomic_charge_wallet_credit` calls when charges resolve as `successful` for both Flutterwave and Stripe paths. The charge record has `merchant_id`, `net_amount`, and `currency` available.

### Fix 2: `gateway-settlement-cron` — Fix PayPal status property access

Change lines 317-320 to use `result.status` instead of `result.batch_status`, since `getPayPalPayoutStatus` already maps the raw PayPal batch_status through `mapPayPalStatus`.

### Fix 3: Create comprehensive payment test suite

Create `supabase/functions/payment-tests/index.test.ts` with tests for:
- `gateway-create-charge` auth, validation, and idempotency
- `gateway-create-refund` auth and over-refund guard
- `gateway-create-payout` auth and validation
- `stripe-payment-intent` auth and zero-decimal currency handling
- `mobile-money-charge` auth
- `gateway-webhook-stripe` signature rejection
- `gateway-webhook-flutterwave` hash rejection
- `gateway-settlement-cron` CORS

This ensures automated regression testing for all payment-critical endpoints.


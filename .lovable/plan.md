
# KOB Payment Gateway -- Gap Analysis vs Flutterwave

## Current State Summary

The KOB gateway already has strong coverage across core payment operations:

**Fully Implemented (no action needed):**
- Charges (create, list, get, cancel, verify) with Flutterwave + Stripe adapters
- Payouts (create, list, get) + batch payouts
- Refunds (create, list, get) with webhook events
- Disputes (create via Stripe webhook, list, get, submit evidence)
- Settlements (list, get, report)
- Beneficiary management (CRUD)
- Merchant onboarding with KYB lifecycle
- Per-merchant API keys (sandbox/production)
- Webhook delivery with HMAC signing, 7-retry backoff, delivery logs
- Inbound webhook handlers (Flutterwave + Stripe) with dedupe
- Idempotency-Key on write endpoints
- Stuck transaction reconciliation cron (every 15 min)
- Fee breakdown on every transaction (percent + fixed)
- Merchant limits (single, daily, velocity)
- Audit trail logging
- Transaction exports

---

## Missing Features (6 gaps to reach Flutterwave parity)

### 1. Payment Links / Hosted Checkout Page
Flutterwave's most popular merchant feature -- a no-code way to accept payments via a shareable URL.

**What's needed:**
- `gateway_payment_links` table (amount, currency, title, description, redirect_url, expiry, status, custom_fields)
- `gateway-create-payment-link` edge function (generates a unique short URL)
- `gateway-get-payment-link` edge function
- `gateway-list-payment-links` edge function
- A hosted checkout page route (`/pay/:link_id`) that renders a branded payment form and calls `gateway-create-charge` on submission

### 2. Subscriptions / Recurring Payments (Payment Plans)
Flutterwave supports payment plans that auto-charge customers on a schedule.

**What's needed:**
- `gateway_payment_plans` table (name, amount, currency, interval: daily/weekly/monthly/yearly, duration, merchant_id)
- `gateway_subscriptions` table (plan_id, customer_email, status, next_charge_at, charges_made)
- `gateway-create-payment-plan` edge function
- `gateway-create-subscription` edge function
- `gateway-cancel-subscription` edge function
- `gateway-subscription-charge-cron` edge function (scheduled job to auto-charge active subscriptions)

### 3. Split Payments / Subaccounts
Marketplace feature where a charge is automatically split between the merchant and sub-merchants.

**What's needed:**
- `gateway_subaccounts` table (merchant_id, subaccount_name, settlement_bank, account_number, split_type: percentage/flat, split_value)
- `gateway-create-subaccount` edge function
- `gateway-list-subaccounts` edge function
- Update `gateway-create-charge` to accept an optional `subaccounts` array and record split details
- `gateway_charge_splits` table to track per-charge split allocations

### 4. Customer Tokenization (for Gateway Charges)
Flutterwave lets merchants save customer payment details for one-click repeat payments. KOB has `saved_cards` for end-users but not a gateway-level customer token system for merchants.

**What's needed:**
- `gateway_customers` table (merchant_id, email, phone, name, metadata)
- `gateway_customer_tokens` table (customer_id, provider, token_ref, channel, last4, expiry, is_active)
- `gateway-create-customer` edge function
- `gateway-charge-token` edge function (charge a saved token without re-entering details)
- Update `gateway-create-charge` to optionally return a reusable token when `save_token: true` is passed

### 5. Transaction Timeline / Events Log (per charge)
Flutterwave exposes a detailed event timeline for each transaction (created, processing, OTP sent, successful, webhook delivered). KOB tracks status changes but doesn't expose a per-transaction event timeline.

**What's needed:**
- `gateway_charge_events` table (charge_id, event_type, timestamp, details)
- Insert events at each lifecycle stage in `gateway-create-charge`, `gateway-verify-charge`, webhook handlers
- `gateway-get-charge-events` edge function (returns timeline for a specific charge)

### 6. Multi-Currency / FX Rate Quotes
Flutterwave provides real-time exchange rates and lets merchants accept payments in one currency and settle in another.

**What's needed:**
- `gateway-get-exchange-rate` edge function (wraps Flutterwave's `/rates` endpoint for XAF/USD/EUR/GBP pairs)
- Add optional `settlement_currency` field to `gateway_charges` so merchants can charge in USD but settle in XAF
- Record the applied exchange rate and converted amounts on the charge record

---

## Technical Implementation Details

### Database Changes (single migration)
- Create 7 new tables: `gateway_payment_links`, `gateway_payment_plans`, `gateway_subscriptions`, `gateway_subaccounts`, `gateway_charge_splits`, `gateway_customers`, `gateway_customer_tokens`, `gateway_charge_events`
- Add `payment_link_id` column to `gateway_charges`
- Add `subscription_id` column to `gateway_charges`
- Add `settlement_currency`, `exchange_rate`, `settled_amount` columns to `gateway_charges`
- RLS policies for all new tables (merchant ownership via user_id)

### New Edge Functions (12 total)
1. `gateway-create-payment-link`
2. `gateway-get-payment-link`
3. `gateway-list-payment-links`
4. `gateway-create-payment-plan`
5. `gateway-create-subscription`
6. `gateway-cancel-subscription`
7. `gateway-subscription-charge-cron`
8. `gateway-create-subaccount`
9. `gateway-list-subaccounts`
10. `gateway-create-customer`
11. `gateway-charge-token`
12. `gateway-get-charge-events`

### Modified Edge Functions (2)
- `gateway-create-charge` -- add support for payment_link_id, subaccounts split, save_token, settlement_currency
- `gateway-get-exchange-rate` (can reuse existing `exchange-rate-get` or extend it)

### New Cron Job (1)
- `gateway-subscription-charge-cron` -- runs hourly, finds subscriptions where `next_charge_at <= now()`, creates charges, updates next_charge_at

### New Frontend Route (1)
- `/pay/:link_id` -- hosted checkout page for payment links

---

## Priority Order
1. **Payment Links** -- highest merchant demand, fastest to ship
2. **Customer Tokenization** -- enables repeat payments
3. **Subscriptions** -- depends on tokenization
4. **Split Payments** -- marketplace feature
5. **Charge Events Timeline** -- developer experience improvement
6. **Multi-Currency FX** -- advanced feature

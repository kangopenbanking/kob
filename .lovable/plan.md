# KOB Payment Gateway -- Remaining Gaps vs Flutterwave (Round 3)

The previous two rounds closed 15 major gaps. This audit compares against Flutterwave's **complete** product surface and identifies **7 remaining feature areas** that would bring KOB to full parity.

---

## Current Coverage Summary

KOB now covers: Charges (6 channels), Payouts (single + batch), Refunds, Disputes, Settlements, Payment Links (CRUD + hosted checkout), Subscriptions (plans + recurring cron), Split Payments (subaccounts + splits), Customer Tokenization, Charge Events, Exchange Rates, Webhooks (inbound + outbound), Beneficiaries, Transaction Export, Risk Limits, and Merchant Onboarding.

---

## Gap 1: Preauthorization (Auth + Capture)

Flutterwave supports **preauthorized charges** -- hold funds on a card without immediately capturing. KOB has no auth/capture flow.

**What's needed:**

- Add `capture_mode` field to `gateway_charges` (`auto` or `manual`)
- `gateway-preauth-charge` edge function -- creates a Stripe PaymentIntent with `capture_method: manual` or Flutterwave preauth
- `gateway-capture-charge` edge function -- captures a previously authorized charge (full or partial)
- `gateway-void-charge` edge function -- releases an authorized hold without capturing

**Database change:** Add `capture_mode` and `captured_amount` columns to `gateway_charges`

---

## Gap 2: Virtual Account Numbers (Pay-with-Transfer)

Flutterwave provides **dedicated virtual account numbers** for merchants so customers can pay via bank transfer to a unique account. KOB has no virtual account endpoint under the gateway namespace.

**What's needed:**

- `gateway_virtual_accounts` table (merchant_id, account_number, bank_name, provider_ref, status, currency, expiry)
- `gateway-create-virtual-account` edge function -- provisions a virtual account via Flutterwave's `/v3/virtual-account-numbers` API
- `gateway-list-virtual-accounts` edge function
- `gateway-get-virtual-account` edge function
- Webhook handler update to process `virtualaccount.credit` events and auto-create charges

---

## Gap 3: Bill Payments / Airtime / Data Bundles (DO NOT IMPLEMENT GAP 3)

Flutterwave offers a **Bills Payment** API for airtime top-ups, data bundles, cable TV, electricity, and other utility payments. KOB has no bill payment capability.

**What's needed:**

- `gateway_bill_payments` table (merchant_id, bill_type, biller_code, customer_ref, amount, status, provider_ref)
- `gateway-create-bill-payment` edge function -- routes through Flutterwave's `/v3/bills` API
- `gateway-list-bill-categories` edge function -- fetches available billers
- `gateway-get-bill-payment` edge function -- retrieves bill payment status
- Developer documentation page

---

## Gap 4: OTP Validation for Pending Charges

Flutterwave charges (especially mobile money) often require an OTP step. KOB currently has no mechanism to submit an OTP to complete a pending charge.

**What's needed:**

- `gateway-validate-charge` edge function -- accepts `charge_id` + `otp` and submits to Flutterwave's `/v3/validate-charge` endpoint
- Update hosted checkout page (`PaymentCheckout.tsx`) to show an OTP input form when the charge status is `processing` and `redirect_url` is absent

---

## Gap 5: BVN / Account Verification under Gateway Namespace

Flutterwave provides BVN (Bank Verification Number) resolution and account number verification. KOB has `flutterwave-verify-bank` but it is not exposed under the gateway namespace.

**What's needed:**

- `gateway-verify-bank-account` edge function -- wraps existing `flutterwave-verify-bank` logic under the `/v1/gateway/` namespace
- `gateway-resolve-bvn` edge function -- resolves BVN via Flutterwave's `/v3/kyc/bvns/{bvn}` endpoint
- Register both in OpenAPI spec

---

## Gap 6: Transaction Fee Passthrough Configuration

Flutterwave allows merchants to configure whether the **customer or merchant bears the transaction fee** (pass-through fees). KOB always deducts fees from the merchant's net.

**What's needed:**

- Add `fee_bearer` column to `gateway_merchants` (`merchant` or `customer`, default `merchant`)
- Accept optional `fee_bearer` override in `gateway-create-charge`
- When `fee_bearer = customer`, add fee to the displayed amount on hosted checkout
- Update fee display in `PaymentCheckout.tsx`

---

## Gap 7: Merchant Balance & Wallet

Flutterwave provides a **balances** endpoint so merchants can check their available, pending, and ledger balances across currencies. KOB has no wallet/balance abstraction for merchants.

**What's needed:**

- `gateway_merchant_wallets` table (merchant_id, currency, available_balance, pending_balance, ledger_balance)
- `gateway-get-merchant-balance` edge function
- Auto-update balances on charge completion (increment pending), settlement (move pending to available), payout (decrement available)
- Dashboard widget on the FI portal showing balances

---

## Priority Order

1. **OTP Validation (Gap 4)** -- critical for mobile money charge completion
2. **Preauthorization (Gap 1)** -- essential for card-based marketplaces and hotels
3. **Fee Passthrough (Gap 6)** -- quick merchant configuration win
4. **Virtual Accounts (Gap 2)** -- alternative payment collection method
5. **Merchant Balances (Gap 7)** -- operational visibility
6. **Bank/BVN Verification (Gap 5)** -- KYC completeness
7. **Bill Payments (Gap 3)** -- value-added service (DO NOT IMPLEMENT  THIS FEATURE)

---

## Technical Summary


| Category                    | Count |
| --------------------------- | ----- |
| New edge functions          | 12    |
| Modified edge functions     | 2     |
| New database tables         | 3     |
| Modified database tables    | 2     |
| New/modified frontend files | 3     |
| OpenAPI/Postman updates     | 2     |


### New Edge Functions (12)

1. `gateway-preauth-charge`
2. `gateway-capture-charge`
3. `gateway-void-charge`
4. `gateway-create-virtual-account`
5. `gateway-list-virtual-accounts`
6. `gateway-get-virtual-account`
7. `gateway-create-bill-payment`
8. `gateway-list-bill-categories`
9. `gateway-get-bill-payment`
10. `gateway-validate-charge`
11. `gateway-verify-bank-account`
12. `gateway-resolve-bvn`

### New Edge Function (Wallet)

13. `gateway-get-merchant-balance`

### Modified Edge Functions (2)

- `gateway-create-charge` -- accept `fee_bearer` and `capture_mode`
- `gateway-webhook-flutterwave` -- handle `virtualaccount.credit` events

### New Database Tables (3)

- `gateway_virtual_accounts`
- `gateway_bill_payments`
- `gateway_merchant_wallets`

### Modified Database Tables (2)

- `gateway_charges` -- add `capture_mode`, `captured_amount` columns
- `gateway_merchants` -- add `fee_bearer` column

### Frontend Changes

- Update `PaymentCheckout.tsx` -- OTP input step, fee display for customer-borne fees
- New developer guide: `GatewayBillPaymentsGuide.tsx`
- OpenAPI + Postman collection updates


# Plan: Merchant Subscription Creation + Escrow Implementation Guide

## Part 1: Add "Create Subscription" to `/merchant/subscriptions`

### Current State
- `MerchantSubscriptions.tsx` is a **read-only list** — it displays subscriptions from `gateway_subscriptions` table with search, filters, pagination, export, and a detail sheet.
- There is NO "Create Subscription" button or form.
- The backend `gateway-create-subscription` edge function already exists and accepts: `merchant_id`, `plan_id`, `customer_email`, `customer_phone`, `customer_name`, `metadata`. It validates merchant ownership, fetches the plan, calculates next charge date, inserts the subscription, fires a webhook event, and logs an audit entry.
- `MerchantPlans.tsx` already has full CRUD for `gateway_payment_plans` and shows subscriber counts.
- The `gateway-cancel-subscription` edge function also exists for cancellation.

### Changes

**File: `src/pages/merchant/MerchantSubscriptions.tsx`**

Add a "New Subscription" button in the header and a Dialog form with:
- **Plan selector**: Dropdown populated from `gateway_payment_plans` for the merchant (active plans only)
- **Customer email** (required), **Customer name**, **Customer phone** (formatted for Cameroon +237)
- **Metadata** (optional JSON field)

On submit, call `supabase.functions.invoke('gateway-create-subscription', { body: { merchant_id, plan_id, customer_email, customer_phone, customer_name, metadata } })`.

On success, show the new subscription details and refresh the list.

Also add a **Cancel Subscription** button in the detail sheet (for active subscriptions), calling `gateway-cancel-subscription` with `{ subscription_id, reason }`.

The detail sheet currently shows raw `plan_id` — enhance it to show the plan name by joining data.

### Data flow
```text
[Create Dialog] → gateway-create-subscription edge function
  → validates merchant ownership
  → fetches plan from gateway_payment_plans
  → inserts gateway_subscriptions row
  → fires webhook event (gateway_webhook_events)
  → audit log
  → returns subscription object
  → UI refreshes list
```

---

## Part 2: Escrow Feature — Implementation Guide & Suggestions

### What Already Exists

The escrow infrastructure is **fully built** in the backend:

| Capability | Edge Function | DB Tables |
|---|---|---|
| Create escrow sub-wallet | `gateway-escrow-wallets` (POST /) | `escrow_wallets` |
| Fund escrow (from parent wallet) | POST `/{id}/fund` | `escrow_transactions`, `account_balances`, `safeguarding_ledger` |
| Release to recipient | POST `/{id}/release` (admin only) | Same |
| Refund to funder | POST `/{id}/refund` (admin only) | Same |
| Freeze/unfreeze | POST `/{id}/freeze` (admin only) | Same |
| Transaction history | GET `/{id}/transactions` | `escrow_transactions` |
| List escrows | GET `/` | `escrow_wallets` |

Developer documentation exists at `/developer/gateway/escrow` (`EscrowGuide.tsx`).

### How Users Can Implement Escrow

Escrow is designed for **marketplace and multi-party transactions**. Integration paths:

1. **Via API (Developers/TPPs)**: Call `gateway-escrow-wallets` endpoints directly using API keys. The full lifecycle: create → fund → release/refund is documented in the developer portal.

2. **Via Merchant Dashboard (suggestion)**: Currently there is NO merchant-facing escrow UI. Adding an "Escrow" page under the merchant portal would let merchants:
   - View their escrow wallets and balances
   - Create new escrow holds for specific transactions
   - See transaction history per escrow
   - Request release/refund (routed to admin approval)

3. **Via Admin Dashboard**: Admins already have the authority to release, refund, and freeze escrows via the API. An admin escrow management page would provide oversight.

### Suggested Use Cases for Cameroon Market
- **E-commerce marketplace**: Buyer funds escrow → seller ships → admin/platform releases on delivery confirmation
- **Freelance/service payments**: Client funds escrow → freelancer delivers → funds released
- **Real estate deposits**: Tenant deposits held in escrow until lease signed
- **Group purchases (Njangi-adjacent)**: Pool funds in escrow until purchase threshold met

### Recommended Next Steps for Escrow UI

Add a merchant escrow dashboard page at `/merchant/escrow` with:
- List of escrow wallets (from `gateway-escrow-wallets` GET)
- Create new escrow form (merchant_id, parent_wallet_id, escrow_label, currency)
- Fund escrow action (amount, reference)
- View transaction history per escrow
- Request release/refund (creates a request that admins approve)

This would require:
- 1 new page component: `MerchantEscrow.tsx`
- Route addition in `App.tsx`
- Navigation link in the merchant sidebar
- No new edge functions needed — all backend APIs exist

---

## Implementation Summary

| Task | Scope | Files |
|---|---|---|
| Add Create Subscription dialog | `MerchantSubscriptions.tsx` | 1 file edit |
| Add Cancel Subscription in detail sheet | `MerchantSubscriptions.tsx` | Same file |
| Fetch plans for dropdown | Direct query to `gateway_payment_plans` | Same file |
| Enhance detail sheet with plan name | Join query | Same file |

The escrow UI is a separate feature that can be built as a follow-up.


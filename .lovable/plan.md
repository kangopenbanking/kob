# Merchant Dashboard Portal

## Problem

Currently, merchants exist only as data rows managed by FI Portal admins and the Admin panel. A merchant who registers, completes KYB, and gets verified has **no self-service portal** to manage their own business -- they'd have to contact the institution for everything. This is a critical gap compared to platforms like Flutterwave, Paystack, or Stripe, where the merchant dashboard is the primary interface.

## Solution

Create a dedicated **Merchant Portal** at `/merchant` with its own layout, sidebar navigation, and role-based access. This gives merchants a self-service dashboard to monitor transactions, manage API keys, configure webhooks, view settlements, and more.

## Architecture

### 1. New App Role: `merchant`

- Add `merchant` to the `app_role` enum in the database
- When a merchant is created via the gateway API, automatically assign the `merchant` role to the user
- Update `RoleGuard` to recognize the `merchant` role

### 2. Merchant Layout (`src/components/merchant/MerchantLayout.tsx`)

- Sidebar-based layout following the same pattern as `InstitutionLayout` and `DeveloperLayout`
- Branded header with merchant business name
- Navigation sections for all merchant functions

### 3. Merchant Navigation Config (`src/components/merchant/merchant-navigation-config.ts`)

Sidebar sections:

- **Overview**: Dashboard, Analytics
- **Payments**: Transactions, Payment Links, Subscriptions, Customers
- **Money Out**: Payouts, Settlements, Refunds
- **Configuration**: API Keys, Webhooks, Settlement Accounts, Subaccounts
- **Compliance**: KYB Status, Disputes
- **Settings**: Business Profile, Team

### 4. Merchant Pages (under `src/pages/merchant/`)


| Page                | File                             | Description                                                                               |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| Dashboard           | `MerchantDashboard.tsx`          | Revenue summary, transaction volume chart, recent transactions, KYB/account status banner |
| Transactions        | `MerchantTransactions.tsx`       | Filterable list of all charges with status, amount, channel, date; CSV export             |
| Payment Links       | `MerchantPaymentLinks.tsx`       | Create/manage payment links with amount, description, expiry                              |
| Customers           | `MerchantCustomers.tsx`          | View tokenized customers and their payment history                                        |
| Subscriptions       | `MerchantSubscriptions.tsx`      | Manage subscription plans and active subscribers                                          |
| Payouts             | `MerchantPayouts.tsx`            | View payout history and request manual payouts                                            |
| Settlements         | `MerchantSettlements.tsx`        | Settlement batches with breakdown per period                                              |
| Refunds             | `MerchantRefunds.tsx`            | Issue and track refunds                                                                   |
| API Keys            | `MerchantApiKeys.tsx`            | Generate, rotate, and revoke sandbox/production keys                                      |
| Webhooks            | `MerchantWebhooks.tsx`           | Configure webhook URL, view delivery logs, retry failed deliveries                        |
| Settlement Accounts | `MerchantSettlementAccounts.tsx` | Add/manage bank accounts and mobile money for payouts                                     |
| Subaccounts         | `MerchantSubaccounts.tsx`        | Create split-payment subaccounts                                                          |
| KYB Status          | `MerchantKYB.tsx`                | View KYB submission status, upload additional documents                                   |
| Disputes            | `MerchantDisputes.tsx`           | Respond to chargebacks and disputes                                                       |
| Business Profile    | `MerchantProfile.tsx`            | Edit business name, email, phone, logo                                                    |
| Analytics           | `MerchantAnalytics.tsx`          | Revenue trends, payment method breakdown, success rates                                   |


### 5. Routing Updates (`App.tsx`)

```text
/merchant                    -> MerchantLayout (wrapper)
  /merchant                  -> MerchantDashboard
  /merchant/transactions     -> MerchantTransactions
  /merchant/payment-links    -> MerchantPaymentLinks
  /merchant/customers        -> MerchantCustomers
  /merchant/subscriptions    -> MerchantSubscriptions
  /merchant/payouts          -> MerchantPayouts
  /merchant/settlements      -> MerchantSettlements
  /merchant/refunds          -> MerchantRefunds
  /merchant/api-keys         -> MerchantApiKeys
  /merchant/webhooks         -> MerchantWebhooks
  /merchant/settlement-accounts -> MerchantSettlementAccounts
  /merchant/subaccounts      -> MerchantSubaccounts
  /merchant/kyb              -> MerchantKYB
  /merchant/disputes         -> MerchantDisputes
  /merchant/profile          -> MerchantProfile
  /merchant/analytics        -> MerchantAnalytics
```

All routes wrapped with `ProtectedRoute` and `RoleGuard allowedRoles={['merchant']}`.

### 6. Dashboard Router Update

Update the dashboard routing logic so users with the `merchant` role are automatically redirected to `/merchant` after login.

### 7. Database Migration

- `ALTER TYPE app_role ADD VALUE 'merchant';`
- Trigger or edge function update: when a row is inserted into `gateway_merchants`, automatically insert into `user_roles` with `role = 'merchant'`

## Technical Details

### Data Access

All merchant pages query existing `gateway_*` tables filtered by the merchant's `user_id` via RLS. No new tables are needed -- the data layer is already complete.

### Existing Tables Used

- `gateway_merchants` -- profile, limits, KYB status
- `gateway_charges` -- transactions
- `gateway_payouts` -- outbound transfers
- `gateway_settlements` -- settlement batches
- `gateway_refunds` -- refund records
- `gateway_disputes` -- chargebacks
- `gateway_payment_links` -- payment links
- `gateway_subscriptions` / `gateway_subscription_plans` -- recurring billing
- `gateway_merchant_api_keys` -- API credentials
- `gateway_merchant_webhooks` -- webhook config and logs
- `gateway_merchant_settlement_accounts` -- payout destinations
- `gateway_subaccounts` -- split payments
- `gateway_customers` -- tokenized customers

### Files to Create (19 files)

1. `src/components/merchant/MerchantLayout.tsx`
2. `src/components/merchant/merchant-navigation-config.ts`
3. `src/pages/merchant/MerchantDashboard.tsx`
4. `src/pages/merchant/MerchantTransactions.tsx`
5. `src/pages/merchant/MerchantPaymentLinks.tsx`
6. `src/pages/merchant/MerchantCustomers.tsx`
7. `src/pages/merchant/MerchantSubscriptions.tsx`
8. `src/pages/merchant/MerchantPayouts.tsx`
9. `src/pages/merchant/MerchantSettlements.tsx`
10. `src/pages/merchant/MerchantRefunds.tsx`
11. `src/pages/merchant/MerchantApiKeys.tsx`
12. `src/pages/merchant/MerchantWebhooks.tsx`
13. `src/pages/merchant/MerchantSettlementAccounts.tsx`
14. `src/pages/merchant/MerchantSubaccounts.tsx`
15. `src/pages/merchant/MerchantKYB.tsx`
16. `src/pages/merchant/MerchantDisputes.tsx`
17. `src/pages/merchant/MerchantProfile.tsx`
18. `src/pages/merchant/MerchantAnalytics.tsx`
19. DB migration for `merchant` role enum value + auto-assign trigger

### Files to Modify (2 files)

1. `src/App.tsx` -- Add `/merchant/*` routes
2. `src/components/RoleGuard.tsx` -- Add `'merchant'` to the `allowedRoles` type

Update all the API Documents in detail and create all recommended frontend pages for merchant information and a dedicated section on the frontend with professional information for merchants.  All recommended email templates should also be created on the admin that would be used to manage the accounts 


# Customer App (/app) End-to-End Audit Plan

## Scope

47 routes across 8 functional domains within the Customer PWA. The audit covers broken forms/CTAs, API connection gaps, auth/security gaps, and data flow bugs.

## Audit Methodology

Execute in 8 batches. Each batch: read all component code, trace every form/CTA to its edge function or DB call, flag gaps, fix, verify.

---

## Batch 1 — Auth and Session (Critical Path)

**Files:** `CustomerAuth.tsx` (795 lines), `CustomerRegister.tsx`, `CustomerOnboarding.tsx`, `CustomerSplash.tsx`, `CustomerAppAuthGuard.tsx`, `SessionGuard.tsx`, `useCustomerAuth.ts`, `useFirebasePhoneAuth.ts`, `MandatoryPinSetupStep.tsx`

**Audit targets:**
- Phone OTP flow: send OTP -> verify OTP -> PIN setup -> dashboard redirect
- Email sign-up/sign-in: validation, error handling, email verification
- PIN login: brute-force lockout (3 attempts/30m), error messages
- Forgot password and PIN reset flows
- Session guard: 5-min inactivity timeout, single-session enforcement
- Auth state race condition: verify 3-attempt retry loop for getUser/getSession
- Guard bypass: confirm unauthenticated users cannot reach /app/home directly

**Known risk:** `useCustomerAuth` uses `getSession()` instead of `getUser()` for initial load — potential stale session issue.

---

## Batch 2 — Wallet and Money Movement (Financial Core)

**Files:** `CustomerHome.tsx` (638 lines), `CustomerFundWallet.tsx` (514 lines), `CustomerTransfer.tsx` (605 lines), `CustomerCashOut.tsx` (588 lines)

**Audit targets:**
- Home: balance display, animated counter, account data hooks
- Fund Wallet: provider selection -> amount -> PIN confirm -> edge function call (`gateway-create-funding-intent` or `gateway-confirm-funding`), fee estimate integration, success/error handling
- Transfer: 5 recipient types (phone/account/name/RIB/IBAN), name search via `search_profiles_by_name` RPC, `api-transfers` edge function call, idempotency key format, PIN confirmation, insufficient funds handling
- Cash Out: destination selection -> amount -> PIN -> `gateway-process-withdrawal` or equivalent, balance validation, admin config loading from `institutions.app_config`

**Critical checks:** Every financial mutation must go through an edge function (not direct DB write). Verify idempotency keys, PIN verification, and atomic balance updates.

---

## Batch 3 — Payments and Bills

**Files:** `CustomerBillsV2.tsx` (572 lines), `CustomerInvoices.tsx`, `CustomerPayLinks.tsx`, `CustomerRecurring.tsx`, `CustomerSplitBills.tsx`

**Audit targets:**
- Bills: category -> provider -> product -> form -> PIN confirm -> `api-bills-v2` edge function. Verify hooks: `useBillCategories`, `useBillProviders`, `useBillProducts`, `useCreateBillIntent`, `usePayBillIntent`
- Invoices: create via `customer-invoice-create`, list/display, email dispatch
- Pay Links: `customer-paylinks-ops` with create/deactivate/toggle actions
- Recurring Payments: `recurring-payment-create` with toggle action
- Split Bills: `split-bills-ops` for creation, settlement, reminders

**Critical checks:** All 5 modules must route through their respective edge functions. No direct supabase inserts for financial records.

---

## Batch 4 — Remittances (Send Money)

**Files:** `CustomerSendMoney.tsx` (1485 lines — largest component), `CustomerRemittances.tsx`

**Audit targets:**
- 6-step wizard: amount -> recipient -> review -> sending -> success
- Corridor loading from `remittance_corridors` with partner join
- Exchange rate fetching via `exchange-rate-get` edge function
- Fee calculation from corridor `fees_model`
- Delivery methods: mobile_money, bank_transfer (Flutterwave), local_bank_transfer (KOB v1 Credit Unions)
- Credit Union display: only show institutions with `institution_type = 'credit_union'` or using KOB v1 API
- 23-digit RIB format validation for local bank transfers
- `remittance-engine` edge function call with proper payload
- History tab: fetch from `remittance_transfers` table
- Real-time status polling (Processing -> In Transit -> Delivered)

**Known issue from recent work:** Exchange rate edge function was returning errors for some currency pairs (e.g., TND to XAF). Verify the fallback chain works.

---

## Batch 5 — Savings and Consumer Tools

**Files:** `CustomerPiggyBank.tsx`, `CustomerNjangi.tsx`, `CustomerCreditScore.tsx`, `CustomerRentReporting.tsx`, `CustomerRewards.tsx`, `CustomerLoyalty.tsx`

**Audit targets:**
- PiggyBank: `piggybank` edge function for goals CRUD
- Njangi: `njangi-ops` edge function, group membership via `is_njangi_group_member` RPC
- Credit Score: `credit-score-fetch` or `credit-score-calculate`, display formatting
- Rent Reporting: form submission, data persistence
- Rewards/Loyalty: point accrual, redemption flows

---

## Batch 6 — Marketplace and Commerce

**Files:** `CustomerStores.tsx`, `CustomerStoreDetail.tsx`, `CustomerCart.tsx`, `CustomerOrderTracking.tsx`, `CustomerMarketplace.tsx`, `CustomerWishlist.tsx`, `CustomerReviews.tsx`, `CustomerScan.tsx`

**Audit targets:**
- Store browsing: fetch from `pos_store_profiles` where `is_published = true`
- Cart: `pos-consumer-cart` edge function, idempotency key format `checkout_${cart.id}`
- QR scanning: `kob_pos_pay` and `kob_store` QR type detection
- Order tracking: consumer_user_id metadata matching
- Wishlist/Reviews: CRUD operations, RLS policy verification

---

## Batch 7 — Travel and Support

**Files:** `CustomerTravelCategories.tsx`, `CustomerTravelAgencies.tsx`, `CustomerTravelTrips.tsx`, `CustomerTravelBooking.tsx`, `CustomerTravelTicket.tsx`, `CustomerTravelHistory.tsx`, `CustomerSupport.tsx`, `CustomerDisputes.tsx`, `CustomerHelp.tsx`

**Audit targets:**
- Travel flow: category -> agencies -> trips -> booking -> ticket
- `travel-book-and-pay` edge function integration
- Support chat: real-time messaging, department routing
- Disputes: lifecycle management, Kanban board status transitions

---

## Batch 8 — Settings, Alerts, and Edge Cases

**Files:** `CustomerSettings.tsx`, `CustomerAlerts.tsx`, `CustomerLinkedAccounts.tsx`, `CustomerBank.tsx`, `CustomerCards.tsx`

**Audit targets:**
- Settings: profile update, PIN change, notification preferences
- Alerts: `app_notifications` fetch, mark-as-read
- Linked Accounts: account linking flow, `customer_linked_accounts` table
- Bank connections: `bank_connections` table, sync status
- Virtual Cards: `virtual-cards` edge function

---

## Cross-Cutting Checks (Applied to Every Batch)

| Check | Method |
|-------|--------|
| Forms submit to edge functions, not direct DB | Trace every `supabase.functions.invoke` and `supabase.from().insert/update` |
| Error handling exists on every API call | Verify `.catch` or error toast for every mutation |
| PIN verification before financial ops | Confirm `PinConfirmDialog` gates transfers, payments, cashout |
| Loading states on all async operations | Verify `Loader2` or equivalent during API calls |
| Empty states for lists with no data | Verify fallback UI when arrays are empty |
| RLS policies match query patterns | Cross-reference `.from()` calls with table RLS |
| Navigation after success | Verify redirect or success screen after each flow completes |

---

## Deliverables Per Batch

1. List of issues found (categorized: form/API/auth/data)
2. Code fixes applied
3. Verification that fix resolves the issue

## Estimated Scope

- ~6,500 lines of customer page code
- ~15 edge functions directly invoked
- ~20 database tables queried
- ~12 multi-step forms


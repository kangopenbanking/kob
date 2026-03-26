

# Consumer PWA App — Full E2E Production Audit

## Summary of Findings

After auditing all 48 consumer app pages, their routes, data fetching, edge functions, forms, and direct DB operations, here are the gaps organized by severity.

---

## CRITICAL GAPS

### GAP 1: CustomerBills.tsx is Dead Code — But Still Exists
**Issue:** `App.tsx` line 459 imports `CustomerBillsV2` as `CustomerBills`. The original `CustomerBills.tsx` (which received the edge-function fix) is never loaded. `CustomerBillsV2.tsx` correctly uses the `api-bills-v2` edge function via `useBillsV2` hooks.
**Risk:** Confusion, bundle bloat, dead code.
**Fix:** Delete `CustomerBills.tsx` (the original file). No functional impact.

### GAP 2: Invoices — Direct Client-Side DB Insert (Financial Write)
**File:** `CustomerInvoices.tsx` lines 106-121
**Issue:** Invoice creation inserts directly into `customer_invoices` table from the client via `supabase.from('customer_invoices').insert(...)`. The edge function `send-customer-invoice` is called after but only for email delivery — the insert itself is unmediated.
**Risk:** Moderate. Invoices are not fund transfers, but a malicious client could forge invoice records.
**Fix:** Create a `customer-invoice-create` edge function that validates and creates the invoice server-side, then triggers the email send.

### GAP 3: Pay Links — Direct Client-Side DB Insert
**File:** `CustomerPayLinks.tsx` line 49
**Issue:** Pay link creation inserts directly into `customer_pay_links` from client. No server-side validation of slug uniqueness, amount bounds, or expiry sanity.
**Fix:** Create a `customer-paylinks-ops` edge function with `create` and `deactivate` actions.

### GAP 4: Recurring Payments — Toggle Uses Direct DB Update
**File:** `CustomerRecurring.tsx` lines 62-71
**Issue:** Pause/resume of recurring payments calls `supabase.from('recurring_payments').update({ is_active })` directly. While creation was fixed to use edge function, the toggle still bypasses server mediation.
**Fix:** Add a `toggle` action to `recurring-payment-create` edge function (or rename it to `recurring-payment-ops`).

---

## MODERATE GAPS

### GAP 5: 5 Unrouted Dead Pages
**Files:** `CustomerLoyalty.tsx`, `CustomerMarketplace.tsx`, `CustomerReviews.tsx`, `CustomerWishlist.tsx`, `CustomerBillsV2.tsx` (routed but original `CustomerBills.tsx` is dead)
**Issue:** These pages exist in `/src/pages/customer-app/` but have no route in `App.tsx`. They reference real DB tables but are completely inaccessible.
**Fix:** Either add routes or delete the files to reduce bundle size and confusion.

### GAP 6: Settings — Direct DB Writes for Preferences
**File:** `CustomerSettings.tsx` lines 107, 148, 164
**Issue:** Profile updates (`profiles.update`), notification preferences (`user_preferences.upsert`), and language settings are written directly from the client. These are non-financial user data, so the risk is low, but profile manipulation could be used for social engineering.
**Fix:** Low priority — acceptable for user's own profile data behind RLS. No action needed unless stricter controls are required.

### GAP 7: Linked Accounts — Direct DB Writes
**File:** `CustomerLinkedAccounts.tsx` line 664, `CustomerOnboarding.tsx` line 219
**Issue:** Linking accounts (MoMo, bank, PayPal) inserts directly into `customer_linked_accounts` and updates `profiles`. These are user-owned records behind RLS.
**Fix:** Low priority. The onboarding flow is acceptable as direct writes for user-owned data.

### GAP 8: Help — Contact Form Inserts into app_notifications
**File:** `CustomerHelp.tsx` line 114
**Issue:** The contact form inserts directly into `app_notifications`. This is a support ticket mechanism, not a financial operation.
**Fix:** Low priority. Acceptable pattern for self-owned notification records.

---

## VERIFIED WORKING (No Gaps)

| Feature | Mediation | Status |
|---|---|---|
| Transfer (P2P) | `api-transfers` edge function | OK |
| Fund Wallet | `gateway-create-funding-intent` | OK |
| Cash Out | `gateway-process-withdrawal` | OK |
| Bills V2 (Active) | `api-bills-v2` via hooks | OK |
| Split Bills | `split-bills-ops` edge function | OK |
| Recurring (Create) | `recurring-payment-create` | OK |
| Piggy Bank | `piggybank` edge function | OK |
| Njangi | `njangi-ops` edge function | OK |
| Credit Score | `credit-score-fetch` | OK |
| Rent Reporting | `piggybank` (pay action) | OK |
| Remittance Send | `remittance-outbound` | OK |
| Remittance Receive | Read-only DB query | OK |
| Disputes | `gateway-file-dispute` + fixed filter | OK |
| QR Scan Pay | `pos-qr-payment` | OK |
| Cart Add | `pos-consumer-cart` (add) | OK |
| Cart Update/Remove | `pos-consumer-cart` (update_quantity/remove) | OK |
| Checkout | `pos-consumer-checkout` + fixed idempotency | OK |
| Invoice Send | `send-customer-invoice` | OK (but insert is GAP 2) |
| Travel Booking | `travel-book-and-pay` | OK |
| Pay By Bank | `pay-by-bank` | OK |
| Support Chat | hooks → `support_conversations` | OK |
| Notifications/Alerts | `useNotifications` read-only | OK |
| Cards | Read-only | OK |
| Bank Accounts | Read-only | OK |
| Order Tracking | Read-only | OK |
| Stores/Store Detail | Read-only | OK |

---

## IMPLEMENTATION PLAN

### Step 1: Delete Dead Code (P2)
- Delete `src/pages/customer-app/CustomerBills.tsx` (dead — V2 is active)
- Optionally delete `CustomerLoyalty.tsx`, `CustomerMarketplace.tsx`, `CustomerReviews.tsx`, `CustomerWishlist.tsx` or wire them into routes

### Step 2: Invoice Creation — Edge Function Mediation (P1)
- Create `customer-invoice-create` edge function
- Validates fields, generates invoice number server-side, inserts, then triggers `send-customer-invoice`
- Update `CustomerInvoices.tsx` to call `supabase.functions.invoke('customer-invoice-create', ...)`

### Step 3: Pay Links — Edge Function Mediation (P1)
- Create `customer-paylinks-ops` edge function with `create` action
- Validates slug uniqueness, amount bounds, expiry
- Update `CustomerPayLinks.tsx` to use it

### Step 4: Recurring Toggle — Route Through Edge Function (P1)
- Add `toggle` action to `recurring-payment-create` (rename to `recurring-payment-ops`)
- Update `CustomerRecurring.tsx` handleToggle to call edge function

### Step 5: Clean Up Unrouted Pages (P2)
- Either add routes for Loyalty, Marketplace, Reviews, Wishlist under `/app/`
- Or delete them entirely

---

## Technical Details

### Files to Modify
1. `src/pages/customer-app/CustomerInvoices.tsx` — Replace direct insert with edge function
2. `src/pages/customer-app/CustomerPayLinks.tsx` — Replace direct insert with edge function
3. `src/pages/customer-app/CustomerRecurring.tsx` — Replace direct update with edge function
4. `supabase/functions/recurring-payment-create/index.ts` — Add `toggle` action
5. New: `supabase/functions/customer-invoice-create/index.ts`
6. New: `supabase/functions/customer-paylinks-ops/index.ts`

### Files to Delete
1. `src/pages/customer-app/CustomerBills.tsx` — Dead code (V2 is active)

### Database Changes
- None required

### Priority Order
1. **P1:** GAP 2 (Invoice direct insert) — data integrity
2. **P1:** GAP 3 (Pay links direct insert) — validation bypass
3. **P1:** GAP 4 (Recurring toggle direct update) — consistency
4. **P2:** GAP 1 (Dead code cleanup)
5. **P2:** GAP 5 (Unrouted pages cleanup)




# Consumer PWA App — Full E2E Audit & Gap Analysis

## Audit Scope
All 40+ pages under `/app/*`, their corresponding edge functions, database queries, RLS policies, and data flow integrity.

---

## Section 1: Critical Gaps Identified

### GAP 1: Bill Payments — Direct Client-Side DB Writes (CRITICAL)
**File:** `CustomerBills.tsx` lines 78-127
**Issue:** Bill payments insert transactions and update balances directly via `supabase.from('transactions').insert(...)` and `supabase.from('account_balances').update(...)` from the client side. This violates the financial mediation rule — all financial operations must be mediated by server-side edge functions to prevent manipulation.
**Fix:** Refactor to call the existing `api-bills` edge function instead of direct DB writes. The edge function already exists and performs proper server-side balance validation.

### GAP 2: CustomerDisputes — Transaction Query Uses Wrong Filter
**File:** `CustomerDisputes.tsx` line 49
**Issue:** Recent transactions query filters by `.eq("account_id", user.id)` — but `account_id` is a UUID referencing the `accounts` table, not the user ID. This will always return zero results, so users cannot select a transaction to dispute.
**Fix:** First fetch user's account IDs, then query transactions with `.in("account_id", accountIds)`.

### GAP 3: Cart Item Updates — Direct Client-Side DB Writes
**File:** `CustomerCart.tsx` lines 54-64
**Issue:** Cart item quantity updates and deletions are done directly via `supabase.from('pos_consumer_cart_items').delete()` and `.update()`. While less critical than financial writes, this bypasses the `pos-consumer-cart` edge function which has the `add` action but lacks `update_quantity` and `remove` actions.
**Fix:** Add `update_quantity` and `remove` actions to the `pos-consumer-cart` edge function, then update the frontend to use it.

### GAP 4: Split Bills — Missing Edge Function Mediation
**File:** `CustomerSplitBills.tsx`
**Issue:** Split bill creation inserts directly into `split_bills` and `split_bill_participants` tables from client side. No edge function validates the data or handles notification dispatch server-side.
**Fix:** Create a `split-bills-ops` edge function with `create`, `settle_participant`, and `remind` actions.

### GAP 5: Recurring Payments — Client-Side Insert
**File:** `CustomerRecurring.tsx`
**Issue:** New recurring payment creation inserts directly into the `recurring_payments` table from the client. While the `recurring-payments-cron` edge function handles execution, creation should also be server-mediated for validation.
**Fix:** Add a `create` action to the existing recurring payments flow or create a new edge function.

### GAP 6: POS Consumer Checkout — Idempotency Key Includes Timestamp
**File:** `CustomerCart.tsx` line 74
**Issue:** The idempotency key uses `Date.now()` — `checkout_${cart.id}_${Date.now()}`. If the user retries a failed checkout, a new timestamp generates a new key, defeating idempotency. Should use only `cart.id`.
**Fix:** Change to `checkout_${cart.id}`.

### GAP 7: CustomerBillsV2 — Unused/Dead Route
**File:** `CustomerBillsV2.tsx` exists but has no route in `App.tsx`.
**Status:** Not a gap per se, but should be cleaned up or routed.

---

## Section 2: Edge Function Coverage Matrix

| Consumer Feature | Edge Function | Status |
|---|---|---|
| Transfer (P2P) | `api-transfers` | Working — fixed in prior session |
| Fund Wallet | `gateway-create-funding-intent` | Working |
| Cash Out | `gateway-process-withdrawal` | Working |
| Bill Pay | `api-bills` (exists but NOT called) | **GAP 1** |
| Split Bills | None | **GAP 4** |
| Recurring | `recurring-payments-cron` (exec only) | **GAP 5** |
| Piggy Bank | `piggybank` | Working |
| Njangi | `njangi-ops` | Working |
| Credit Score | `credit-ops` | Working |
| Rent Reporting | `piggybank` (action: pay) | Working |
| Remittance (Send) | `remittance-outbound` | Working |
| Remittance (Receive) | Direct DB query | OK (read-only) |
| Disputes | `gateway-file-dispute` | Working (but GAP 2 blocks TX selection) |
| QR Scan Pay | `pos-qr-payment` | Working |
| Store Cart Add | `pos-consumer-cart` | Working |
| Store Checkout | `pos-consumer-checkout` | Working (GAP 6 idempotency) |
| Invoices | `send-customer-invoice` | Working |
| Travel Booking | `travel-book-and-pay` | Working |
| Pay By Bank | `pay-by-bank` | Working |
| PIN Set | `pin-code-set` | Working |
| Auth/Register | `identity-register` / auth | Working |

---

## Section 3: Implementation Plan

### Step 1: Fix Bill Payments — Route Through Edge Function (CRITICAL)
- Modify `CustomerBills.tsx` to call `supabase.functions.invoke('api-bills', { body: { ... } })` instead of direct DB writes
- The `api-bills` edge function already handles balance check, transaction creation, and balance deduction atomically
- Pass `account_id`, `biller_name`, `bill_reference`, `amount`, `currency`, `bill_type`

### Step 2: Fix Disputes Transaction Filter
- In `CustomerDisputes.tsx`, fetch user's accounts first, then filter transactions by `account_id` in those accounts
- Pattern: use `useCustomerAccounts(user?.id)` hook already available

### Step 3: Fix Checkout Idempotency Key
- In `CustomerCart.tsx`, change idempotency key from `checkout_${cart.id}_${Date.now()}` to `checkout_${cart.id}`

### Step 4: Add Cart Update/Remove to Edge Function
- Add `update_quantity` and `remove` actions to `pos-consumer-cart` edge function
- Update `CustomerCart.tsx` to call edge function instead of direct DB writes

### Step 5: Create Split Bills Edge Function
- New edge function `split-bills-ops` with actions: `create`, `settle`, `remind`
- Update `CustomerSplitBills.tsx` to use it

### Step 6: Create Recurring Payment Creation via Edge Function
- Add validation for new recurring payment creation server-side
- Either extend an existing function or create `recurring-payment-create`

---

## Section 4: Technical Details

### Files to Modify
1. `src/pages/customer-app/CustomerBills.tsx` — Replace direct DB writes with edge function call
2. `src/pages/customer-app/CustomerDisputes.tsx` — Fix transaction query filter
3. `src/pages/customer-app/CustomerCart.tsx` — Fix idempotency key + use edge function for updates
4. `supabase/functions/pos-consumer-cart/index.ts` — Add `update_quantity` and `remove` actions
5. `src/pages/customer-app/CustomerSplitBills.tsx` — Route through new edge function
6. `supabase/functions/split-bills-ops/index.ts` — New file
7. `src/pages/customer-app/CustomerRecurring.tsx` — Route creation through edge function

### Priority Order
1. **P0 (Security):** GAP 1 (Bills direct DB write) — financial integrity violation
2. **P0 (Functional):** GAP 2 (Disputes broken filter) — feature completely broken
3. **P1 (Integrity):** GAP 6 (Idempotency) — duplicate charge risk
4. **P2 (Hardening):** GAPs 3, 4, 5 — client-side write elimination

### Database Changes
- None required — all tables already exist
- No schema modifications needed

### RLS Considerations
- Current RLS allows authenticated users to insert into `transactions` and update `account_balances` — this is what enables the client-side exploit in GAP 1. After fixing, consider tightening RLS to restrict writes to service_role only.


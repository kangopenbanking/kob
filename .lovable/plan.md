

# Consumer App ↔ Merchant/Business App Integration Analysis

## Current State: What Already Works

### 1. QR Code Scan & Pay (Working)
- **Merchant side**: `BusinessReceive.tsx` generates QR via `pos-qr-payment?action=generate` with `kob_pos_pay` payload
- **POS Till**: `usePOSTill.ts` generates order-linked QR for wallet payments, polls for completion via `WalletQRDialog`
- **Consumer side**: `CustomerScan.tsx` detects `kob_pos_pay` QR codes, displays merchant name + amount, calls `pos-qr-payment?action=pay`
- **Edge function**: `pos-qr-payment` handles generate + pay atomically (wallet debit, merchant credit, order creation)

### 2. Marketplace & Cart Checkout (Working)
- **Consumer**: Browse stores (`CustomerStores`), view products (`CustomerStoreDetail`), add to cart (`pos-consumer-cart`), checkout (`pos-consumer-checkout`)
- **Edge function**: `pos-consumer-checkout` performs wallet-to-wallet payment with inventory decrement

### 3. Payment Links (Working)
- **Merchant**: Creates links via `gateway-create-payment-link`, shared URL `/pay/:slug`
- **Consumer**: `CustomerPayLinks.tsx` for P2P links
- **Hosted checkout**: `PaymentCheckout.tsx` renders at `/pay/:slug`

### 4. Order Tracking (Working)
- `CustomerOrderTracking.tsx` fetches `pos_orders` by `customer_email`

### 5. Wishlist & Favorites (Working)
- `CustomerWishlist.tsx` with `customer_favorite_merchants` and `customer_wishlist_items`

---

## Identified Gaps

### Gap 1: QR Payment Has No Receipt Confirmation for Consumer
**Problem**: After `pos-qr-payment?action=pay` succeeds, the consumer sees a toast but no receipt screen. The merchant till gets a receipt via polling, but the consumer has no order confirmation UI.
**Fix**: After successful QR payment, navigate to a payment success screen showing order number, merchant name, amount, and timestamp.

### Gap 2: Consumer Cannot View In-Store (POS Till) Orders
**Problem**: `CustomerOrderTracking` matches by `customer_email`, but POS till orders created via QR scan use `consumer_user_id` in `metadata_json` — not `customer_email`. Orders placed via QR won't appear in tracking.
**Fix**: Update `CustomerOrderTracking` query to also match orders where `metadata_json->>'consumer_user_id'` equals the current user ID.

### Gap 3: No Consumer Transaction History for QR Payments
**Problem**: QR payments debit the consumer's `account_balances` but don't create a `transactions` record in the consumer's transaction ledger. The payment only shows as a balance change.
**Fix**: In `pos-qr-payment` edge function (pay action), insert a transaction record into the consumer's transaction history after successful payment.

### Gap 4: BusinessReceive QR Has No Order Linking
**Problem**: `BusinessReceive.tsx` generates static/dynamic QR codes without an `order_id`. When the consumer pays, a new order is created, but it has no line items — just an amount. The merchant can't reconcile which products were purchased.
**Fix**: This is by design for ad-hoc payments (like tipping or simple invoicing). No change needed, but add a note in the UI: "For itemized orders, use the POS Till."

### Gap 5: No Push Notification to Merchant on QR Payment
**Problem**: When a consumer pays via QR (outside the till), the merchant has no real-time notification. The till polls, but `BusinessReceive` doesn't poll at all.
**Fix**: Add realtime subscription on `pos_order_payments` for the merchant's orders so `BusinessReceive` and `BusinessHome` show instant payment confirmations.

### Gap 6: Mobile Money Not Connected to Consumer App
**Problem**: The POS Till offers "Mobile Money" as a payment method, but `pos-pay-order` only handles `cash` and `wallet`. There's no MoMo charge flow for in-store POS. The Consumer App has no way to pay merchants via MoMo.
**Fix**: Wire `mobile_money` method in `pos-pay-order` to call the existing `gateway-create-charge` with `channel: 'mobile_money'`, prompting the consumer's phone for USSD confirmation.

### Gap 7: No Merchant Store QR Code (Deep Link)
**Problem**: Merchants can't generate a QR that links consumers directly to their storefront (`/app/stores/:merchantId`). Current QR is payment-only.
**Fix**: Add a "Store QR" option in `BusinessReceive` or `BusinessMore` that generates a `kob_store` type QR. Update `CustomerScan` to recognize it and navigate to the store page.

### Gap 8: Payment Links Not Payable via Consumer Wallet
**Problem**: `PaymentCheckout.tsx` (hosted `/pay/:slug`) only shows a generic form. It doesn't offer wallet payment for authenticated Kang App users.
**Fix**: In `PaymentCheckout`, detect if user is authenticated in the Kang App context and offer "Pay with Wallet" as a primary option alongside card/MoMo.

---

## Implementation Plan

### Phase 1: Fix Critical Payment Gaps (High Priority)

**1. Consumer QR Payment Success Screen**
- Create `src/components/customer-app/QRPaymentSuccess.tsx` — shows merchant name, amount, order number, timestamp, "Done" button
- Update `CustomerScan.tsx` `handlePayNow` to show this screen after successful payment instead of just a toast

**2. Fix Order Tracking for QR Payments**
- Edit `CustomerOrderTracking.tsx` to add an OR condition matching `metadata_json->>'consumer_user_id'` = current user ID
- This surfaces POS till QR payments and ad-hoc QR payments in the consumer's order history

**3. Consumer Transaction Record for QR Payments**
- Edit `pos-qr-payment` edge function (pay action) to insert into `transactions` table after successful wallet debit
- Fields: user_id, type='payment', amount, currency, description with merchant name, reference to order_id

### Phase 2: Enhance Cross-App Experience (Medium Priority)

**4. Merchant Store QR Code (Deep Link)**
- Add `kob_store` QR type generation in `BusinessReceive.tsx` or `BusinessMore.tsx`
- Update `CustomerScan.tsx` to handle `type: 'kob_store'` → navigate to `/app/stores/:merchantId`

**5. Real-time Payment Notifications for Merchants**
- In `BusinessReceive.tsx` and `BusinessHome.tsx`, subscribe to `pos_order_payments` via Supabase Realtime
- Show toast + sound when payment is received
- Enable realtime on `pos_order_payments` table

**6. Wallet Payment on Hosted Payment Links**
- Edit `PaymentCheckout.tsx` to check for active Supabase session
- If authenticated, show "Pay with Kang Wallet" button that calls `pos-qr-payment?action=pay` with the payment link's merchant_id and amount

### Phase 3: Complete Payment Method Coverage (Lower Priority)

**7. Mobile Money POS Integration**
- Add `mobile_money` case to `pos-pay-order` edge function
- Call `gateway-create-charge` with channel `mobile_money`, customer phone from order
- Return charge reference for USSD confirmation flow

### Database Changes Required
- Enable realtime on `pos_order_payments`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_order_payments;`
- No new tables needed — all gaps are resolvable with existing schema

### Files to Create/Edit

| File | Action | Phase |
|------|--------|-------|
| `src/components/customer-app/QRPaymentSuccess.tsx` | Create | 1 |
| `src/pages/customer-app/CustomerScan.tsx` | Edit — add success screen after QR pay | 1 |
| `src/pages/customer-app/CustomerOrderTracking.tsx` | Edit — add metadata_json user_id match | 1 |
| `supabase/functions/pos-qr-payment/index.ts` | Edit — add transaction record on pay | 1 |
| `src/pages/business-app/BusinessReceive.tsx` | Edit — add store QR + realtime | 2 |
| `src/pages/business-app/BusinessHome.tsx` | Edit — realtime payment notifications | 2 |
| `src/pages/customer-app/CustomerScan.tsx` | Edit — handle `kob_store` QR type | 2 |
| `src/pages/PaymentCheckout.tsx` | Edit — add wallet payment option | 2 |
| `supabase/functions/pos-pay-order/index.ts` | Edit — add mobile_money case | 3 |
| Migration SQL | Enable realtime on pos_order_payments | 2 |




# Deep Audit Report: Consumer App ↔ Business App ↔ Banking App Integration

## Critical Findings

### GAP 1: QR Scanner Only Works on Chrome/Edge (CRITICAL)
**Impact**: Consumer App `/app/scan` cannot scan QR codes on **iOS Safari, Firefox, or older Android browsers**.

The `CustomerScan.tsx` uses the native `BarcodeDetector` API (line 88):
```js
if (!('BarcodeDetector' in window)) return; // silently fails — no fallback
```
There is **no polyfill or fallback library** installed (`jsQR`, `html5-qrcode`, `@aspect/qr-scanner` — none in `package.json`). On unsupported browsers, the camera starts but **never detects any QR code**. No error is shown to the user.

**Fix**: Install `html5-qrcode` (or `jsQR`) as a fallback. When `BarcodeDetector` is unavailable, use the polyfill library to decode frames from the video stream. Show a clear error message if neither is available.

### GAP 2: Customer Order Tracking Page Not Routed (MODERATE)
**Impact**: `CustomerOrderTracking.tsx` exists but has **no route** in `App.tsx`. Consumers cannot view their POS order history from the app.

**Fix**: Add lazy import and route at `/app/orders`. Add a "My Orders" feature card on `CustomerHome.tsx` in the money movement or a new section.

### GAP 3: Banking App QR Pay Has No Scanner (MODERATE)
**Impact**: `BankQRPay.tsx` only generates QR codes for receiving — the "Scan" button shows a toast saying "requires native camera" (line 44). Banking app users cannot scan merchant QR codes.

**Fix**: Add the same QR scanning capability (with `kob_pos_pay` detection) to `BankQRPay.tsx`, or route banking users to a shared scan page.

### GAP 4: Banking App Has No Link to Business App (LOW)
**Impact**: There's no cross-navigation from the Banking App (`/bank`) to the Business App (`/biz`). Users who are both bank customers and merchants have no way to switch.

**Fix**: Add a "Business" link on `BankMore.tsx` (or similar) that navigates to `/biz`.

### GAP 5: Consumer App Missing "My Orders" Entry Point (MODERATE)
**Impact**: Even though `CustomerOrderTracking.tsx` correctly queries `pos_orders` by `consumer_user_id`, there's no navigation entry from `CustomerHome`, `CustomerMore`, or `CustomerActivity` to reach it.

**Fix**: Add "My Orders" to `CustomerHome.tsx` feature grid and `CustomerMore.tsx` menu.

---

## Implementation Plan (Step-by-Step)

### Step 1: Add QR Scanner Fallback Library
- Install `html5-qrcode` package
- Create a shared `useQRScanner` hook that uses `BarcodeDetector` when available, falls back to `html5-qrcode`
- Update `CustomerScan.tsx` to use this hook instead of raw `BarcodeDetector`
- Show an inline error when no scanning method is available

### Step 2: Register Customer Order Tracking Route
- Add lazy import for `CustomerOrderTracking` in `App.tsx`
- Register route at `/app/orders`
- Add "My Orders" card to `CustomerHome.tsx` money movement section (with `Package` icon)
- Add "My Orders" entry to `CustomerMore.tsx`

### Step 3: Add QR Scanning to Banking App
- Rebuild `BankQRPay.tsx` with scan + receive tabs (mirroring `CustomerScan.tsx` pattern)
- Add `kob_pos_pay` detection that calls `pos-qr-payment` edge function
- Add `kob_store` deep-link handling

### Step 4: Add Cross-App Navigation
- Add "Business App" link on `BankMore.tsx` → navigates to `/biz`
- Add "Banking" link on `BusinessMore.tsx` → navigates to `/bank` (if not already present)
- Add "My Orders" link on `CustomerActivity.tsx` header area

### Step 5: Verify Realtime Payment Notification Flow
- Confirm `pos_order_payments` table has realtime enabled (used by `BusinessReceive.tsx` and `BusinessHome.tsx`)
- Confirm consumer's `transactions` table insert (in `pos-qr-payment` edge function) triggers `notify_new_transaction()` trigger for push notifications
- Both are already implemented and wired correctly

---

## Summary Matrix

| # | Gap | Severity | Apps Affected | Fix |
|---|-----|----------|---------------|-----|
| 1 | No QR fallback scanner | **Critical** | Consumer | Add `html5-qrcode` polyfill |
| 2 | Order tracking not routed | Moderate | Consumer | Add `/app/orders` route |
| 3 | Banking QR has no scanner | Moderate | Banking | Add scan tab to BankQRPay |
| 4 | No cross-app navigation | Low | Banking↔Business | Add links on More pages |
| 5 | No "My Orders" entry point | Moderate | Consumer | Add to Home + More |


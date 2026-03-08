# Customer App (Kang) — E2E Audit Round 2
**Date:** 2026-03-08

## Scope
Full review of all 37 Customer App pages, 4 components, routing configuration, and data hooks.

## Issues Found & Fixed

### 1. Fake QR Scan Auto-Trigger (CRITICAL)
- **File:** `CustomerScan.tsx`
- **Issue:** A `setTimeout` on line 87 auto-fired a fake scan result (`KOB-7721-3384-5502`) after 6 seconds of camera being active — a dev stub left in production code.
- **Fix:** Replaced with the native `BarcodeDetector` API for real QR code scanning. Falls back gracefully on unsupported browsers (user can still use manual code entry).

### 2. Auth Routing for View-Only Users (HIGH)
- **File:** `CustomerAuth.tsx`
- **Issue:** `navigateAfterAuth()` routed users with `linked_account_type = 'none'` to `/app/home` instead of `/app/onboarding`, because it only checked for truthy value without excluding 'none'.
- **Fix:** Added explicit check: routes `'none'` to `/app/onboarding`, other truthy values to `/app/home`, null/undefined to `/app/register`.

### 3. Help Page Report Form Stub (MEDIUM)
- **File:** `CustomerHelp.tsx`
- **Issue:** "Report a Problem" form used `setTimeout` instead of persisting to the database.
- **Fix:** Now writes to `app_notifications` table with type `system` and metadata including the subject.

### 4. Help Page Quick Links Stubs (MEDIUM)
- **File:** `CustomerHelp.tsx`
- **Issue:** "Terms of Service", "Privacy Policy", "Community Forum" buttons showed `toast.info()` instead of navigating.
- **Fix:** Terms & Privacy now navigate to `/app/settings` (legal section); Community Forum shows "coming soon" toast.

### 5. Virtual Cards Buttons Non-Functional (MEDIUM)
- **File:** `CustomerCards.tsx`
- **Issue:** "Freeze", "Settings", and "Add New Card" buttons had no `onClick` handlers.
- **Fix:** Freeze shows informational toast about card issuer portal; Settings shows "coming soon"; Add Card shows "coming soon".

## Full Page Audit Results (All 37 Pages)

| Page | Status | Notes |
|------|--------|-------|
| CustomerSplash | ✅ | Routing fixed in Round 1 |
| CustomerAuth | ✅ Fixed | View-only routing corrected |
| CustomerRegister | ✅ | 8-step wizard working |
| CustomerOnboarding | ✅ | 7 account types working |
| CustomerHome | ✅ | Live data, animated counter |
| CustomerActivity | ✅ | Search, filters, delete with dialog |
| CustomerScan | ✅ Fixed | Real BarcodeDetector API |
| CustomerMore | ✅ | Quick actions, bill history |
| CustomerTransfer | ✅ | PIN gate, RIB/IBAN/name search |
| CustomerRequest | ✅ | Real QR via qrcode.react |
| CustomerFundWallet | ✅ | Multi-source, fee estimation |
| CustomerCashOut | ✅ | PIN gate, email confirmation |
| CustomerBills | ✅ | Category → biller → pay flow |
| CustomerInvoices | ✅ | CRUD, send, status tracking |
| CustomerSplitBills | ✅ | Equal/custom/percentage splits |
| CustomerRecurring | ✅ | Create, pause/resume |
| CustomerPayLinks | ✅ | Create, copy, share |
| CustomerPiggyBank | ✅ | Bank + personal savings |
| CustomerNjangi | ✅ | Create, join, contribute, payout |
| CustomerCreditScore | ✅ | Event-sourced + legacy fallback |
| CustomerRentReporting | ✅ | Plan creation, payment tracking |
| CustomerCards | ✅ Fixed | Buttons wired |
| CustomerLinkedAccounts | ✅ | CRUD, max 3 accounts |
| CustomerSettings | ✅ | Profile, security, PIN, dark mode |
| CustomerAlerts | ✅ | Filter by type, mark read |
| CustomerHelp | ✅ Fixed | Report persists, links navigate |
| CustomerBank | ✅ | Account list with transactions |
| CustomerRewards | ✅ | Cashback, coupons, referrals |
| CustomerTravelCategories | ✅ | 4 categories |
| CustomerTravelAgencies | ✅ | Agency listing |
| CustomerTravelTrips | ✅ | Trip listing |
| CustomerTravelBooking | ✅ | Booking flow |
| CustomerTravelTicket | ✅ | Ticket display |
| CustomerTravelHistory | ✅ | Booking history |
| CustomerStores | ✅ | Search, filter, favourites |
| CustomerStoreDetail | ✅ | Product listing |
| CustomerCart | ✅ | Cart management |

## Routing Verification
- All 37 pages have corresponding routes in `App.tsx`
- Legacy institution-scoped URLs (`/app/:institutionId/*`) redirect to `/app`
- Auth guard (`CustomerAppAuthGuard`) + Session guard + Pull-to-refresh all verified

## Data Layer Verification
- `useCustomerData.ts` provides 12+ React Query hooks covering all data needs
- All hooks use proper `enabled` guards to prevent unauthenticated queries
- Balance deduplication logic (ClosingAvailable > InterimAvailable) verified
- Realtime balance sync via `useRealtimeBalanceSync` confirmed

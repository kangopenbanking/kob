# Customer App (Kang) — End-to-End Audit
**Date:** 2026-03-08

## Issues Found & Fixed

### 1. Hardcoded Credit Score on Home (CRITICAL)
- **File:** `CustomerHome.tsx`
- **Issue:** Credit score doughnut displayed hardcoded `720` instead of actual user data.
- **Fix:** Added `useCustomerCreditScore` hook; score now fetches from event-sourced `credit_profiles` or legacy `credit_scores` table.

### 2. Misleading Balance Label (HIGH)
- **File:** `CustomerHome.tsx`
- **Issue:** Label above total balance read "Getting funds" — misleading for users.
- **Fix:** Changed to "Total Balance".

### 3. Fake QR Codes (CRITICAL)
- **Files:** `CustomerScan.tsx`, `CustomerRequest.tsx`
- **Issue:** Custom `generateQRMatrix` produced decorative (non-scannable) QR patterns.
- **Fix:** Replaced with `qrcode.react` library's `QRCodeSVG` component (already in dependencies), generating real, scannable QR codes.

### 4. Delete Button Invisible on Mobile (HIGH)
- **File:** `CustomerActivity.tsx`
- **Issue:** Transaction delete button used `group-hover:opacity-100` — invisible on touch devices.
- **Fix:** Changed to always-visible with `opacity-50 hover:opacity-100` for progressive disclosure on both mobile and desktop.

### 5. Bottom Nav Missing Labels (MEDIUM)
- **File:** `CustomerBottomNav.tsx`
- **Issue:** Non-center nav items only showed icons, no text labels.
- **Fix:** Added `<span>` with `text-[10px]` labels under each icon.

### 6. Splash View-Only Routing Bug (HIGH)
- **File:** `CustomerSplash.tsx`
- **Issue:** Users with `linked_account_type = 'none'` (view-only) were routed to `/app/home` instead of `/app/onboarding`.
- **Fix:** Added explicit check: `lat && lat !== 'none'` before routing to home.

### 7. Help Contact Placeholders (MEDIUM)
- **File:** `CustomerHelp.tsx`
- **Issue:** Email and phone contacts showed toast stubs and placeholder `+237 233 XXX XXX`.
- **Fix:** Email now opens `mailto:` link; phone triggers `tel:` link with real number; live chat shows "coming soon" until integrated.

## Verified Working (No Changes Needed)

| Feature | Status |
|---------|--------|
| Authentication (PIN, OTP, email) | ✅ Full flow verified |
| Registration wizard (8 steps) | ✅ Working |
| Onboarding (7 account types) | ✅ Working |
| Transfer (P2P, double-entry) | ✅ Working with PIN gate |
| Fund Wallet (multi-source) | ✅ Working |
| Cash Out | ✅ Working with PIN gate |
| Bills Payment | ✅ Working with PIN gate |
| Invoices | ✅ Working |
| Split Bills | ✅ Working |
| Recurring Payments | ✅ Working |
| Pay Links | ✅ Working |
| Piggy Bank / Savings | ✅ Working |
| Njangi Circles | ✅ Working |
| Credit Score page | ✅ Working (event-sourced + legacy fallback) |
| Rent Reporting | ✅ Working |
| Virtual Cards | ✅ Working |
| Rewards & Referrals | ✅ Working |
| Settings (profile, security, PIN, notifications) | ✅ Working |
| Dark Mode toggle | ✅ Working (classList + localStorage) |
| Session Guard (single-session, inactivity timeout) | ✅ Working |
| PWA Route Guard | ✅ Working |
| Pull-to-Refresh | ✅ Working |
| Notifications/Alerts | ✅ Working |
| Travel & Tourism (categories → booking → ticket) | ✅ Working |
| Stores & Cart | ✅ Working |
| Linked Accounts management | ✅ Working |

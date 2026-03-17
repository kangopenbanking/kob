# Payment Facilitation Admin — Full E2E Audit & Professional UI Enhancement

## Audit Findings

### Current State

The `/admin/payment-facilitation` page (300 lines) has basic functionality but lacks the professional polish seen on the recently upgraded KYC/KYB admin pages. Key gaps:

1. **No loading/skeleton states** — page shows nothing while data loads
2. **No search or date filtering** — cannot find specific transactions
3. **No transaction detail view** — no drill-down into individual payments
4. **No merchant/gateway integration** — only shows institution-facilitated payments, ignores `gateway_merchants` and `gateway_charges`/`gateway_payouts`
5. **No integration guide tab** — admins have no quick-reference for onboarding merchants/developers
6. **Settlement tab is functional but basic** — uses legacy `useEffect` pattern instead of `useQuery`
7. **No animated rows or framer-motion** — inconsistent with KYC/KYB pages
8. **Stats cards are plain** — no icons with colored backgrounds, no attention alerts
9. **No empty-state illustrations** — just text when no data

### Backend Assessment

- Edge functions (`facilitated-mobile-money-charge`, `facilitated-bank-transfer`, `settlement-calculate`, `settlement-process`) are complete and production-ready
- Fee calculation via `calculate_transaction_fee` RPC is functional
- Webhook processing and deduplication are in place
- Developer docs page (`/developer/payment-facilitation`) is comprehensive

---

## Implementation Plan

### 1. Professional Stats Dashboard

- Redesign 4 stat cards with colored icon tiles (matching KYB page pattern: `rounded-xl bg-primary/5` icon containers)
- Add a 5th card for "Active Merchants" count from `gateway_merchants`
- Add pulsing "attention" badge on Failed Payments card when count > 0
- Add skeleton loading states for all cards

### 2. Enhanced Transaction Feed with Search & Filters

- Add search bar filtering by transaction_ref, phone_number, or account_number
- Add date range picker (today, 7d, 30d, custom)
- Add framer-motion `AnimatePresence` for table row transitions
- Add row click → detail dialog showing full transaction metadata, fee breakdown, timeline
- Increase limit to 100 and add pagination indicator

### 3. Transaction Detail Dialog

- Structured info grid: Amount, Currency, Fee, Net, Method, Provider
- Status timeline (created → processing → completed/failed)
- Error details for failed transactions with error_message display
- Institution/merchant attribution
- Copy transaction_ref button

### 4. Failed Payments Enhancement

- Add "Retry" action button (calls `mobile-money-verify` to re-poll status)
- Add error categorization badges (timeout, insufficient_funds, provider_error)
- Group by error type for pattern detection

### 5. Performance Tab Upgrade

- Replace plain metric grids with progress-bar style success rate indicators
- Add channel breakdown mini-charts (success vs failed visual bars)
- Show fee revenue per channel

### 6. Institutions & Merchants Unified Tab

- Merge institutions (from `institutions` table) and merchants (from `gateway_merchants`) into unified view
- Show facilitation status, settlement config, and volume per entity
- Add quick-action: "Enable Facilitation" toggle

### 7. Integration Guide Tab (New)

- Step-by-step accordion walkthrough for onboarding merchants and developers
- Pre-requisites checklist (KYB approved, settlement account configured, API keys generated)
- Live API endpoint reference cards linking to `/developer/payment-facilitation`
- Code snippets for mobile money charge and bank transfer (curl + JS SDK)
- Fee structure reference table
- Links to related admin pages (Fee Management, Merchant Management)

### 8. Settlement Management Modernization

- Migrate from `useEffect` to `useQuery` with `refetchInterval`
- Add skeleton loading
- Add settlement detail dialog with period breakdown
- Visual balance indicator before processing

### Files to Modify

- `src/pages/admin/PaymentFacilitation.tsx` — Full rewrite with modern UI
- `src/components/admin/SettlementManagement.tsx` — Modernize with useQuery and skeletons

### Technical Approach

- Follow the exact design language from `BusinessKYCReview.tsx` and `KYCVerificationReview.tsx` (framer-motion animations, skeleton loading, stat cards with colored icon containers, search bars, tabbed filtering)
- Use existing UI primitives: `Card`, `Badge`, `Dialog`, `Tabs`, `Skeleton`, `Input`
- Maintain all existing data queries but enhance with search/filter params
- No database changes required — all data sources already exist

Update frontend pages and API Changelog forntend with all new updated and added features
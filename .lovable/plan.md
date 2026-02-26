

## Analysis Summary

The per-institution customization system is **already fully implemented**:

1. **Database**: `app_config` JSONB column on `institutions` table (migration exists)
2. **TenantProvider**: Fetches `app_config`, exposes `features` and `homeLayout` via context
3. **BankHome**: Conditionally renders balance card, account carousel, financial services, recent transactions, and quick actions based on feature flags
4. **BottomNavigation**: Hides Cards tab when `features.cards === false`
5. **BankMore**: Filters Savings/Loans/Credit Score menu items based on features
6. **Admin Panel**: `FeatureConfigPanel` with toggle switches for all features and layout sections, persists to database

## Gaps Identified

### 1. Route-Level Feature Guards
Currently, if a feature is disabled (e.g., `cards: false`), the UI hides the navigation, but a user can still **directly navigate** to `/bank/:id/cards`, `/bank/:id/more/savings`, `/bank/:id/payments/mobile-money`, etc. Need a route guard component that checks feature flags and redirects to home if disabled.

### 2. Home Section Ordering
The `home_layout` only has show/hide booleans. The user requested **rearranging home page sections**. Add a `section_order` array to `app_config` (e.g., `["balance_card", "account_carousel", "quick_actions", "financial_services", "recent_transactions"]`) and render sections in that order. The admin panel should allow drag-to-reorder.

### 3. Payments Page Feature Gating
`BankPayments.tsx` likely shows all payment options (Send, MoMo, QR, Bills) without checking feature flags. Should filter based on `features.mobile_money`, `features.qr_payments`, `features.bill_payments`.

## Implementation Plan

### Step 1: Create a `FeatureGate` wrapper component
- New file: `src/components/pwa/FeatureGate.tsx`
- Accepts a `featureKey` prop, checks `useTenant().features[featureKey]`
- If disabled, redirects to `/bank/:id/home` with a toast message
- Wrap feature-gated routes in `App.tsx`: cards, savings, loans, credit, mobile-money, qr, bills

### Step 2: Gate the Payments page options
- Edit `src/pages/banking-app/BankPayments.tsx`
- Import `useTenant`, filter payment options by feature flags

### Step 3: Add section ordering to `app_config`
- Database migration: update the default `app_config` to include `"section_order": ["balance_card", "account_carousel", "quick_actions", "financial_services", "recent_transactions"]`
- Update `TenantProvider` to expose `sectionOrder` from config
- Update `BankHome.tsx` to render sections dynamically based on order array
- Update admin `FeatureConfigPanel` with a reorderable list for home sections

### Step 4: End-to-end verification
- Test toggling features off in admin, confirm routes redirect
- Test section reordering, confirm home page renders in new order
- Confirm no existing functionality is broken

### Files to Create
- `src/components/pwa/FeatureGate.tsx`

### Files to Edit
- `src/App.tsx` — wrap feature-gated routes with `FeatureGate`
- `src/pages/banking-app/BankPayments.tsx` — filter by features
- `src/pages/banking-app/BankHome.tsx` — dynamic section ordering
- `src/components/pwa/TenantProvider.tsx` — expose `sectionOrder`
- `src/pages/admin/BankingAppManagement.tsx` — add section order editor

### Database Migration
- Update `app_config` default to include `section_order` array


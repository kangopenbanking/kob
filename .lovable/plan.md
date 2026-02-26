

## Current State
All banking app instances share one React template. Differentiation is limited to branding fields in the `institutions` table: `institution_name`, `logo_url`, `primary_color`, `tagline`.

## Proposed: Per-Institution Feature Configuration

### 1. Database Migration
Add a `app_config` JSONB column to the `institutions` table with defaults:
```sql
ALTER TABLE institutions 
ADD COLUMN app_config jsonb DEFAULT '{
  "features": {
    "cards": true,
    "savings": true,
    "loans": true,
    "credit_score": true,
    "mobile_money": true,
    "qr_payments": true,
    "bill_payments": true
  },
  "home_layout": {
    "show_balance_card": true,
    "show_account_carousel": true,
    "show_financial_services": true,
    "show_recent_transactions": true
  }
}'::jsonb;
```

### 2. TenantProvider Enhancement
- Fetch `app_config` alongside branding fields
- Expose feature flags via `useTenant()` context (e.g., `tenant.features.cards`)

### 3. Conditional Feature Rendering
- **BankHome**: Conditionally render Financial Services grid, Quick Actions based on flags
- **BottomNavigation**: Hide Cards tab if `features.cards === false`
- **BankMore**: Filter menu items based on enabled features
- **Quick Actions**: Show/hide MoMo, QR Pay based on flags

### 4. Admin Portal — App Config Editor
- Add a "Features" tab to the existing `BankingAppManagement.tsx` page
- Toggle switches for each feature per institution
- Updates `app_config` JSONB via Supabase update

### Files to Edit
- `supabase/migrations/` — new migration for `app_config` column
- `src/components/pwa/TenantProvider.tsx` — fetch and expose `app_config`
- `src/pages/banking-app/BankHome.tsx` — conditional rendering
- `src/components/pwa/BottomNavigation.tsx` — conditional tabs
- `src/pages/banking-app/BankMore.tsx` — conditional menu items
- `src/pages/admin/BankingAppManagement.tsx` — feature config UI


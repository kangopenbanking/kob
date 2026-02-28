

## Architecture Clarification

The current system treats the Customer App as institution-specific (`/app/:institutionId`), mirroring the Banking App pattern. The user wants a different model:

- **Banking Apps**: One per institution (current pattern is correct - `/bank/:institutionId`)
- **Customer App**: ONE unified app for ALL customers (`/app/*`), not scoped to a single institution. Customers link to one or more banking institutions through the API.

## Plan

### 1. Restructure Customer App routes from institution-scoped to unified

**File:** `src/App.tsx`
- Change all `/app/:institutionId/*` routes to `/app/*` (no institutionId param)
- Update splash, auth, register, onboarding, and all nested routes

### 2. Replace CustomerTenantProvider with a unified Kang-branded context

**File:** `src/components/customer-app/CustomerTenantProvider.tsx`
- Remove dependency on `institutionId` URL param
- Hardcode Kang Open Banking branding (name: "Kang", platform primary color)
- Customer app config comes from a single platform-level config, not per-institution

### 3. Update CustomerAppLayout to remove institution scoping

**File:** `src/components/customer-app/CustomerAppLayout.tsx`
- Remove `useParams` for institutionId
- Set basePath to `/app`
- Remove OneSignal institution scoping (or scope to platform-level)

### 4. Update all Customer App pages to remove institutionId from navigation

**Files:** All `src/pages/customer-app/*.tsx` files
- Remove `useParams` calls that extract `institutionId`
- Update all `navigate()` calls from `/app/${institutionId}/...` to `/app/...`
- Data fetching will use the user's linked accounts (from `customer_linked_accounts` table) to determine which institutions they're connected to, rather than URL-based scoping

### 5. Update Customer App data hooks to be multi-institution

**File:** `src/hooks/useCustomerData.ts`
- Instead of filtering by a single `institution_id` from URL, fetch data across ALL institutions the user has linked accounts with
- Use `customer_linked_accounts` table to get the user's connected institutions
- Aggregate balances, transactions, etc. across all linked banking institutions

### 6. Add institution selector/switcher in Customer App

The Customer App home should show accounts from ALL linked banking institutions. Users can see which bank each account belongs to. This replaces the current single-institution view.

### 7. Update admin Customer App Management

**File:** `src/pages/admin/CustomerAppManagement.tsx`
- The management page currently selects an institution and configures per-institution customer app settings
- Restructure to manage the ONE unified customer app config at the platform level
- Keep the institution list for viewing linked customers per institution

### 8. Update Apps.tsx references

**File:** `src/pages/Apps.tsx`
- Change Customer App link from `/app/f493095b-037a-40cf-82bc-3a3ab74550dd` to `/app`
- Update description to reflect unified app model

### 9. Auto-initialize Banking App config on institution registration

**File:** `supabase/functions/institution-register/index.ts`
- Add default `app_config` with banking app defaults when inserting institution
- Each institution gets their own Banking App automatically

**File:** `supabase/functions/admin-institution-approve/index.ts`
- Backfill `app_config` if missing during approval

### 10. Deep-link support for cross-institution transfers

Update transfer and payment flows in the Customer App to support selecting which linked institution/account to pay from, enabling the "one customer app connects to many banking apps" model via the API.

---

**Summary**: This restructures the Customer App from a per-institution clone to a single unified "Kang" wallet app where customers link multiple banking institutions. Banking Apps remain institution-specific. The Super Admin manages both from the admin portal.


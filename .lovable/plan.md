# URL Canonicalization — Fix All Non-Canonical URLs

## Problem

The codebase uses `window.location.origin` in 8 files to generate shareable/public URLs. In preview or staging environments, this produces URLs like `https://id-preview--xxx.lovable.app/pay/...` instead of canonical `https://kangopenbanking.com/pay/...`. Additionally, 6 email templates hardcode `ftwbtzbeqkqrdmxmyvvz.supabase.co` storage URLs instead of using the canonical domain.

No `lovable.app` strings are hardcoded in source — the issue is dynamic via `window.location.origin`.

## Fix Strategy

### 1. Add `SITE_URL` helper to `src/config/api.ts`

Add a utility function that always returns the canonical base URL for public-facing links:

```typescript
export const getCanonicalUrl = (path: string) => `${API_CONFIG.SITE_URL}${path}`;
```

### 2. Replace `window.location.origin` in 8 files


| File                                                   | Current                                    | Fix                                  |
| ------------------------------------------------------ | ------------------------------------------ | ------------------------------------ |
| `src/pages/business-app/BusinessMore.tsx`              | `${window.location.origin}/app/stores/...` | `getCanonicalUrl('/app/stores/...')` |
| `src/pages/business-app/BusinessReceive.tsx` (3 spots) | `${window.location.origin}/pay/...`        | `getCanonicalUrl('/pay/...')`        |
| `src/pages/merchant/MerchantStorefront.tsx` (2 spots)  | `${window.location.origin}/store/...`      | `getCanonicalUrl('/store/...')`      |
| `src/pages/merchant/MerchantTravelStaffRoles.tsx`      | `${window.location.origin}/staff-login`    | `getCanonicalUrl('/staff-login')`    |
| `src/pages/customer-app/CustomerMarketplace.tsx`       | `${window.location.origin}/app/store/...`  | `getCanonicalUrl('/app/store/...')`  |
| `src/pages/admin/BusinessAppManagement.tsx`            | `${window.location.origin}${path}`         | `getCanonicalUrl(path)`              |


**Auth redirects** in `MobileAuthForm.tsx` and `CustomerAuth.tsx` will keep `window.location.origin` — these are OAuth redirect URIs that must match the current browser origin for the auth flow to work.

### 3. Centralize email logo URL in shared constant

Create `supabase/functions/_shared/email-config.ts` with:

```typescript
export const EMAIL_LOGO_URL = 'https://kangopenbanking.com/kob-logo-email.png';
```

Update all 6 email templates (`signup`, `invite`, `magic-link`, `recovery`, `email-change`, `reauthentication`) to import from the shared config instead of hardcoding the `supabase.co` storage URL.

**Note**: This requires the logo file to be accessible at the canonical domain. If it's only in storage, we keep the storage URL but centralize it in one place for easy future updates.

### 4. Update test expectations

Update `src/test/api-config.test.ts` — no changes needed (already tests `kangopenbanking.com`).

Run and end-to-end test to make sure all the changes a fully working

## Files to Edit


| File                                              | Change                             |
| ------------------------------------------------- | ---------------------------------- |
| `src/config/api.ts`                               | Add `getCanonicalUrl` helper       |
| `src/pages/business-app/BusinessMore.tsx`         | Use `getCanonicalUrl`              |
| `src/pages/business-app/BusinessReceive.tsx`      | Use `getCanonicalUrl` (3 spots)    |
| `src/pages/merchant/MerchantStorefront.tsx`       | Use `getCanonicalUrl` (2 spots)    |
| `src/pages/merchant/MerchantTravelStaffRoles.tsx` | Use `getCanonicalUrl`              |
| `src/pages/customer-app/CustomerMarketplace.tsx`  | Use `getCanonicalUrl`              |
| `src/pages/admin/BusinessAppManagement.tsx`       | Use `getCanonicalUrl`              |
| `supabase/functions/_shared/email-config.ts`      | Create — shared email constants    |
| 6 email templates in `_shared/email-templates/`   | Import logo URL from shared config |

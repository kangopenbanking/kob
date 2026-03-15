

# Account Type Routing Isolation & Consistency Fix Plan

## Problems Found

### 1. Auth.tsx Hardcodes `/dashboard` for ALL Account Types
Every login path (PIN login, OTP verify, Firebase verify, PIN setup, registration complete) navigates to `/dashboard`. But `/dashboard` is wrapped in `NonInstitutionRoute` + `PersonalAccountRoute` guards — meaning:
- **Institution owners/staff** → blocked by `NonInstitutionRoute` → redirected to `/fi-portal` (works, but via a rejection flow with loading spinners)
- **Merchants** → pass through both guards → see the **personal** Dashboard (WRONG — cross-contamination)
- **Developers** → pass through both guards → see the **personal** Dashboard (WRONG)
- **Personal users** → blocked by `PersonalAccountRoute` → redirected to `/credit-score` (correct but via rejection)
- **Admin** → passes through (admin exempt) → sees personal Dashboard (acceptable but not ideal)

### 2. `DashboardRouter` Component Exists But Is NEVER Used
A fully functional `DashboardRouter` and `useDashboardPath` hook exist in `src/components/DashboardRouter.tsx` with correct role-based routing logic for all account types. They are completely unused — no component imports them.

### 3. `UserProfileMenu` Hardcodes `/dashboard` for "My Dashboard"
Line 134: always navigates to `/dashboard` regardless of user role/variant. Institution users clicking "My Dashboard" get bounced through rejection guards.

### 4. Missing Translation Strings
New notification strings from the admin-notify pipeline (e.g., "KYB Submitted", "KYB Approved", "KYC Under Review") are hardcoded in edge functions and not registered for translation.

### 5. Changelog Not Updated
The changelog doesn't reflect the recent E2E audit fixes (admin notifications, KYB pipeline, edge function modernization).

---

## Implementation Plan

### Step 1: Wire `DashboardRouter` into App.tsx Route Table
Add a new route at `/dashboard` that renders `DashboardRouter` (which does smart redirect). Keep the old personal dashboard at a new path like `/personal-dashboard` or use `/dashboard/personal`.

**Change in `src/App.tsx`:**
- Import `DashboardRouter`
- Change `/dashboard` route to use `DashboardRouter` (no guards — it handles its own routing)
- Move the current personal Dashboard to render within DashboardLayout at the same `/dashboard` path but only when DashboardRouter confirms personal role — OR simpler: just let DashboardRouter redirect to `/credit-score` for personal users (already does this)

### Step 2: Update Auth.tsx — All Login Redirects Stay as `/dashboard`
This is already correct! Since Step 1 makes `/dashboard` → `DashboardRouter`, all the existing `navigate('/dashboard')` calls will now route through the smart router. **No changes needed in Auth.tsx.**

### Step 3: Fix UserProfileMenu "My Dashboard" Link
Replace hardcoded `/dashboard` with role-aware path using `useDashboardPath` hook, or use variant-based mapping:
- `variant === 'admin'` → `/admin`
- `variant === 'institution'` → `/fi-portal`  
- `variant === 'developer'` → `/developer`
- default → `/dashboard` (which now smart-redirects)

### Step 4: Add Missing Translation Strings
Add these new strings to `src/lib/i18n/translations.ts` (both `en` and `fr`):
- `kybSubmitted` / `kybApproved` / `kybRejected`
- `kycSubmitted` / `kycApproved` / `kycRejected`
- `onboardingSubmitted` / `onboardingApproved`
- `reviewPending` / `underReview`
- `loginWithPin` / `forgotPassword` / `resetPin`
- Merchant/Developer portal-specific strings

### Step 5: Update Changelog
Add entry for the E2E audit fixes and this routing isolation fix.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Replace `/dashboard` route to use `DashboardRouter`; move personal Dashboard route |
| `src/components/UserProfileMenu.tsx` | Use variant-based dashboard path instead of hardcoded `/dashboard` |
| `src/lib/i18n/translations.ts` | Add ~20 new translatable strings (en + fr) |
| `docs/changelog.md` | Add v5.1.0 entry for routing isolation + E2E audit |

## No Breaking Changes
- All existing `navigate('/dashboard')` calls throughout the codebase will still work — they just now go through the smart router
- All portal routes remain unchanged
- No database changes needed


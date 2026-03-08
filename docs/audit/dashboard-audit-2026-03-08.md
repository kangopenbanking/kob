# Kang Open Banking — Dashboard End-to-End Audit Report

**Date:** 2026-03-08
**Scope:** All 5 dashboard portals (Personal, Admin, Merchant, FI Portal, Customer App) + Developer Portal, Banking App PWA

---

## Executive Summary

| Portal | Pages | Critical | High | Medium |
|--------|-------|----------|------|--------|
| Personal Dashboard (`/dashboard`) | 1 | 1 | 3 | 2 |
| Admin Portal (`/admin`) | 52 | 0 | 4 | 3 |
| Merchant Portal (`/merchant`) | 31 | 0 | 3 | 4 |
| FI Portal (`/fi-portal`) | 38 | 1 | 3 | 2 |
| Customer App (`/app`) | 37 | 0 | 2 | 3 |
| Developer Portal (`/developer`) | 55 | 0 | 1 | 2 |
| Banking App (`/bank/:id`) | 19 | 0 | 1 | 1 |
| **TOTAL** | **233** | **2** | **17** | **17** |

---

## CRITICAL (2 Issues)

### CR1. Personal Dashboard: Balance Uses `InterimAvailable` Instead of `ClosingAvailable`

**File:** `src/pages/Dashboard.tsx` (lines 198-202)

```tsx
const getAccountBalance = (accountId: string) => {
  const balance = balances.find(b => b.account_id === accountId && b.balance_type === "InterimAvailable");
  return balance ? parseFloat(balance.amount) : 0;
};
const getTotalBalance = () => balances.filter(b => b.balance_type === "InterimAvailable").reduce(...)
```

The platform standard (per `financial-balance-update-strategy` memory) is `ClosingAvailable`. All gateway webhooks, funding intents, and the Customer App use `ClosingAvailable`. The Personal Dashboard is the only surface still reading `InterimAvailable`, meaning users see stale or zero balances after gateway-funded deposits.

**Fix:** Change both occurrences of `"InterimAvailable"` to `"ClosingAvailable"`.

---

### CR2. FI Portal: Metrics Query Not Scoped to Institution

**File:** `src/pages/FIPortal.tsx` (lines 64-74)

```tsx
const { data: transactions } = await supabase
  .from("transactions").select("amount", { count: "exact" })
  .gte("created_at", thirtyDaysAgo);
// ^^^ No institution filter — reads ALL transactions in the system

const { data: accounts } = await supabase
  .from("accounts").select("id", { count: "exact" })
  .eq("is_active", true);
// ^^^ No institution filter — counts ALL active accounts
```

This is a **data leak**: any institution owner sees aggregate metrics of the entire platform, not just their own data. The `transactions` and `accounts` queries need `.eq("institution_id", inst.id)` or equivalent account ownership filter.

**Fix:** Filter transactions by accounts belonging to the institution, and filter accounts by `institution_id`.

---

## HIGH (17 Issues)

### H1. Personal Dashboard: Redundant Auth Check + Redirect Loop Risk

**File:** `src/pages/Dashboard.tsx` (lines 69-87)

The Dashboard has its own `checkAuth()` that navigates to `/auth`, but it's already wrapped in `<ProtectedRoute>` in `App.tsx` (line 681). If `has_role` returns `personal`, it redirects to `/credit-score` — but `PersonalAccountRoute` already wraps the route, creating a potential double-redirect scenario.

**Fix:** Remove the manual auth check and personal role redirect; rely on the route guards.

### H2. Personal Dashboard: No Error Handling on Data Fetches

**File:** `src/pages/Dashboard.tsx` (lines 116-187)

All `fetchAccounts`, `fetchConsents`, `fetchPayments`, `fetchCreditScore` calls silently swallow errors. If the database returns an error, the user sees an empty dashboard with no error indication.

**Fix:** Add error handling with toast notifications on fetch failures.

### H3. Personal Dashboard: `consent.permissions` Assumes Array Type

**File:** `src/pages/Dashboard.tsx` (line 565)

```tsx
{consent.permissions.map((perm: string, i: number) => ...)}
```

The `permissions` column is `Json` type. If stored as an object or null, `.map()` will throw a runtime error.

**Fix:** Add `Array.isArray(consent.permissions)` guard.

### H4. FI Portal: Double Auth Check

**File:** `src/pages/FIPortal.tsx` (lines 46-62)

`checkAuthAndInstitution` calls `supabase.auth.getUser()` twice (once in itself, once in `loadInstitution`), and `loadMetrics` calls it a third time. This is 3 redundant auth calls per page load.

**Fix:** Fetch user once and pass to both functions.

### H5. FI Portal: Staff Members Cannot Access Dashboard

**File:** `src/pages/FIPortal.tsx` (line 58)

```tsx
const { data } = await supabase.from("institutions").select("*").eq("user_id", user.id).maybeSingle();
if (!data) { navigate('/register'); return; }
```

Staff members (assigned via `staff_assignments`) are not institution owners. This query returns null for staff, redirecting them to `/register`. The `resolveInstitutionId` pattern (via `get_staff_institution_id` RPC) should be used instead.

**Fix:** Check `get_staff_institution_id` RPC for staff users before falling back to owner check.

### H6. FI Portal: Hardcoded `institution_id` Filter Missing on All Metric Queries

**File:** `src/pages/FIPortal.tsx` (line 70-71)

The `accounts` query has no `institution_id` filter. Even after CR2 is fixed, the query needs to scope by institution accounts.

### H7. Admin Portal: No Loading States on Sub-Pages

Several admin sub-pages (e.g., `SecurityDashboard`, `FraudDetection`, `ReconciliationDashboard`) show a brief flash of empty content before data loads. They should use `<Skeleton>` patterns consistent with the main Admin page.

### H8. Merchant Dashboard: `allChRes.data` Could Hit 1000-Row Limit

**File:** `src/pages/merchant/MerchantDashboard.tsx` (line 59)

```tsx
supabase.from("gateway_charges").select("amount, status, currency, created_at").eq("merchant_id", m.id)
```

No `.limit()` — defaults to 1000. High-volume merchants will see truncated stats. Should use an aggregate RPC or paginated approach.

### H9. Merchant Dashboard: No Merchant Registration CTA for New Users

**File:** `src/pages/merchant/MerchantDashboard.tsx` (line 53)

If `merchant` is null (user has merchant role but no `gateway_merchants` record), the dashboard shows nothing. Should display a registration CTA.

### H10. Merchant Dashboard: Wallet Balance Not Privacy-Toggleable

The Merchant Dashboard shows wallet balances but has no show/hide toggle like the Personal Dashboard and Customer App have.

### H11. Customer App: `useCustomerAccounts` Missing Error Boundary

If the customer has no accounts and makes a transfer, the app may crash on null access. Need defensive checks in transfer/payment flows.

### H12. Customer App: Travel Booking Route Params Not Validated

**File:** `src/App.tsx` (lines 840-843)

Dynamic travel routes (`/app/travel/:category/:serviceId/trips/:tripId`) don't validate that the params are valid UUIDs before querying. Malformed URLs could trigger unhandled query errors.

### H13. Developer Portal: No Breadcrumb Navigation

The developer portal has 55+ nested routes but no breadcrumb component, making it easy to get lost. Other portals (Admin, FI) have sidebar navigation.

### H14. Banking App: `FeatureGate` Fallback Is Blank

**File:** `src/App.tsx` (lines 788-799)

Routes wrapped in `<FeatureGate>` show nothing when the feature is disabled. Should show a "Feature not available" message.

### H15. Merchant Storefront: Route Exists But No Products Table Integration

The `/merchant/storefront` route exists but the page likely uses mock/placeholder data since the `merchant_products` table structure isn't visible in the schema.

### H16. Admin: `LoadTesting` Page May Execute Real Load Tests

The `/admin/load-testing` page could potentially trigger actual load against production edge functions if not properly sandboxed.

### H17. Admin: Missing `Rewards` Management Page

The Customer App has a Rewards feature (`/app/rewards`) but there's no admin page to manage reward rules, point values, or redemptions.

---

## MEDIUM (17 Issues)

### M1. Personal Dashboard: 671 Lines — Should Be Decomposed

The Dashboard.tsx file is 671 lines with inline data fetching, formatting, and rendering. Should be broken into hooks (`useDashboardData`) and sub-components.

### M2. FI Portal: Metrics Show Raw Numbers Without Formatting

**File:** `src/pages/FIPortal.tsx`

Total volume is displayed as a raw number without currency formatting.

### M3. Admin Portal: 52 Sub-Pages Without Search/Filter

No global search across admin sub-pages. At 52 pages, navigation relies entirely on the sidebar.

### M4. Merchant Dashboard: Chart Data Not Grouped by Day Correctly

**File:** `src/pages/merchant/MerchantDashboard.tsx`

If charges span multiple months, the 14-day chart grouping logic may produce gaps.

### M5. Customer App: Color Values Use Raw HSL Instead of Design Tokens

**File:** `src/pages/customer-app/CustomerHome.tsx` (lines 57-77)

```tsx
color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]'
```

These should use semantic design tokens from the design system, not hardcoded HSL.

### M6. Banking App PWA: No Offline Indicator

The Banking App is a PWA but has no offline status indicator when connectivity is lost.

### M7. Route Guard Inconsistency: `/profile` vs `/profile-settings`

Both routes exist (lines 705-706) and render the same `ProfileSettings` component, but with different layouts.

### M8. Legacy Routes: `/developer-old` Still Active

**File:** `src/App.tsx` (line 674)

The old developer page is still accessible. Should redirect to `/developer`.

### M9. Customer App: Missing `pay-links` Feature Gate

`/app/pay-links` isn't wrapped in a `FeatureGate` but other payment features are.

### M10. No 404 Handling Inside Nested Layouts

If a user navigates to `/admin/nonexistent`, they get a blank page inside the admin layout instead of a 404.

### M11. Merchant: Travel-Related Pages (9 routes) Have No Feature Gate

Travel functionality is specific to travel agencies but is visible to all merchants.

### M12. `WidgetCustomizer` — No Default Widgets for New Users

**File:** `src/pages/Dashboard.tsx` (line 309)

If no widgets exist in `dashboard_widgets` table, the widget grid is empty. Should seed defaults on first visit.

### M13. FI Portal: No Revenue/Analytics Chart

The Merchant Dashboard has a 14-day revenue AreaChart, but the FI Portal has no equivalent visualization despite having transaction data.

### M14. Customer App: `CustomerAuth` Not Wrapped in Layout

**File:** `src/App.tsx` (line 807)

`/app/auth` renders `<CustomerAuth />` without `<CustomerAppLayout>`, which is correct for auth, but the splash page (`/app`) also lacks consistent back navigation.

### M15. Admin: `ManagedEmailAdmin` and `EmailTemplates` Are Separate Pages

These could be consolidated into a single email management section to reduce navigation complexity.

### M16. No Global Error Boundary Per Portal

Only the top-level `App` has an `ErrorBoundary`. A crash in one admin page takes down the entire app. Each portal layout should have its own error boundary.

### M17. Duplicate Data Fetching Pattern

Every dashboard manually calls `supabase.auth.getUser()` and then fetches data. Should use a shared `useAuthenticatedUser` hook with React Query.

---

## Recommended Fix Sequence

### Immediate (Critical)
1. **CR1**: Fix balance type in Personal Dashboard (`InterimAvailable` → `ClosingAvailable`)
2. **CR2**: Add institution scoping to FI Portal metrics queries

### Priority 1 (High — Data Integrity & UX)
3. **H1-H3**: Clean up Personal Dashboard (remove redundant auth, add error handling, guard permissions array)
4. **H4-H6**: Fix FI Portal (deduplicate auth, fix staff access, scope all queries)
5. **H8-H10**: Fix Merchant Dashboard (aggregate stats, null merchant CTA, privacy toggle)
6. **H14**: Add FeatureGate fallback message in Banking App

### Priority 2 (High — Polish)
7. **H7**: Add loading skeletons to admin sub-pages
8. **H11-H12**: Add defensive checks in Customer App
9. **H13**: Add breadcrumbs to Developer Portal
10. **H15-H17**: Address storefront, load testing, and rewards gaps

### Priority 3 (Medium — Refactoring)
11. **M1, M17**: Extract shared hooks (`useDashboardData`, `useAuthenticatedUser`)
12. **M5**: Replace raw HSL with design tokens in Customer App
13. **M10**: Add 404 catch-all inside nested layouts
14. **M16**: Add per-portal error boundaries

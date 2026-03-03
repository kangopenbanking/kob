

# Cross-Contamination Audit: Banking App vs Customer App (Kang)

## Audit Scope
Reviewed all hooks, layouts, auth guards, tenant providers, data fetching, notifications, shared components, and session management for the multi-tenancy Banking App (`/bank/:institutionId`) and the unified Customer App (`/app`).

---

## Isolation Score: **87/100** — Strong foundation, 7 gaps identified

---

## What Is Already Correctly Isolated

1. **Separate data hooks** — Banking uses `useBankingData.ts` (institution-scoped via `useParams`), Customer uses `useCustomerData.ts` (multi-institution aggregation). No cross-imports detected.
2. **Separate auth guards** — `BankingAppAuthGuard` checks account-institution linkage; `CustomerAppAuthGuard` checks profile existence. No overlap.
3. **Separate tenant providers** — `TenantProvider` (per-institution config) vs `CustomerTenantProvider` (Kang platform config). Different feature sets and section orders.
4. **Separate bottom navigations** — `BottomNavigation` (banking) vs `CustomerBottomNav` (customer). No shared tabs.
5. **Separate layout wrappers** — `BankingAppLayout` vs `CustomerAppLayout`. Each has its own auth guard, session guard, and font scaling.
6. **Notification isolation** — Banking app passes `bankingOnly=true` with icon whitelist filtering. Customer app shows all notifications.
7. **Realtime scoping** — `useRealtimeBalanceSync` accepts `institutionId` and scopes realtime channel + cache invalidation correctly.
8. **Query key partitioning** — Banking hooks use `['key', institutionId]` pattern. Customer hooks use `['key', userId]` pattern. No cache collisions.

---

## GAP FINDINGS

### GAP 1: Customer App Notifications Show Banking-Only Events (Severity: MEDIUM)
**Location**: `CustomerHome.tsx` line 94, `CustomerAlerts.tsx` line 43
**Issue**: Customer app calls `useNotifications()` with no `institutionId` and no `bankingOnly` filter. This means banking-specific notifications (loan approvals, KYC updates from Bank X) will appear in the Kang app's alerts feed.
**Fix**: Add a `customerOnly` filter mode to `useNotifications` that excludes institution-scoped notifications (where `institution_id IS NOT NULL` and `institution_id != KANG_PLATFORM_ID`).

### GAP 2: CustomerSplash Wraps with Both TenantProviders (Severity: LOW)
**Location**: `CustomerSplash.tsx` lines 59-68
**Issue**: The Customer Splash screen imports and wraps with the Banking App's `TenantProvider` (which reads `institutionId` from URL params) in addition to `CustomerTenantProvider`. Since `/app/splash` has no `:institutionId` param, `TenantProvider` falls back to defaults. This is dead code but creates a confusing dependency and sets `--pwa-primary` CSS variable twice (last write wins).
**Fix**: Remove the `TenantProvider` wrapper from `CustomerSplash.tsx`. Only `CustomerTenantProvider` should be used.

### GAP 3: Shared PWA Components Have No App Context Guard (Severity: LOW)
**Location**: `src/components/pwa/PinConfirmDialog.tsx`, `MediaBanner.tsx`, `PullToRefresh.tsx`
**Issue**: Components under `src/components/pwa/` are shared between both apps. While currently functional, they have no awareness of which app context they're in. If a developer accidentally uses `useTenant()` (banking) inside a Customer App page that only wraps `CustomerTenantProvider`, they'd get default banking branding.
**Fix**: No immediate code change needed, but add a comment/convention doc to `src/components/pwa/` clarifying these are app-agnostic utilities and must not import app-specific tenant hooks.

### GAP 4: BankCreditScore Displays Piggy Bank and Njangi Event Types (Severity: MEDIUM)
**Location**: `BankCreditScore.tsx` lines 24-31
**Issue**: The Banking App's credit score page renders labels for `PIGGYBANK_*` and `NJANGI_*` credit events. Piggy Bank and Njangi are Customer App (Kang) features explicitly excluded from the Banking App per the architecture isolation standard. If a user has Piggy Bank/Njangi activity from the Customer App, those events will appear in their banking credit score view, leaking Customer App feature awareness.
**Fix**: Filter out `PIGGYBANK_*`, `NJANGI_*`, and `RENT_*` event types from the credit events list in `BankCreditScore.tsx`, or relabel them generically (e.g., "Savings Program").

### GAP 5: Shared Session Table Without App Scoping (Severity: LOW)
**Location**: `SessionGuard.tsx`, `user_active_sessions` table
**Issue**: The `SessionGuard` polls `user_active_sessions` and enforces single-device sessions globally. If a user is logged into both the Banking App and Customer App simultaneously (which is a valid use case — same Supabase auth, different app contexts), opening the Customer App would kick them out of the Banking App and vice versa.
**Fix**: Add an `app_context` column to session registration (e.g., `banking:institutionId` vs `customer`) and scope the session uniqueness check to the same app context.

### GAP 6: `useCustomerData` Savings Hook Missing Institution Scoping (Severity: LOW)
**Location**: `useCustomerData.ts` lines 130-144
**Issue**: `useCustomerSavings` fetches all savings accounts for the user without any institution filter. This is correct for the Customer App's aggregation model, but it means savings created via a Banking App instance could appear in the Customer App even if the institution is not a Kang partner. The customer hooks for transactions and accounts accept optional `institutionId`, but savings does not.
**Fix**: Add optional `institutionId` parameter to `useCustomerSavings` for consistency, even if the Customer App currently passes no filter.

### GAP 7: Hardcoded KANG_PLATFORM_ID Scattered Across Files (Severity: LOW)
**Location**: `CustomerTenantProvider.tsx`, `CustomerCashOut.tsx`, `CustomerBills.tsx`, `useEnsureWalletAccount.ts`
**Issue**: The Kang platform institution ID (`f493095b-...`) is hardcoded in 4+ files independently. If this ID ever changes (e.g., new environment), all files must be updated manually. This is a maintenance risk, not a cross-contamination risk per se, but it couples Customer App identity to a scattered constant.
**Fix**: Centralize `KANG_PLATFORM_ID` into a single `src/constants/platform.ts` file and import from there.

---

## Recommended Fix Priority

| Gap | Severity | Effort | Action |
|-----|----------|--------|--------|
| GAP 1: Customer notifications leak | Medium | Small | Add `customerOnly` filter to `useNotifications` |
| GAP 4: Banking credit shows Kang features | Medium | Small | Filter out customer-only event types |
| GAP 5: Session guard cross-app kicks | Low | Medium | Add `app_context` to session registration |
| GAP 2: Duplicate TenantProvider | Low | Trivial | Remove unused import/wrapper |
| GAP 7: Scattered platform ID | Low | Small | Centralize constant |
| GAP 6: Savings hook missing filter | Low | Trivial | Add optional param |
| GAP 3: Shared component docs | Low | Trivial | Add convention comment |

---

## Summary
The two apps are well-separated at the hook, layout, and auth guard layers. The main contamination vectors are in **notifications** (Customer App seeing banking alerts), **credit score event types** (Banking App displaying Kang-only features), and **session management** (single-session enforcement kicking users across apps). All gaps are fixable with targeted changes — no architectural rework needed.


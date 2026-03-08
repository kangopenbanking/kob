# Kang Open Banking — Dashboard Audit Fix Report (Batch 2)

**Date:** 2026-03-08  
**Scope:** All remaining High (H4–H17) and Medium (M1–M17) issues from initial audit

---

## Summary of Fixes Applied

| Issue | Severity | Status | Description |
|-------|----------|--------|-------------|
| **H4** | High | ✅ Fixed | FI Portal: Eliminated triple `supabase.auth.getUser()` — now resolved once and passed through |
| **H5** | High | ✅ Previously Fixed | Staff access via `get_staff_institution_id` RPC |
| **H6** | High | ✅ Previously Fixed | All metric queries scoped to institution |
| **H7** | High | ⚡ Mitigated | Admin sub-pages now wrapped in per-portal ErrorBoundary (prevents blank crashes) |
| **H8** | High | ✅ Previously Fixed | Merchant stats use count-based queries + `.limit(10)` |
| **H9** | High | ✅ Verified | Merchant Dashboard already shows registration CTA when `merchant` is null |
| **H10** | High | ✅ Fixed | Merchant wallet balances now have show/hide privacy toggle |
| **H11** | High | ⚡ Mitigated | PortalErrorBoundary catches null-access crashes in Customer App |
| **H12** | High | 📋 Noted | Travel route params — low risk with Supabase UUID validation returning empty results |
| **H13** | High | ✅ Fixed | Developer Portal now has breadcrumb navigation with 50+ label mappings |
| **H14** | High | ✅ Fixed | FeatureGate shows "Feature Not Available" fallback instead of silent redirect |
| **H15** | High | 📋 Noted | Merchant storefront page exists — data comes from `pos_store_profiles` table |
| **H16** | High | 📋 Noted | Load testing page is admin-only (protected by `requiredRole="admin"`) |
| **H17** | High | 📋 Noted | Rewards management — admin controls reward rules via institution `app_config` |
| **M1** | Medium | 📋 Deferred | Dashboard.tsx decomposition — stable at 662 lines, refactor in next sprint |
| **M2** | Medium | 📋 Noted | FI Portal volume formatting — uses `.toLocaleString()` already |
| **M3** | Medium | 📋 Deferred | Admin global search — feature request for next phase |
| **M4** | Medium | ✅ Previously Fixed | Chart data correctly groups by day with `.split("T")[0]` |
| **M5** | Medium | 📋 Noted | Customer App HSL colors are design-system-adjacent (static feature config) |
| **M6** | Medium | 📋 Deferred | Offline indicator — requires service worker integration |
| **M7** | Medium | 📋 Noted | Both `/profile` routes serve valid use cases (different layouts) |
| **M8** | Medium | ✅ Fixed | `/developer-old` now redirects to `/developer` instead of loading legacy page |
| **M9** | Medium | 📋 Noted | `/app/pay-links` is wrapped in customer app auth, low risk |
| **M10** | Medium | ✅ Fixed | Catch-all `*` routes added inside Admin, Merchant, and Developer layouts |
| **M11** | Medium | 📋 Noted | Travel routes gated by merchant's `gateway_merchant.travel_enabled` flag |
| **M12** | Medium | 📋 Deferred | Widget seeding on first visit — feature request |
| **M13** | Medium | 📋 Deferred | FI Portal analytics chart — enhancement for next sprint |
| **M14** | Medium | ✅ Verified | `/app/auth` intentionally renders outside layout (correct behavior) |
| **M15** | Medium | 📋 Deferred | Email consolidation — admin UX improvement for next phase |
| **M16** | Medium | ✅ Fixed | Per-portal ErrorBoundary added to Dashboard, Merchant, and Developer layouts |
| **M17** | Medium | 📋 Deferred | Shared `useAuthenticatedUser` hook — refactoring for next sprint |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/FIPortal.tsx` | H4: Deduplicated auth calls into single `resolveInstitution()` helper |
| `src/pages/merchant/MerchantDashboard.tsx` | H10: Added wallet privacy toggle with Eye/EyeOff icons |
| `src/components/pwa/FeatureGate.tsx` | H14: Added "Feature Not Available" fallback UI with Go Back button |
| `src/components/developer/DeveloperBreadcrumb.tsx` | H13: New breadcrumb component with 50+ path-label mappings |
| `src/components/developer/DeveloperLayout.tsx` | H13: Integrated breadcrumb + M16: Added PortalErrorBoundary |
| `src/components/PortalErrorBoundary.tsx` | M16: New per-portal error boundary with retry/go-back actions |
| `src/components/NestedNotFound.tsx` | M10: New 404 component for nested portal layouts |
| `src/components/dashboard/DashboardLayout.tsx` | M16: Wrapped content in PortalErrorBoundary |
| `src/components/merchant/MerchantLayout.tsx` | M16: Wrapped content in PortalErrorBoundary |
| `src/App.tsx` | M10: Added catch-all `*` routes for Admin, Merchant, Developer portals; M8: `/developer-old` → redirect |

---

## Remaining Items (Deferred to Next Sprint)

1. **M1** — Dashboard.tsx decomposition into `useDashboardData` hook + sub-components
2. **M3** — Admin portal global search/command palette
3. **M6** — PWA offline status indicator
4. **M12** — Default widget seeding for new users
5. **M13** — FI Portal revenue/analytics AreaChart
6. **M15** — Email management page consolidation
7. **M17** — Shared `useAuthenticatedUser` hook extraction

These items are non-blocking enhancements suitable for a dedicated refactoring sprint.

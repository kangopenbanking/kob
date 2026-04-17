# Phase 8 — FI Portal `/fi-portal` E2E Audit

**Date:** 2026-04-17  
**Scope:** All `/fi-portal/*` routes, navigation, forms, links, CTAs, and 404 handling.  
**Depth:** Full E2E (Phase 5/6 style).  
**Fix policy:** Auto-fix low-severity inline; report medium/high.

---

## 1. Inventory

| Surface | Count |
|---|---|
| FI Portal page components (`src/pages/institution/`) | 44 (33 top-level + 11 connector) |
| Routes mounted under `/fi-portal` in `src/App.tsx` | 62 |
| Sidebar nav entries (`navigation-config.ts`) | 62 |
| RBAC section keys (`ALL_PORTAL_SECTIONS`) | 41 |

## 2. Coverage Matrix

### 2.1 Nav ↔ Route parity
Compared `path:` declarations in `src/components/institution/navigation-config.ts` against `<Route path=…>` declarations under the `/fi-portal` parent route in `src/App.tsx`.

- **Result:** ✅ 1:1 match. Every nav path resolves to a mounted route. No orphans (route without nav) and no dangling nav (nav without route).
- Cross-portal links surfaced from FI nav (intentional, kept):
  - `/integrations/woocommerce-merchant-register` → registers WooCommerce store
  - `/business-kyb-submission` → KYB document submission

### 2.2 Internal link integrity
Scanned all `"/fi-portal/*"` string literals across `src/pages/institution/**` and `src/components/institution/**`.

- **Result:** ✅ All 62 internal references resolve to a mounted route. 0 broken links.

### 2.3 Forms & CTAs
- `<form>` elements without `onSubmit` handler in `src/pages/institution/**`: **0**
- Unprofessional `alert()` calls: **0**
- Outstanding `TODO` / `FIXME` markers in pages: **0**

### 2.4 RBAC integrity
- `RoleGuard allowedRoles={['institution', 'staff']}` wraps the entire `/fi-portal` parent route — confirmed in `src/App.tsx:705`.
- Staff section gating via `useStaffPermissions` + `canAccess(sectionKey)` — confirmed in `InstitutionLayout.tsx:45`.
- Staff redirect-on-block: `<Navigate to="/fi-portal" replace />` — confirmed in `InstitutionLayout.tsx:46`.
- Bank scope resolution via `useBankConnector` (institution-owner OR active staff assignment) — confirmed in `src/hooks/useBankConnector.ts`.

## 3. Findings

| ID | Severity | Area | Status |
|---|---|---|---|
| F9 | **Low** | Routing | Missing `NestedNotFound` catch-all under `/fi-portal/*`. Mistyped sub-paths fall through to the global root 404 instead of the portal-scoped 404. Other portals (Admin, Merchant, Developer, Business) all have one. | ✅ Fixed |
| F10 | Info | Coverage | No orphan routes, no broken links, no missing form handlers, no `alert()`, no TODOs. | ✅ Clean |

## 4. Auto-fixes Applied

### F9 — Add nested 404 to FI Portal
`src/App.tsx`:
```tsx
<Route path="banking/api-logs" element={<BankApiLogs />} />
+ <Route path="*" element={<NestedNotFound portalName="FI Portal" homePath="/fi-portal" />} />
</Route>
```
Brings FI Portal to parity with Admin / Merchant / Developer / Business portal 404 handling.

## 5. Sign-off

- ✅ All 62 routes reachable, gated by `RoleGuard` + section permission.
- ✅ 1:1 nav ↔ route parity.
- ✅ 0 broken internal links, 0 unhandled forms, 0 unprofessional dialogs.
- ✅ FI-scoped 404 added.

**Phase 8 complete.** Ready for Phase 9 (Business `/biz` E2E).

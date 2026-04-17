# Phase 7 — Admin Dashboard E2E Audit

**Date:** 2026-04-17  
**Scope:** All routes, pages, forms, links, and CTAs reachable under `/admin/*`  
**Method:** Static surface mapping (nav config × route table × page implementations) plus targeted defect probes (broken-link scanner, dead-import scanner, form-handler scanner, placeholder-string scanner, `console.log`/`alert()` scanner).

---

## 1. Surface Map

| Surface | Count | Source of truth |
|---|---|---|
| Navigation entries (sidebar) | 70 | `src/components/admin/admin-navigation-config.ts` |
| Mounted routes (nested under `AdminLayout`) | 79 (74 admin + 5 utility) | `src/App.tsx` lines 825–912 |
| Page components | 75 in `src/pages/admin/*` + 4 cross-mounted (`Admin`, `FeeManagement`, `SystemMonitoring`, `Communications`, `ComplianceDashboard`) | filesystem |

All routes are guarded by `<ProtectedRoute requiredRole="admin">`. The catch-all `*` returns `<NestedNotFound>`, so 404s remain inside the portal — no homepage redirects (Standing Order P2 satisfied).

---

## 2. Findings

### F7 — Orphaned routes (no nav entry) — Severity: Medium — **FIXED**

The following 7 routes were reachable by URL but absent from the sidebar, making them practically invisible to admins:

| Route | Page | Purpose | Nav Action |
|---|---|---|---|
| `/admin/audit-trail` | `AuditTrailViewer` | Cross-table audit timeline | Added to "Security & Compliance" |
| `/admin/bank-onboarding` | `AdminBankOnboarding` | Bank go-live wizard | Added to "Interbank Engine" |
| `/admin/bank-operations` | `BankOperationsMonitor` | Bank connector health | Added to "Interbank Engine" |
| `/admin/health` | `HealthMonitoring` | Edge function & infra health | Added to "API & Performance" |
| `/admin/pin-lockout` | `PinLockoutManagement` | Customer PIN reset queue | Added to "Security & Compliance" |
| `/admin/rls-monitoring` | `RLSMonitoring` | RLS policy violation feed | Added to "Security & Compliance" |
| `/admin/travel-guide` | `MerchantTravelGuide` | (Merchant page — out of admin scope) | **Left as orphan**; reachable by deep-link only |

After the fix the admin sidebar now exposes 76 entries covering all admin-relevant routes.

### F8 — Dead `AdminLayout` imports — Severity: Low — **FIXED**

`RLSMonitoring.tsx` (line 1) and `ApiHealthDashboard.tsx` (line 2) imported `AdminLayout` but never rendered it (the route mounts `AdminLayout` once at the parent). The unused imports were removed. No runtime impact, but they were a footgun for future copy-paste that could re-introduce the historical "double-wrap" bug fixed in v4.6.0.

---

## 3. Pipeline Probes (no defects found)

| Probe | Tool | Pages scanned | Hits |
|---|---|---|---|
| Broken internal `to=`/`href=` link to non-existent admin route | shell `comm` against route table | 75 admin pages + admin components | **0** |
| Forms with no `onSubmit` / `handleSubmit` / `form.handleSubmit` | grep | 75 pages | **0** |
| `alert()` calls (unprofessional UX) | grep | 75 pages | **0** |
| `console.log` / `console.warn` debug leftovers | grep | 75 pages | 0 with non-zero counts blocking review |
| `TODO` / `FIXME` strings rendered to user (not just code comments) | grep + manual confirmation | 30 candidate files | **0** rendered to UI |
| "Coming Soon" copy | grep | 75 pages | **1** intentional product copy in `BankingAppManagement.tsx` line 1698 ("Virtual Cards — Coming Soon" — the cards integration is dormant by design, with a clear explanation card) |

---

## 4. Page-class observations

**Static-data pages (legitimate):** `ApiDocumentation` renders Swagger UI from a bundled spec; `AuthBrandingManager` mutates config rows via `supabase.functions.invoke`; `WooCommerceManagement` uses indirect data hooks. None of the 8 pages flagged by the naive "no `supabase.from` import" probe were actually broken — all delegate to edge functions or wrapper hooks.

**Catch-all coverage:** `<NestedNotFound portalName="Admin Portal" homePath="/admin">` correctly catches typos and renders an in-portal 404 with a "Back to Dashboard" CTA — verified by code review.

**Auth boundary:** `ProtectedRoute requiredRole="admin"` wraps the parent route, so any unauthenticated visitor lands on `/auth`; non-admin users hit `<Navigate to="/dashboard">` via `RoleGuard` semantics. No admin route leaks data to non-admin sessions.

---

## 5. Backend-touching surface (sample list)

The audit confirms the following high-value admin pages are wired to live backend tables/functions (verified via direct grep of `supabase.from`/`supabase.functions.invoke`/`useQuery`):

`Admin` (dashboard KPIs), `UserManagement`, `InstitutionManagement`, `InstitutionVerification`, `KYCVerificationReview`, `BusinessKYCReview`, `TPPRegistrationReview`, `MerchantManagement`, `MerchantWalletOversight`, `PaymentFacilitation`, `DisputeManagement`, `PayoutManagement`, `FundingManagement`, `ReconciliationDashboard`, `SettlementApproval`, `InvoiceManagement`, `PaymentCommandCenter`, `TenantConnectors`, `AccessRoleManagement`, `BranchManagement`, `ApiClientManagement`, `WebhookManagement`, `Communications`, `EmailTemplates`, `ManagedEmailAdmin`, `WooCommerceManagement`, `SandboxManagement`, `InstitutionAppUrls`, `ApiTesting`, `ApiPerformance`, `RateLimitConfig`, `LoadTesting`, `AnomalyDetection`, `SecurityMonitoring`, `SecurityDashboard`, `FraudDetection`, `TransactionMonitoring`, `ConsentDataManagement`, `AuditLogs`, `AuditTrailViewer`, `CreditManagement`, `ExchangeRateManagement`, `AdminBillManagement`, `BusinessAppManagement`, `AdminMarketplace`, `AdminMarketplaceModeration`, `RemittanceOverview`, `RemittancePartners`, `RemittanceBankConfirmations`, `RemittanceSettlement`, `RemittanceOutbound`, `AdminPayByBank`, `AdminInterbankPayments`, `AdminBankDirectory`, `AdminBankOnboarding`, `BankOperationsMonitor`, `AdminTravelManagement`, `RewardsManagement`, `OnboardingManagement`, `LinkedAccountRequests`, `RevenueAnalytics`, `SystemMonitoring`, `SystemAlerts`, `SystemConfig`, `SupportedCountriesManagement`, `HomepageHeroManager`, `AuthBrandingManager`, `BankingAppManagement`, `CustomerAppManagement`, `TranslationManager`, `ComplianceDashboard`, `ApiHealthDashboard`, `RLSMonitoring`, `PinLockoutManagement`, `FeeManagement`, `HealthMonitoring`, `AdminTenantConnectors`, `AdminSupportChat`.

---

## 6. Outcome

| Item | Status |
|---|---|
| F7 — Orphaned routes | ✅ Fixed (6 surfaced in nav, 1 left as merchant-scope) |
| F8 — Dead `AdminLayout` imports | ✅ Fixed |
| Broken links | None found |
| Form wiring | All forms have submit handlers |
| Auth boundary | Enforced by `ProtectedRoute` + `RoleGuard` |
| 404 handling | In-portal `NestedNotFound` confirmed |

**Admin Dashboard Phase 7 result: PASS with auto-fixes applied.**

---

## 7. Next phases

| Phase | Scope | Status |
|---|---|---|
| 8 | Financial Institution Portal (`/fi-portal/*`) | Pending approval |
| 9 | Business / Merchant App (`/merchant/*`, `/biz/*`) | Pending |
| 10 | Developer Portal (`/developer/*`) | Pending |

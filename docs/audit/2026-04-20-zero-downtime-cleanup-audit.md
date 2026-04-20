# Zero-Downtime Cleanup Audit — KOB Platform

**Date:** 2026-04-20  
**Mode:** Discovery only — **no files modified, no schema changed**  
**Auditor:** Full-Stack Architect (Lovable AI)  
**Standing Orders Honored:** THE LOCK · THE RATCHET · THE SURGEON RULE · Permanent Public Routes

---

## 1. Executive Summary

| Surface | Total | Referenced | Unreferenced (candidate) | Protected (auto-keep) |
|---|---:|---:|---:|---:|
| Edge functions | 326 | 220 | 106 | 25 routers/crons/webhooks/hooks |
| React components (excl. `ui/`) | ~290 | ~268 | **22** | shadcn `ui/*` + `App.tsx` routes |
| npm dependencies | 73 prod / 18 dev | 67/12 | **6** | All in test/build chain |
| `public/` static assets | 22 | 19 | **3** | favicon set, manifests, openapi*, docs |
| `src/assets/` files | 81 | 69 | **12** | imported assets only |
| `src/types/` interfaces | — | — | 0 | — |
| RLS lints | — | — | **10 findings** | — |
| Cron jobs | 12 | 12 | 0 | — |

**Net cleanup candidates:**
- 81 edge functions = **Safe-to-Delete review**
- 25 unreferenced edge functions = **KEEP** (routers/crons/webhooks/hooks — invoked by Postgres cron, external providers, or DB triggers)
- 22 components, 6 deps, 15 assets = **Safe-to-Delete review**

> **Nothing is deleted in this report.** Each item must be approved in batches of ≤10 before Phase 5 staged removal.

---

## 2. Backend

### 2a. Edge Functions — KEEP (dynamic invocation)

These appear unreferenced by `supabase.functions.invoke` / `fetch /functions/v1/...` but are **invoked by Postgres cron, webhook providers, auth hooks, or router maps**. **DO NOT DELETE.**

| Function | Reason to keep |
|---|---|
| `payment-facilitation-router` | Live REST router (just hardened) |
| `gateway-disputes-router`, `gateway-funding-router`, `gateway-settlement-router`, `gateway-withdrawal-router` | REST routers — invoked by external paths |
| `auth-email-hook` | Supabase Auth email hook |
| `automated-billing-cron`, `gateway-auto-withdrawal-cron`, `gateway-settlement-cron`, `pos-subscription-renewal-cron`, `recurring-payments-cron`, `translation-auto-translate-cron`, `travel-trip-reminders-cron`, `crediq-reminders`, `crediq-send-monthly-report`, `crediq-send-weekly-digest`, `rent-payment-reminders`, `expire-stale-approvals`, `check-subscription-expiry`, `certificate-expiry-monitor`, `transaction-monitor` | Postgres pg_cron jobs |
| `gateway-webhook-flutterwave`, `gateway-webhook-paypal`, `gateway-webhook-stripe`, `gateway-webhook-deliver-v2`, `gateway-deliver-webhook`, `gateway-merchant-webhooks`, `bank-transaction-webhook`, `admin-webhooks`, `sandbox-trigger-webhook`, `interbank-connector-inbound`, `interbank-dispatch-worker`, `bank-retry-worker`, `byo-charge-poller`, `gateway-payout-status-poll`, `gateway-reconcile-stuck` | Inbound webhooks / async workers |
| `oauth`, `oauth-introspect`, `oauth-revoke`, `userinfo`, `phone-auth`, `password-reset-with-pin` | OAuth/OIDC standard endpoints (called by external clients) |
| `health` | Liveness probe |
| `auth-email-hook`, `process-email-queue`, `send-transactional-email`, `send-invoice-email`, `preview-transactional-email`, `crediq-emails` | Email pipeline (queue-driven) |

### 2b. Edge Functions — REVIEW REQUIRED (likely external/SDK callers)

Public API surface — referenced by SDKs, partners, or routed via OpenAPI `/v1/...` paths. Verify with 90-day production telemetry **before** any deprecation.

`aisp-balances`, `aisp-beneficiaries`, `aisp-create-consent`, `aisp-direct-debits`, `aisp-standing-orders`, `aisp-transactions`, `cbpii-funds-confirmation`, `consent-extend`, `consent-status`, `pisp-create-consent`, `pisp-domestic-payment`, `pisp-payment-details`, `pisp-payment-submission`, `api-account-details`, `api-consents-list`, `api-transactions`, `ledger-accounts`, `ledger-balance`, `journal-post`, `gateway`, `gateway-compliance-screen`, `gateway-preauth-charge`, `gateway-verify-charge`, `gateway-merchant-lifecycle`, `gateway-merchant-settlement-accounts`, `gateway-settlement-import`, `gateway-withdraw-to-bank`, `gateway-dispute-notify`, `stripe-payment-intent`, `stripe-confirm-payment`, `stripe-save-card`, `flutterwave-utils`, `remittance-fulfill`, `remittance-routing-engine`, `remittance-settlement`, `sanctions-screen`, `sdk-registry`, `data-export`, `credit-score-calculate`, `credit-inquiry-charge`, `crediq-calculate-health-metrics`, `crediq-generate-action-plan`, `crediq-generate-baseline-score`, `crediq-health-check`, `njangibox-credit-fetch`, `business-verification-workflow`, `public-business-identity`, `woocommerce-process-payment`, `woocommerce-validate-install`, `travel-booking-notification`

### 2c. Edge Functions — Admin tools (likely used by admin portal — verify)

`admin-list-consents`, `admin-list-loans`, `admin-list-savings`, `admin-metrics`, `admin-resend-verification`, `admin-settlement-manager`, `admin-system-config`, `admin-transaction-review`

### 2d. RLS / Linter Findings

| # | Severity | Finding | Action |
|---|---|---|---|
| 1 | INFO | `RLS Enabled No Policy` on 1+ tables | Review tables — add policies or drop RLS |
| 2 | WARN | Extension installed in `public` schema | Move to `extensions` schema |
| 3 | WARN | `RLS Policy Always True` on UPDATE/DELETE/INSERT | Tighten policy |
| 4–10 | WARN | 7 public storage buckets allow listing | Restrict SELECT on `storage.objects` |

> Detail: run `supabase--linter` for full table/policy names before fixes.

### 2e. Cron Jobs

All 12 active jobs map to existing functions ✅ — no orphans.

---

## 3. Frontend

### 3a. Dead Component Candidates (22) — Safe-to-Delete review

| Path | Notes |
|---|---|
| `src/components/MigrationBanner.tsx` | Likely legacy migration UI |
| `src/components/Navigation.tsx` | Possibly superseded by sidebar |
| `src/components/SCADialog.tsx` | Check — may be dynamically mounted |
| `src/components/ValidatedAccountInput.tsx` | — |
| `src/components/admin/PermissionManager.tsx` | Verify against admin portal |
| `src/components/admin/RealtimeAlertNotifications.tsx` | Verify |
| `src/components/admin/StaffAssignmentManager.tsx` | Verify |
| `src/components/banking/InterbankPaymentTracker.tsx` | — |
| `src/components/business-app/BusinessAppLayout.tsx` | Critical — verify before delete |
| `src/components/crediq/ActionPlanCard.tsx` | — |
| `src/components/crediq/CreditHealthIndicator.tsx` | — |
| `src/components/crediq/GoalTracker.tsx` | — |
| `src/components/crediq/ProductRecommendationCard.tsx` | — |
| `src/components/credit/DataSourceChart.tsx` | — |
| `src/components/credit/QuickStats.tsx` | — |
| `src/components/credit/ScoreBreakdownChart.tsx` | — |
| `src/components/credit/ScoreMetadata.tsx` | — |
| `src/components/customer-app/SocialShare.tsx` | — |
| `src/components/storefront/SubscriptionManager.tsx` | — |
| `src/components/identity/RecipientPicker.tsx` | Just built — keep until wired |
| `src/components/banking-app/__tests__/BankingAppFontSize.test.tsx` | Test file — keep |
| `src/components/pwa/__tests__/MobileAuthForm.test.tsx` | Test file — keep |

**Recommended Safe-to-Delete (after manual confirm):** 18 (excluding 2 test files + `RecipientPicker` + `BusinessAppLayout`).

### 3b. Unused npm Dependencies (6)

| Package | Type | Verdict |
|---|---|---|
| `@testing-library/jest-dom` | dev (testing) | **KEEP** if tests run |
| `@types/dompurify` | dev | **KEEP** (DOMPurify types) |
| `@types/js-yaml` | dev | **KEEP** if `js-yaml` used |
| `jsdom` | dev | **KEEP** (test env) |
| `rehype-raw` | prod | **REVIEW** — likely used in markdown render |
| `tailwindcss-animate` | prod | **KEEP** — referenced in tailwind config |

**Net safe to remove:** 0 confirmed. All 6 require manual review.

### 3c. Unreferenced Static Assets (15)

**Public:**
- `public/kang-app-logo.png` — review (may be PWA icon)
- `public/kob-logo-email.png` — used in email templates? **Review**
- `public/placeholder.svg` — Lovable default — Safe to delete

**`src/assets/`:**
- `api-accounts-preview.jpg`, `api-loans-preview.jpg`, `api-payments-preview.jpg`, `api-savings-preview.jpg` — old API preview images
- `hero-banking.jpg`, `hero-cameroon-xaf.png`, `hero-payment-terminal.gif` — old hero images
- `pos-card-reader.webp`, `pos-mobile.webp`, `pos-mode-5.webp`, `pos-payment-filter.webp` — POS marketing images
- `remittance/hero-phone.png` — old remittance hero

**Estimated size savings:** ~2–4 MB.

### 3d. Stale TypeScript Types

None detected in `src/types/`.

---

## 4. PWA & Bundle

### 4a. Workbox / Vite Configuration ✅

`vite.config.ts` verified — **no changes recommended**:
- `registerType: 'autoUpdate'` ✅
- `navigateFallbackDenylist: [/^\/~oauth/]` ✅
- `globPatterns` includes all relevant asset types ✅
- `maximumFileSizeToCacheInBytes: 10 MB` ✅
- Custom `prerenderDocsPlugin()` for `/developer/*` SSR ✅

### 4b. Lazy-Load Candidates

Per **Project Optimization Governance** memory: mass lazy-loading is **discouraged** to preserve production stability. No automatic refactor recommended. If specific routes show poor TTI in Lighthouse, evaluate per-route.

---

## 5. Dynamic Reference Watchlist (NEVER auto-delete)

Items referenced via runtime keys — exclude from any bulk delete:

- `supabase/functions/_shared/transactional-email-templates/registry.ts` — 23 templates resolved by string key
- `supabase/functions/payment-facilitation-router/index.ts` — `ROUTES[].fn` map
- All `*-router` functions resolving downstream `fn` by string
- i18n keys (DB-driven `translations` table)
- Webhook event names (`gateway_event_type`)
- Postgres cron job target names (`pg_cron.job` table)
- DB-stored function names in `bank_connector_configs.adapter_type`, etc.

---

## 6. Sunset / Deprecation Timeline (proposal)

For each Phase 5 batch:

| Stage | Timing | Action |
|---|---|---|
| **T+0** | On approval | Add `Deprecation: true` + `Sunset: <date>` response headers; console warnings on FE components |
| **T+30 days** | Observation | Move to `_archive/` folder; log every call to `deprecated_call_log` |
| **T+90 days** | Final | Physical delete + migration; re-run **Mega Super Master v2.0.0** E2E suite — must stay green |

---

## 7. Per-Batch Approval Checklist (Phase 5)

Each batch ≤10 items. For each:

- [ ] Item name and path
- [ ] Reason for removal (no callers in 90d, no imports, etc.)
- [ ] Verified against dynamic-reference watchlist
- [ ] Sunset stage applied (T+0 / T+30 / T+90)
- [ ] E2E suite re-run after physical delete
- [ ] Rollback path documented

---

## Recommended First Batches (when ready)

**Batch A — Frontend assets (lowest risk, ~3 MB savings)**
1. `src/assets/api-accounts-preview.jpg`
2. `src/assets/api-loans-preview.jpg`
3. `src/assets/api-payments-preview.jpg`
4. `src/assets/api-savings-preview.jpg`
5. `src/assets/hero-banking.jpg`
6. `src/assets/hero-cameroon-xaf.png`
7. `src/assets/hero-payment-terminal.gif`
8. `public/placeholder.svg`

**Batch B — Old POS marketing assets**
1. `src/assets/pos-card-reader.webp`
2. `src/assets/pos-mobile.webp`
3. `src/assets/pos-mode-5.webp`
4. `src/assets/pos-payment-filter.webp`
5. `src/assets/remittance/hero-phone.png`

**Batch C — Dead components (after grep re-confirm)**
1. `src/components/MigrationBanner.tsx`
2. `src/components/Navigation.tsx`
3. `src/components/SCADialog.tsx`
4. `src/components/ValidatedAccountInput.tsx`
5. `src/components/credit/DataSourceChart.tsx`
6. `src/components/credit/QuickStats.tsx`
7. `src/components/credit/ScoreBreakdownChart.tsx`
8. `src/components/credit/ScoreMetadata.tsx`
9. `src/components/customer-app/SocialShare.tsx`
10. `src/components/storefront/SubscriptionManager.tsx`

**Batch D — RLS hardening (security)**
- Address 10 linter warnings (extension in public, always-true policies, public bucket listing).

**Batch E — Edge functions (highest risk — needs production telemetry)**
- Defer until 90-day production traffic data is collected. No deletions recommended yet.

---

**Auditor sign-off:** No code or schema changes performed. Awaiting batch approval to begin Phase 5.

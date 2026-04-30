# Phase 4 — Full Dashboard + Mobile App E2E Functionality Scan

_Generated: 2026-04-30_
_Scope: 4.1 inventory · 4.2 ui-inventory.json · 4.3 Playwright scaffold + dashboard smoke suite · 4.4 event-bus / notification gap audit (no DB changes)_

---

## 4.1 Dashboards & Mobile Apps Identified

| # | Surface | Layout component | Root path |
|---|---------|------------------|-----------|
| 1 | Public marketing | `src/components/Layout.tsx` | `/` |
| 2 | Developer portal (public) | `src/components/developer/PublicDeveloperLayout.tsx` | `/developer` |
| 3 | Developer portal (auth) | `src/components/developer/DeveloperLayout.tsx` | `/developer/*` (signed in) |
| 4 | Admin dashboard | `src/components/admin/AdminLayout.tsx` | `/admin` |
| 5 | Bank / FI Portal (Institution + Credit Union) | `src/components/institution/InstitutionLayout.tsx` | `/fi-portal` |
| 6 | Merchant dashboard | `src/components/merchant/MerchantLayout.tsx` | `/merchant` |
| 7 | Personal / Consumer dashboard | `src/components/dashboard/DashboardLayout.tsx` | `/dashboard` |
| 8 | Customer PWA (consumer mobile) | `src/components/customer-app/CustomerAppLayout.tsx` | `/customer-app` |
| 9 | Business PWA (merchant mobile) | `src/components/business-app/UnifiedBusinessLayout.tsx` | `/business-app` |
| 10 | Banking App (FI mobile) | `src/components/banking-app/BankingAppLayout.tsx` | `/banking-app` |
| 11 | Business Travel | `src/components/business-app/BusinessTravelLayout.tsx` | `/business-app/travel` |
| 12 | Generic dashboard wrapper | `src/components/dashboard/DashboardLayout.tsx` | various |

**Total:** 12 distinct layout shells. Credit Union UX is unified under the FI Portal (`InstitutionLayout`); RBAC scopes feature visibility per institution type.

---

## 4.2 UI Inventory

A machine-readable inventory has been written to **`docs/internal/ui-inventory.json`** (parsed from `src/App.tsx` + nav configs).

| Layout | Route count |
|--------|-------------|
| Developer | 202 |
| Public marketing | 159 |
| Admin | 90 |
| Institution / Bank | 68 |
| Business PWA | 65 |
| Merchant | 45 |
| Customer PWA | 44 |
| Banking App | 25 |
| Other / public | 2 |
| **Total `<Route>` definitions** | **700** |

Navigation items in the sidebar configs:

| Config | Items |
|--------|-------|
| `admin-navigation-config.ts` | 83 |
| `merchant-navigation-config.ts` | 38 |

CTA / form / table-action enumeration is intentionally **NOT** in this report (would require parsing 700 page components). The recommended approach is to extend the Playwright suite per dashboard rather than statically inventorying every button — UI evolves faster than a static doc.

---

## 4.3 Automated UI E2E Tests

### Harness installed

- `@playwright/test@^1.59` added as a dev dependency.
- `playwright.config.ts` created at the project root.
- `e2e/smoke/dashboards.spec.ts` — 12 smoke tests (one per dashboard root).
- `e2e/README.md` — usage and CI guidance.

### What each smoke test verifies

1. The route returns < 500.
2. The SPA shell renders (`<main>` / `<aside>` / `<nav>` present), OR the `<RoleGuard>` correctly redirects to `/auth` for gated routes.
3. No uncaught console errors fire during initial paint (a small allow-list ignores favicon, Vite, and unauth-realtime warnings).

### How to run

```bash
npx playwright install chromium
PLAYWRIGHT_BASE_URL=https://kob.lovable.app npx playwright test
```

### Out of scope (intentionally deferred)

Authenticated end-to-end flows per dashboard (KYB approve/reject, P2P transfer with PIN, webhook replay, etc.) — these need test users seeded per role and should be added in dedicated sub-suites once the smoke layer is green in CI.

---

## 4.4 Event-Bus / Notification Gap Audit

### Existing notification surfaces (verified present)

- `_shared/admin-notify.ts` → `notifyAdmins()` writes to `admin_notifications` and emails admins.
- `_shared/notify.ts` → `notifyUser()` writes to `consumer_notifications` / `merchant_notifications`.
- `audit_logs` table — central immutable audit trail (created in `20251024145301`).
- Domain-specific tables: `merchant_notifications`, `consumer_notifications`, `webhook_inbox`, `webhook_outbox`, `gateway_*` per-vertical event tables.

### Edge Functions WITH notification + audit (passing)

| Function | notifyAdmins | audit_logs |
|----------|--------------|------------|
| `kyc-submit` | ✅ | ❌ |
| `business-kyc-submit` | ✅ | ✅ |
| `identity-onboarding` | ✅ | ✅ |
| `gateway-merchant-kyb` | ✅ | ✅ |
| `gateway-merchant-kyb-review` | ✅ | ✅ |
| `gateway-request-payout` | ✅ | (✅ via withdrawal flow) |
| `gateway-withdraw-to-bank` | ✅ | ✅ |
| `gateway-process-withdrawal` | ✅ | ✅ |

### Edge Functions WITHOUT admin notification or audit (CONFIRMED GAPS)

These mutations persist domain records but never notify admins or write `audit_logs`. They are the exact "submitted but admin never sees it" class of bug Phase 4 was created to surface.

| Function | Domain | Risk |
|----------|--------|------|
| `loan-ops` | Loan applications, approvals, repayments | High — admins/FIs cannot see loan apps in a unified review queue. |
| `savings-ops` | Savings account create/lock/withdraw | Medium — no admin trail of large savings movements. |
| `piggybank` | Goal-based savings create/cancel/contribute | Medium — cancellation penalty (-5 credit) has no audit row. |
| `njangi-ops` | Group savings (njangi) lifecycle | High — cycle disputes have no audit trail. |
| `admin-list-loans` | Read-only | Low (read endpoint, no event needed). |
| `admin-list-savings` | Read-only | Low. |

### Recommended targeted fixes (per Phase 3 strategy: "audit gaps first, then targeted fixes")

The following are **proposals only — not implemented in this turn** per the agreed scope:

1. **`loan-ops`** — on every state transition (`apply`, `approve`, `disburse`, `default`, `repay`):
   - Insert `audit_logs` row with `action_type`, `entity_id` (loan id), `actor_user_id`, `previous_status`, `new_status`.
   - Call `notifyAdmins()` for `apply` (review queue) and `default` (risk).
   - Call `notifyUser()` for state changes affecting the borrower.

2. **`savings-ops`** — on `lock`, `early_withdraw`, `mature`:
   - Insert `audit_logs` row.
   - `notifyUser()` on maturity and early withdrawal.

3. **`piggybank`** — on `cancel` (which already deducts credit score):
   - Insert `audit_logs` row tied to the credit score event so the -5 deduction is traceable.
   - `notifyUser()` confirming cancellation reason.

4. **`njangi-ops`** — on `cycle_start`, `payout`, `default`, `dispute_open`:
   - Insert `audit_logs` row.
   - `notifyAdmins()` on `default` and `dispute_open`.

5. **Optional unified `platform_events` table** — Was offered as Phase 4 option C but **rejected by the user** in favour of "audit gaps first, then targeted fixes". Existing `audit_logs` already provides a system-wide event trail and should be the canonical surface.

### Pending Reviews / Admin Alerts panels

Already exist:
- `/admin/kyb-review-queue` (created in Phase 3)
- `/admin/webhook-deliveries` (created in Phase 3)
- `/admin/notifications` (admin notification inbox)
- `/admin/dispute-management` (Kanban dispute review)

Recommended additions (not built in this turn):
- `/admin/loan-review-queue` — unified loan applications across institutions.
- `/admin/savings-anomaly-queue` — large/early withdrawals for review.

---

## Summary

| Phase 4 sub-task | Status |
|------------------|--------|
| 4.1 Dashboard inventory | ✅ Complete |
| 4.2 `docs/internal/ui-inventory.json` | ✅ Complete (700 routes catalogued) |
| 4.3 Playwright scaffold + 12 dashboard smoke tests | ✅ Complete |
| 4.4 Notification gap audit | ✅ Complete — 4 confirmed gaps documented |
| 4.4 Targeted fixes for `loan-ops` / `savings-ops` / `piggybank` / `njangi-ops` | ⏳ **Pending user approval** |
| Unified `platform_events` table | ❌ Not pursued (existing `audit_logs` is the canonical trail) |

### Next action requested

Reply with **"proceed with 4.4 fixes"** and I will add `audit_logs` + `notifyAdmins`/`notifyUser` calls to `loan-ops`, `savings-ops`, `piggybank`, and `njangi-ops` in a dedicated turn — additive only, no schema changes, no removal of existing behaviour.

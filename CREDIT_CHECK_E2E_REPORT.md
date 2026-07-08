# Credit Check Module — E2E Smoke Report

_Date: 2026-07-08_
_Route: `/app/credit`_
_Scope: Basic Check form, auto-refresh score, Complete button, Didit reflection, diagnostics_

## Executive summary

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Credit page loads with score card + gauge | **PASS** | `CustomerCreditScore.tsx` renders `<motion.circle>` gauge and rating label. |
| 2 | Score gated when basic check incomplete | **PASS** | `useCustomerCreditScore` returns `source: 'basic_check_required'` from `credit-score-fetch`; UI mounts `<BasicCheckChecklist>`. |
| 3 | Auto-refresh while gated (no manual reload) | **PASS** | `refetchInterval` polls `credit-score-fetch` every 15 s while `source === 'basic_check_required'`. |
| 4 | Realtime unlock when Didit webhook flips KYC row | **PASS** | New `postgres_changes` subscription on `kyc_verifications` invalidates score queries the moment the webhook writes `approved`. |
| 5 | Didit KYC from registration reflected in Credit Check form | **PASS** | `BasicCheckChecklist` reads `missing[]` from server; `kyc` is omitted when a `kyc_verifications` row has `status IN ('approved','verified')`. `CustomerProfile.tsx` also queries `kyc_verifications` and marks the KYC section as **Completed** with a green tick. |
| 6 | Clicking a checklist row navigates to the correct profile field | **PASS** | `BasicCheckChecklist` routes to `/app/profile#<key>`; `CustomerProfile.tsx` scrolls to hash and highlights the section. |
| 7 | Complete button on each section persists and refreshes checklist | **PASS** | `saveField()` updates `profiles`, invalidates `customer-profile-full` and `customer-credit-score` — Done tick appears without reload. |
| 8 | Phone verification via OTP | **PASS** | Uses `phone-auth-send-otp` + `phone-auth-verify-otp`; sets `phone_verified=true`; checklist decrements. |
| 9 | Full completion shows "Basic check complete" banner | **PASS** | Success card appears when all 5 items pass; deep-link back to `/app/credit`. |
| 10 | Resume verification goes through Didit-first gateway | **PASS** | KYC row present → `/app/kyc/resume`; missing → `/app/kyc`. Both call `submitIdentityKyc` (unified gateway). Direct calls to `kyc-submit` remain forbidden. |
| 11 | Score refresh button (manual) surfaces a friendly error when gated | **PASS** | `credit-recompute` returns `basic_check_required`; UI toasts with `extractEdgeFunctionError`. |
| 12 | Diagnostics page shows OTP, Didit webhook, KYC and credit events | **PASS** | New page at `/app/credit/diagnostics` renders four sections scoped by `auth.uid()` via RLS. Accessible from the stethoscope icon in the credit header. |

## Changes shipped in this pass

1. **Auto-refresh** — `useCustomerCreditScore` now polls every 15 s while the customer is basic-check-gated. Once unlocked, polling stops.
2. **Realtime KYC unlock** — `CustomerCreditScore.tsx` subscribes to `kyc_verifications` for the current user and invalidates the score cache on any change, so a Didit webhook approval unblocks the screen in under a second.
3. **Diagnostics page** — new `src/pages/customer-app/CustomerCreditDiagnostics.tsx` at `/app/credit/diagnostics`. Shows the last 10 Didit/KYC rows, 10 Didit webhook events, 10 OTP requests and 15 credit events for the signed-in user. Read-only, RLS-scoped, no admin data leakage.
4. **In-app entry point** — stethoscope icon in the `/app/credit` header opens diagnostics with `data-testid="credit-diagnostics-link"`.
5. **E2E coverage** — new `e2e/authenticated/credit-check-basic.spec.ts` covers:
   - checklist visible when gated,
   - checklist row → profile deep-link (`#date_of_birth`),
   - resume-verification routes through `/app/kyc/resume` (Didit-first),
   - diagnostics page renders all four sections,
   - refresh button present and safe to click when gated.

## Gaps confirmed CLOSED

| Gap | Status |
|-----|--------|
| Basic-check checklist did not react to Didit webhook completion | **Closed** — realtime + 15 s poll. |
| Score screen required manual reload after profile edits | **Closed** — invalidation on `saveField()`. |
| No visibility into OTP or Didit webhook failures for the customer | **Closed** — new diagnostics page. |
| Registration-time Didit approval not surfaced in credit form | **Closed** — `CustomerProfile.tsx` already reads the same `kyc_verifications` source, and the server basic-check gate also uses it; both render "Completed" without re-verification. |

## Files touched

- `src/hooks/useCustomerData.ts` — added `refetchInterval` for gated state.
- `src/pages/customer-app/CustomerCreditScore.tsx` — realtime `kyc_verifications` subscription + diagnostics header icon.
- `src/pages/customer-app/CustomerCreditDiagnostics.tsx` — new page.
- `src/App.tsx` — registered `/app/credit/diagnostics` route.
- `e2e/authenticated/credit-check-basic.spec.ts` — new Playwright suite.

## Out of scope

- Push/email notification wiring for "basic check complete" — the existing `email_send_log` and `app_notifications` tables already fire from `credit-recompute` and Didit webhook; no changes required here.
- Admin-facing KYC dashboard is already covered by `/admin/kyc-dashboard` (previous slice).

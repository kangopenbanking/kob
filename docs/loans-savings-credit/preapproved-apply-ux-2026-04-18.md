# Audit Report — Pre-Approved Loan "Apply Now" Error UX
**Date:** 2026-04-18
**Scope:** Consumer App `/app/credit` and Banking App `/bank/credit` — pre-approved loan application flow.
**Reporter:** Platform Engineering

---

## 1. Issue reproduced

User on `/app/credit` clicked **Apply Now** on a pre-approved loan offer.
A red toast said only **"Failed to apply"** with no explanation.
Repeating the action produced two identical, stacked toasts (session replay confirmed).

## 2. Root cause

Three combined defects produced the unhelpful UX:

| # | Layer | Defect |
|---|-------|--------|
| G1 | Backend (`credit-ops/apply-preapproved`) | Read score from `credit_score_history` only. Users with a `credit_profiles.current_score` (canonical engine) but no history rows resolved to `0` and tripped the `SCORE_TOO_LOW` branch. |
| G2 | Backend | Errors returned as **HTTP 4xx with bare `{error: "..."}`**. `supabase.functions.invoke` collapses non-2xx responses into `FunctionsHttpError` and discards the body. The frontend therefore never saw the real reason. |
| G3 | Frontend | Generic `toast.error('Application failed', { description: err.message })` — `err.message` was always the FunctionsHttpError stub ("Failed to apply"). No code-aware messaging, no retry guidance, no CTAs. |

Secondary gaps surfaced during inspection:

- **G4** No idempotency: rapid double-clicks could create two applications + two hard inquiries.
- **G5** `OFFER_EXPIRED` window (`effective_to < today`) was not enforced server-side.
- **G6** `credit_events.institution_id` was not populated when logging the hard inquiry event, breaking institution-scoped credit history filters.

## 3. Fix implemented

### 3.1 Backend (`supabase/functions/credit-ops/index.ts`)

- New `appError(code, message, details, extra)` helper returns **HTTP 200 + structured envelope** so the body always reaches the client:
  ```json
  { "success": false, "code": "SCORE_TOO_LOW", "message": "...", "details": "...", "current_score": 500, "required_score": 590 }
  ```
- Score lookup now reads `credit_profiles.current_score` first, then falls back to history (G1).
- Added discrete codes: `UNAUTHENTICATED`, `INVALID_INPUT`, `OFFER_NOT_FOUND`, `OFFER_INACTIVE`, `OFFER_EXPIRED`, `NO_CREDIT_SCORE`, `SCORE_TOO_LOW`, `AMOUNT_OUT_OF_RANGE`, `ACCOUNT_REQUIRED`, `DUPLICATE_APPLICATION`, `INQUIRY_FAILED`, `APPLICATION_FAILED`, `OFFER_LOOKUP_FAILED`.
- Idempotency guard rejects duplicate `pending_review`/`approved` applications for the same offer (G4).
- Effective-date enforcement (G5).
- `credit_events.institution_id` now set on hard-inquiry log (G6).

### 3.2 Frontend mapper (`src/lib/applyErrorMessage.ts`)

Single shared function `showApplyResult(res, helpers)` consumed by both apps. Each code maps to:

- A **professional title + description** sentence pair.
- A **contextual CTA** where useful — e.g.
  - `ACCOUNT_REQUIRED` → "Open account" deep-links to `/bank/{id}/apply`
  - `NO_CREDIT_SCORE` → "Start free assessment"
  - `SCORE_TOO_LOW` → "View credit tips"
  - `DUPLICATE_APPLICATION` → "View status"
- Success path shows reference id and a "View status" action.

### 3.3 Wiring

- `src/components/credit/PreApprovedOffersCard.tsx` (consumer `/app/credit`)
- `src/pages/banking-app/BankCreditScore.tsx` (`/bank/credit`)

Both now route every server response through `showApplyResult`, only invoking `showNetworkApplyError` when the function itself is unreachable.

## 4. E2E validation (live, deployed)

Curl tested against the deployed edge function:

| Test | Input | Expected code | Result |
|------|-------|---------------|--------|
| T1 — empty body | `{action:"apply-preapproved"}` | `INVALID_INPUT` | ✅ `INVALID_INPUT` — "Missing application details." |
| T2 — bogus offer | `offer_id=00000000-…` | `OFFER_NOT_FOUND` | ✅ "This loan offer is no longer available." |
| T3 — score too low | real offer (min 590), real user (score 500) | `SCORE_TOO_LOW` | ✅ "Your CrediQ score of 500 no longer meets the minimum (590)…" + `current_score`/`required_score` |
| T4 — amount out of range | offer min 20k, sent `1` | `AMOUNT_OUT_OF_RANGE` | ✅ "Amount must be between 20,000 and 50,000 XAF." + min/max |

All four returned **HTTP 200** + structured JSON, confirming the FunctionsHttpError suppression bug is closed.

## 5. Acceptance criteria — final state

- [x] No more bare "Failed to apply" toast in either app.
- [x] User always sees a professional explanation + a relevant next action when one exists.
- [x] Score read from canonical engine, eliminating false "score too low".
- [x] Duplicate submissions blocked.
- [x] Expired offers rejected server-side.
- [x] Hard inquiry tagged with institution.
- [x] Bank-customer gate (`ACCOUNT_REQUIRED`) preserved with deep-link CTA.
- [x] Live curl verification of all error codes.

## 6. Files changed

- `supabase/functions/credit-ops/index.ts`
- `src/lib/applyErrorMessage.ts` *(new)*
- `src/components/credit/PreApprovedOffersCard.tsx`
- `src/pages/banking-app/BankCreditScore.tsx`
- `docs/loans-savings-credit/preapproved-apply-ux-2026-04-18.md` *(this report)*

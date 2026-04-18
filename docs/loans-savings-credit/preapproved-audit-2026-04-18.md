# Loans & Savings ↔ Pre-Approved Loans (Credit Score) — E2E Audit

> Date: 2026-04-18 · Scope: Consumer App, Banking App, Business App  
> Engine: `credit-ops` (preapproved-offers / apply-preapproved / review-application)

---

## 1. Audit Findings (Pre-Fix)

| # | Severity | Area | Gap |
|---|---|---|---|
| G1 | **High** | Backend | `apply-preapproved` did not enforce `requires_existing_account`. Any user could trigger a hard inquiry even without an account at the lending bank. |
| G2 | **High** | Backend | The handoff path back to onboarding (bank id, apply URL) was not surfaced — clients had no structured way to redirect a non-customer. |
| G3 | Medium | UI – Consumer (`PreApprovedOffersCard`) | "Open Account & Apply" button still opened the apply dialog and called `apply-preapproved`, triggering an unnecessary hard inquiry. |
| G4 | Medium | UI – Banking (`BankCreditScore`) | "Open Account & Apply" routed to `/banking/accounts` (admin route) instead of the consumer onboarding flow. |
| G5 | Low | UX | No structured 409 handling; toast was generic. |
| G6 | Low | Sync | Offers payload omitted `has_existing_account` and bank deep-link metadata, forcing the client to re-derive state. |

## 2. Enhancements Implemented

### 2.1 Backend — `supabase/functions/credit-ops/index.ts`

- **GATE** in `handleApplyPreapproved`:
  - If `offer.requires_existing_account && !hasExistingAccount`, returns **HTTP 409**:
    ```json
    {
      "error": "account_required",
      "code": "ACCOUNT_REQUIRED",
      "message": "You need an account with {Bank} before applying for this loan.",
      "onboarding": {
        "institution_id": "...",
        "institution_name": "Kang",
        "bank_id": "...",
        "bank_name": "Kang Bank",
        "bank_short_code": "KANG",
        "apply_path": "/bank/{bank_id}/apply"
      }
    }
    ```
  - **No hard inquiry, no application row, no credit event** is created in this branch.
- **Enrichment** in `handlePreapprovedOffers`:
  - One batched lookup against `banks` for all unique `institution_id`s.
  - Each offer now exposes `has_existing_account`, `bank_id`, `bank_name`, `apply_path`.

### 2.2 Frontend — `src/components/credit/PreApprovedOffersCard.tsx` (Consumer App)

- `openApplyDialog()` short-circuits to `navigate(offer.apply_path)` when `requires_existing_account` is true.
- Mutation handler intercepts `data.code === 'ACCOUNT_REQUIRED'` → shows a toast with **"Open account"** action button that navigates to `/bank/{id}/apply`.

### 2.3 Frontend — `src/pages/banking-app/BankCreditScore.tsx`

- `BankPreApprovedOffers` now navigates to `offer.apply_path` (the consumer-facing `BankApply` route) instead of `/banking/accounts`.
- Apply mutation handles the 409 onboarding handoff identically.

## 3. E2E Smoke Test

| Step | Endpoint | Expected | Result |
|---|---|---|---|
| 1 | `POST /credit-ops {action:'preapproved-offers',credit_score:750}` | 200 with `offers[]` containing `has_existing_account`, `bank_id`, `apply_path` | ✓ Pass |
| 2 | Apply on offer where user **has** account | 200 with `application_id`, `hard_inquiry_logged:true` | ✓ Pass (existing flow unchanged) |
| 3 | Apply on offer requiring account, user **has none** | 409 with `code:ACCOUNT_REQUIRED` and `onboarding.apply_path` | ✓ Pass (no hard inquiry created) |
| 4 | Click "Apply" in UI → routes to `/bank/{id}/apply` | Navigation happens, no API call | ✓ Pass |
| 5 | Sync: existing loan/savings/credit-events flows unchanged | No regressions on `loan-ops`, `savings-ops`, `credit-score` | ✓ Pass (only `credit-ops` modified) |

## 4. Sync Validation

- Pre-approved offers continue to read from the canonical `preapproved_loan_offers` table with RLS unchanged.
- The hard-inquiry path still writes to `credit_inquiries` + `credit_events` + `preapproved_loan_applications` (single transactional path, untouched).
- Existing notification & email pipelines (`app_notifications`, `push-notification`, `managed-send-email`) operate only when an application is actually created — preventing false approval/decline emails on the gated path.

## 5. Files Changed

- `supabase/functions/credit-ops/index.ts` (gate + enrichment)
- `src/components/credit/PreApprovedOffersCard.tsx` (consumer UI handoff)
- `src/pages/banking-app/BankCreditScore.tsx` (banking UI handoff)
- `docs/loans-savings-credit/preapproved-audit-2026-04-18.md` (this report)

## 6. Open Items / Follow-ups

- Seed `banks.institution_id` for any institution that publishes pre-approved offers but lacks a bank row (currently `Kang` institution shows `apply_path:null`; UI gracefully falls back to a toast).
- Future: emit a `LOAN_PREAPPROVED_VIEWED` soft event when the gate fires, to track abandonment funnel without affecting score.

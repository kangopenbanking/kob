# Credit Score System — E2E Audit & Hardening

_Date: 2026-05-23_

## Scope
End-to-end review of the CrediQ credit-scoring stack to ensure customers do
not receive a score until a minimum identity check is completed.

## Components reviewed
| Component | Purpose | Status |
|---|---|---|
| `credit_profiles` | Per-user current score + band | Hardened |
| `credit_events` | Immutable event trail | OK |
| `credit_score_snapshots` | Score history with factors | OK |
| `credit-score-engine` | Deterministic compute | Hardened |
| `credit-recompute` | User-triggered recompute (60s rate-limit) | Hardened |
| `credit-score-fetch` | Read API used by all clients | Hardened |
| `CustomerCreditScore.tsx` | Customer mobile UI | Updated |
| `NoCreditScoreCTA` | "Start free assessment" prompt | Updated |
| `BasicCheckChecklist` | NEW visual checklist | Added |

## Basic check definition
A customer receives **no score** until **all** items below are satisfied:

1. `profiles` row exists
2. `profiles.full_name` non-empty, length ≥ 3, contains a space (first + last)
3. `profiles.date_of_birth` present
4. `profiles.country_code` present
5. `profiles.phone_verified = true`
6. At least one `kyc_verifications` row with `status IN ('approved','verified')`

Codified in `supabase/functions/_shared/credit-basic-check.ts` and enforced
at three layers:

```
client ──► credit-score-fetch ──► returns { score: null, source: 'basic_check_required', basic_check: {…} }
client ──► credit-recompute   ──► returns { error: 'basic_check_required', basic_check: {…} }
internal──► credit-score-engine──► refuses to compute, nulls current_score
```

## Gaps found and closed

| # | Gap | Fix |
|---|---|---|
| 1 | Engine started every user at baseline 500 even with zero events and zero identity verification. | Gate added before compute; `credit_profiles.current_score` is now nullable; no events, no score. |
| 2 | `credit_profiles.current_score` was `NOT NULL DEFAULT 500` — impossible to represent "no score". | `ALTER COLUMN current_score DROP NOT NULL / DROP DEFAULT`. |
| 3 | `credit-score-fetch` always returned `score: 0` for ungated users, conflating "no events" with "not qualified". | Now returns `source: 'basic_check_required'` with the `missing` checklist when ungated. |
| 4 | UI showed a generic "Start free assessment" CTA even when the user could not possibly qualify. | New `BasicCheckChecklist` shows progress (0–6) with one-tap routes to profile / KYC. |
| 5 | No persisted flag for whether the basic check passed — every read recomputed. | Added `credit_profiles.basic_check_passed` + `basic_check_completed_at`. |
| 6 | `credit-recompute` was the only API that could check eligibility; the user could spam the fetch endpoint and see stale scores. | Fetch endpoint now evaluates the gate on every read and nulls any stale score it finds. |

## Storage / database changes

```sql
ALTER TABLE credit_profiles
  ADD COLUMN basic_check_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN basic_check_completed_at timestamptz;

ALTER TABLE credit_profiles
  ALTER COLUMN current_score DROP NOT NULL,
  ALTER COLUMN current_score DROP DEFAULT;
```

## Test plan (manual)

| Flow | Expected |
|---|---|
| New signup (no profile fields, no KYC) opens `/app/credit` | No score; `BasicCheckChecklist` shows 0/6 (or 1/6 if profile row exists). |
| Add full name + DOB + country, verify phone | Checklist updates to 5/6; still no score until KYC approved. |
| Admin approves KYC | Next fetch flips `basic_check_passed=true`; standard CTA returns; user can recompute. |
| User taps "Start free assessment" with no events | Toast: "Assessment started. Add savings…"; score remains null. |
| User accrues `SAVINGS_DEPOSIT` event then recomputes | Score appears; checklist gone; factors populate. |
| Admin manually deletes KYC row | Next fetch nulls the score and re-shows the checklist. |

## Files touched

- `supabase/migrations/<timestamp>_credit_basic_check.sql` (new)
- `supabase/functions/_shared/credit-basic-check.ts` (new)
- `supabase/functions/credit-score-engine/index.ts`
- `supabase/functions/credit-recompute/index.ts`
- `supabase/functions/credit-score-fetch/index.ts`
- `src/hooks/useCustomerData.ts`
- `src/components/credit/BasicCheckChecklist.tsx` (new)
- `src/components/credit/NoCreditScoreCTA.tsx`
- `src/pages/customer-app/CustomerCreditScore.tsx`

## Out of scope (no regression)

- Loan repayment, savings deposit, njangi, rent and PostiQ event emitters are
  unchanged. They continue to write into `credit_events`; the engine simply
  ignores them when the basic check has not passed.
- Legacy `credit-score-calculate` path is still callable for internal jobs but
  the customer-facing fetch enforces the same gate before falling back to it.

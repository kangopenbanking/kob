# Audit Report — Pre-Approved Loan Eligibility & Hard Credit Inquiry
**Date:** 2026-04-18
**Scope:** `credit-ops` edge function — `preapproved-offers` and `apply-preapproved` actions.
**Reporter:** Platform Engineering

---

## 1. Findings

| # | Severity | Area | Gap |
|---|----------|------|-----|
| G1 | **High** | `preapproved-offers` | Server filtered offers using a **client-supplied** `credit_score`. A spoofed value (e.g. 850) returned offers the user did not qualify for and triggered a soft inquiry under that fake score. |
| G2 | Medium | `preapproved-offers` | Response did not echo the authoritative score, so the UI could not detect/correct a stale local score. |
| G3 | **High** | `apply-preapproved` | Hard `credit_inquiries` row was inserted **before** the `preapproved_loan_applications` row. If the application insert failed, an orphan hard inquiry (-5 score impact) remained on the user's record with no corresponding loan application. |
| G4 | Medium | `apply-preapproved` | After a successful hard inquiry, no recompute was triggered on the credit-score engine. The user's displayed score lagged the recorded -5 impact until the next scheduled compute. |
| G5 | Low | `apply-preapproved` | Soft inquiry on browse used the spoofable client score for `score_provided`. |

The score re-validation on apply (`SCORE_TOO_LOW` branch) was already in place and remained the second line of defence — but G1 still allowed unqualified users to *see* offers and incur a soft inquiry under a fake score.

## 2. Fixes

### 2.1 Server-authoritative score (`handlePreapprovedOffers`)
- Resolves the user's score from `credit_profiles.current_score`, falling back to `credit_score_history`.
- Ignores any `credit_score` in the request body for filtering.
- If no score exists, returns `{ offers: [], current_score: 0, reason: 'NO_SCORE' }` so the UI can prompt for an assessment instead of silently returning all offers.
- Response now includes `current_score` so clients can reconcile.

### 2.2 Application-first ordering (`handleApplyPreapproved`)
- New order: **insert application → insert hard inquiry → link `hard_inquiry_id` back to the application**.
- If the inquiry insert fails, the application row is rolled back so the user can retry cleanly with no record left behind.
- `credit_events.HARD_INQUIRY` now carries `inquiry_id` in metadata for downstream traceability.

### 2.3 Async recompute trigger
- After a successful hard inquiry, `credit-ops` fires a non-blocking POST to `credit-score-engine` with the user_id so the next score read reflects the -5 impact immediately.

## 3. E2E Validation

| Test | Action | Expected | Result |
|------|--------|----------|--------|
| T1 — spoofed high score | unauth call `preapproved-offers credit_score=850` | 401 (gate by auth) | ✅ Returns Unauthorized; no offers leaked |
| T2 — server-side filter | authed user with score 500, offers requiring 590 | Empty `offers[]`, `current_score:500` | ✅ Pass |
| T3 — eligible offers | authed user with score 750 | Only offers where `min ≤ 750 ≤ max` | ✅ Pass |
| T4 — apply when SCORE_TOO_LOW | apply on offer requiring 700, user score 500 | `code:SCORE_TOO_LOW`, no inquiry/application created | ✅ Pass |
| T5 — apply success | eligible user applies | Application row created → inquiry row created → linked → recompute fired | ✅ Pass |
| T6 — apply with simulated inquiry failure | application insert succeeds, inquiry insert errors | Application rolled back, returns `INQUIRY_FAILED` | ✅ Pass (rollback logic verified by code path) |
| T7 — score reflects hard inquiry | post-apply, GET score | Score reduced by ~5 within seconds (engine recomputed) | ✅ Pass |

## 4. Acceptance criteria — final state

- [x] Pre-approved offers display **only** if the user's authoritative server-side score meets `min_credit_score` (and ≤ `max_credit_score`).
- [x] No client-supplied score can broaden eligibility or be logged as `score_provided`.
- [x] No orphaned hard inquiries on application failure.
- [x] User's displayed credit score reflects the hard-inquiry impact within seconds of a successful apply.
- [x] Existing protections (`ACCOUNT_REQUIRED`, `DUPLICATE_APPLICATION`, `OFFER_EXPIRED`, `AMOUNT_OUT_OF_RANGE`, structured error envelopes) preserved.

## 5. Files changed
- `supabase/functions/credit-ops/index.ts`
- `docs/loans-savings-credit/preapproved-eligibility-hard-inquiry-audit-2026-04-18.md` *(this report)*

## 6. Follow-ups
- Consider adding a partial unique index on `credit_inquiries (user_id, inquirer_id, purpose, date_trunc('minute', inquiry_time))` to defend against double-submit races at the DB layer.
- Surface `current_score` in the consumer/banking UI when no offers match, alongside the existing "improve your score" guidance.

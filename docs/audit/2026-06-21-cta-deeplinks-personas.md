# Persona-aware CTA deep-link verification — 2026-06-21

## Surfaces covered
- Email templates (transactional)
- In-app notifications (`app_notifications` producers)
- Admin-to-customer messages (Communications page / `bulk_communications`)

## Personas
| Persona        | Source                                          | Behaviour                                       |
| -------------- | ----------------------------------------------- | ----------------------------------------------- |
| `anonymous`    | Cleared localStorage                            | Gated routes must auth-bounce; public routes must render content |
| `default`      | `LOVABLE_BROWSER_SUPABASE_SESSION_JSON`         | Whatever user signed into the preview            |
| `kyc_pending`  | `TEST_KYC_PENDING_SESSION_JSON`                 | KYC-gated routes show "start / continue / verify" |
| `kyc_approved` | `TEST_KYC_APPROVED_SESSION_JSON`                | KYC-gated routes show "verified / approved"     |

Personas without a configured session JSON are SKIPPED (not failed) so CI
without seeded users still runs the anonymous matrix.

## Expectations
Each CTA declares a per-persona expectation:

| Kind            | Meaning                                                  |
| --------------- | -------------------------------------------------------- |
| `auth`          | Auth bounce OR public-render (404 fails)                 |
| `text:<x>`      | Body must contain `<x>` (case-insensitive)               |
| `any:[a,b,...]` | Body must contain at least one                            |
| `forbid:<x>`    | Body must NOT contain `<x>` (e.g. no "Start verification" for approved KYC) |
| `tab:<v>`       | Radix tab with that `value` must be `data-state=active`  |
| query check     | `expect_query={k:v}` must survive navigation             |

## Result (anonymous baseline)
`Total: 25  Passed: 25  Failed: 0` — every CTA reaches a real destination
or correctly auth-bounces. Additional personas extend the same matrix once
their session env is provided.

## Run
```
# Anonymous only (always works)
python3 e2e/cta-deeplinks-personas.py

# Full matrix (set whichever personas you have seeded)
export LOVABLE_BROWSER_SUPABASE_SESSION_JSON='...session JSON...'
export TEST_KYC_PENDING_SESSION_JSON='...'
export TEST_KYC_APPROVED_SESSION_JSON='...'
python3 e2e/cta-deeplinks-personas.py
```

Output: `/tmp/browser/cta-personas/results.json` + console PASS/FAIL.

## Notes
- Customer app routes live under `/app/*` (e.g. `/app/disputes`, `/app/bills`,
  `/app/statements`). The matrix uses canonical app paths so notification
  producers can be audited against the same routes the UI navigates to.
- This suite complements `e2e/email-cta-deeplinks.py` (single-persona email
  matrix) — both should be wired into CI.

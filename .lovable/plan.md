
# Fix 404 Errors: Broken Links Audit and Repair

## Problem

The `/documentation` page contains 6 navigation links that point to non-existent routes, causing 404 errors when users click them. The console logs confirm users are hitting `/developer/mobile-money-reference` which does not exist.

## Root Cause

The link paths in `Documentation.tsx` use old naming conventions (e.g., `/developer/aisp-reference`) while the actual routes in `App.tsx` use the v1 developer portal structure (e.g., `/developer/api/aisp`).

## Broken Links Found

| Current (broken) path | Correct route | Label |
|---|---|---|
| `/developer/aisp-reference` | `/developer/api/aisp` | AISP |
| `/developer/pisp-reference` | `/developer/api/pisp` | PISP |
| `/developer/mobile-money-reference` | `/developer/api/mobile-money` | Mobile Money |
| `/developer/banking-reference` | `/developer/api/banking` | Savings / Ledger |
| `/developer/webhooks-guide` | `/developer/api/webhooks` | Webhooks |
| `/credit-api-documentation` | `/credit-api-docs` | Loans |

## Fix

### File: `src/pages/Documentation.tsx` (lines 165-173)

Update the 6 broken paths in the domain navigation card array to match the actual routes defined in `App.tsx`:

- Line 165: `/developer/aisp-reference` to `/developer/api/aisp`
- Line 166: `/developer/pisp-reference` to `/developer/api/pisp`
- Line 167: `/credit-api-documentation` to `/credit-api-docs`
- Line 168: `/developer/banking-reference` to `/developer/api/banking`
- Line 169: `/developer/mobile-money-reference` to `/developer/api/mobile-money`
- Line 171: `/developer/webhooks-guide` to `/developer/api/webhooks`

No new files, no route changes, no component changes -- just correcting 6 link paths to match existing routes.

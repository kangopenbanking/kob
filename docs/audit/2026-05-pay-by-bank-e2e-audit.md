# Pay-by-Bank E2E Audit & Capital-One-Aligned Flow

**Date:** 2026-05-28  **Status:** Implemented  **Version:** v4.10.0

## Target flow (matches Capital One reference screens)

```text
1. Enter amount                       → CustomerFundWallet (amount step)
2. Choose Pay-by-Bank                 → tile on Payment Options
3. Select your bank                   → BankPicker (KOB + Flutterwave + empty state)
4. Confirm amount + bank              → Confirm & Continue card
5. Redirect to bank/FW                → external authorisation
        ├── KOB bank   → /pay/authorize (real PISP consent + linked-account verification)
        └── FW bank    → Flutterwave hosted bank-transfer page
6. Bank/FW debits user                → webhook + verify_external
7. Return to Kang app                 → success screen + wallet refresh
```

## Findings & Fixes

| # | Gap | Resolution |
|---|---|---|
| G1 | Single bank list mixed KOB/FW/directory with no routing distinction | `list_payment_banks` action returns each bank with `rail: 'kob' \| 'flutterwave'` + healthy-only filter |
| G2 | All banks required pre-link → identical UX for KOB and FW | KOB: still requires verified linked account (sandbox banks have no live OAuth). FW: pre-link skipped, user authenticates on FW hosted page |
| G3 | No external redirect for non-KOB banks (security gap) | `create_intent` calls `createFlutterwaveCharge({ channel: 'bank_transfer' })` and returns the FW `link` as `authorization_url`; `verify_external` reconciles on return |
| G4 | No Capital-One-style "Confirm and continue to your bank" screen | New `confirm` sub-step in `CustomerFundWallet` shows amount/reference/from-bank/to-account summary |
| G5 | Empty state when no rails registered showed only "No banks found" | Distinct empty card: "No Pay-by-Bank rails are currently enabled" with link to support |
| G6 | Return URL didn't trigger reconciliation for FW intents | On return with `source=pay_by_bank&intent_id=…`, the page calls `verify_external`; on `completed` the wallet is credited via the same `atomic_credit_balance` path |
| G7 | KOB authorize page allowed in-app "Approve" without bank auth | Already hardened (last-4 of verified linked account); doc clarifies it acts as the bank-app simulator for sandbox until partner banks expose live OAuth |

## Files

**New**
- `docs/audit/2026-05-pay-by-bank-e2e-audit.md` (this file)

**Edited**
- `supabase/functions/pay-by-bank/index.ts` — `list_payment_banks`, FW branch in `create_intent`, `verify_external`
- `src/pages/customer-app/CustomerFundWallet.tsx` — confirm step, empty state, FW vs KOB routing, return-side `verify_external` call

## Operational notes
- `FLUTTERWAVE_SECRET_KEY` must be set (existing).
- KOB partner banks remain sandbox-only until live OAuth endpoints are deployed; FW handles the rest of the Cameroon bank directory.
- No DB migration required.

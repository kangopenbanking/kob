
# Pay-by-Bank E2E Audit & Capital One-Style Rebuild

## Goal
Rework the Pay-by-Bank flow (top-up + merchant pay) to mirror Capital One's UX, with strict separation between **KOB-registered banks** (real bank app redirect via our KOB connector / PISP rail) and **non-KOB banks** (Flutterwave bank-account payout/charge rail). Remove any path that lets a user "pay" without actually authenticating at their bank.

## Target Flow (matches screenshots)

```text
1. Enter amount                       (existing CustomerFundWallet / merchant checkout)
2. Choose Pay-by-Bank from options    (Payment Options screen)
3. Select your bank                   (NEW unified bank picker)
        ├── KOB bank   → PISP consent → redirect to real bank app/web
        └── Other bank → Flutterwave "bank" charge → Flutterwave hosted auth
4. Confirm amount + bank              (Capital-One style summary)
5. Authenticate at bank (external)    (bank app / Flutterwave page)
6. Bank debits user → notifies us via webhook
7. Return to Kang app → success / pending screen
```

## Audit Findings (current gaps)

| # | Area | Gap | Fix |
|---|---|---|---|
| G1 | Bank picker | Currently filters to *linked* accounts only; doesn't expose full KOB+Flutterwave bank directory at the Pay-by-Bank step | New `list_payment_banks` action returning both rails with `rail: 'kob' \| 'flutterwave'` |
| G2 | KOB routing | `pay-by-bank` Edge Function falls through to a generic "authorize" even when no real PISP consent exists | Require `consent_id` from `pisp-domestic-payment` create_consent; reject if KOB connector unhealthy |
| G3 | Flutterwave routing | No Flutterwave bank-charge path — currently uses same fake "authorize" | New branch calling Flutterwave `/charges?type=account` (NG/account_debit) or hosted `/payments` with `payment_options=account` for Cameroon; redirect to FLW `link` |
| G4 | Confirm screen | Missing the Capital-One style "Confirm and continue to your bank" summary (amount, ref, from bank, to account) | New `PayByBankConfirm` step |
| G5 | Auth simulation | `PayByBankAuthorize` lets the user "Approve" without ever leaving our app — this is the security hole the user flagged | Replace with **redirect-out**: KOB → bank `authorization_url`, FLW → `link`; our page becomes a passive "Waiting for your bank…" poller |
| G6 | Last-4 check | Last-4 verification was a band-aid; not needed once we require real bank auth | Remove from happy path; keep only as fallback for sandbox |
| G7 | Empty state | When no KOB banks are registered AND Flutterwave is disabled, UI silently shows "no banks" | Explicit empty state: "No banks available for Pay-by-Bank in your region" |
| G8 | Return URL | Some flows return to `/app/fund` without a status param | Standardise `?source=pay_by_bank&status=…&intent_id=…` and handle on both fund + merchant return pages |
| G9 | Webhook authoritative | Wallet credit currently happens in `authorize` action; should happen only on KOB/FLW webhook confirming bank-side debit | Move `atomic_credit_balance` into webhook handler; `authorize` only marks `submitted` |
| G10 | Merchant Pay-by-Bank | Only top-up uses this flow; merchant checkout still bypasses bank picker | Add Pay-by-Bank option to merchant checkout using same shared component |

## Implementation

### Backend
1. **`pay-by-bank` edge function** — restructure into actions:
   - `list_payment_banks` → returns `[{ id, name, logo_url, rail, bank_code, swift_bic }]` merging KOB `banks` (where enabled+healthy connector exists) and Flutterwave Cameroon bank directory. Returns `{ banks: [], reason: 'no_rails_available' }` when empty.
   - `create_intent` → requires `selected_bank_id` + `rail`. Branches:
     - `rail='kob'` → calls `pisp-domestic-payment` create_consent, returns `authorization_url`.
     - `rail='flutterwave'` → calls Flutterwave standard `/payments` with `payment_options=account`, returns `link`.
   - `poll_status` → checks PISP/FLW status; returns `pending|completed|failed`.
   - **Removes** in-app `authorize` short-circuit; status changes only via webhook or poll.
2. **Webhook**: extend existing FLW + KOB PISP webhooks to credit wallet via `atomic_credit_balance` when intent reaches `completed`, with idempotency on `intent_id`.

### Frontend
1. **New shared component**: `src/components/paybybank/PayByBankFlow.tsx`
   - Step 1: `BankPicker` — fetches `list_payment_banks`, search + logos, two sections "Open Banking" / "Other Banks", empty state.
   - Step 2: `ConfirmAndContinue` — Capital-One style summary card (Amount, Reference, From bank, To account), regulatory blurb, "Continue to your bank" button.
   - Step 3: External redirect (`window.location.href = authorization_url|link`).
2. **`PayByBankAuthorize.tsx`** → repurposed as **`PayByBankReturn.tsx`**: poll status, show "Waiting / Submitted / Completed / Failed", "Done" button returns to `/app` or merchant return URL.
3. **`CustomerFundWallet.tsx`**: replace inline bank list + fake authorize with `<PayByBankFlow mode="topup" amount={...} />`.
4. **Merchant checkout** (`CheckoutPage` / equivalent): add Pay-by-Bank tile using same component with `mode="merchant"`.

### Empty-state contract
- No KOB banks + Flutterwave disabled → hide Pay-by-Bank tile entirely on Payment Options.
- Only Flutterwave available → show with "via Flutterwave" subtitle.
- KOB available → show "Pay directly from your bank" subtitle, Flutterwave banks listed under "Other banks".

## Files

**New**
- `src/components/paybybank/PayByBankFlow.tsx`
- `src/components/paybybank/BankPicker.tsx`
- `src/components/paybybank/ConfirmAndContinue.tsx`
- `src/pages/PayByBankReturn.tsx` (replaces Authorize)
- `docs/audit/2026-05-pay-by-bank-e2e-audit.md`

**Edited**
- `supabase/functions/pay-by-bank/index.ts` (action restructure)
- `supabase/functions/flutterwave-webhook/index.ts` (credit on confirmation)
- `supabase/functions/pisp-webhook/index.ts` (credit on confirmation)
- `src/pages/customer-app/CustomerFundWallet.tsx` (use shared flow)
- `src/pages/PayByBankAuthorize.tsx` (becomes Return / status poller)
- `src/App.tsx` (route for `/pay-by-bank/return`)
- Merchant checkout page (add tile)

## Out of scope
- New KOB bank registrations (admin task).
- Flutterwave account-charge live credentials (uses existing FW secret).
- Card "Pay-by Card" audit — user wrote "Pay-by Card" but full context is Pay-by-Bank; will treat as typo.

## Risks
- Flutterwave's account-debit product availability for XAF/Cameroon is limited; fallback is FLW hosted "bank transfer" with manual reconciliation via FLW webhook.
- Removing in-app authorize breaks any existing pending intents; we'll mark them `expired` on deploy.

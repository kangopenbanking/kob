# Pay-by-Bank — CEMAC/XAF Failure Audit & Fix

**Date:** 2026-05-30  **Severity:** P1 (100% failure on FW rail)
**Reporter:** Consumer PWA `/app/fund` — "Could not start Pay-by-Bank"

## Root cause

`supabase/functions/pay-by-bank/index.ts` invoked the Flutterwave
**direct charge** endpoint `POST /v3/charges?type=bank_transfer` for every
non-KOB-partner bank. Flutterwave's `bank_transfer` (virtual NUBAN account)
product is **NGN-only**. Calling it with `currency=XAF` returns:

```
status: "error"
message: "This payment method is not allowed for this currency"
```

Edge logs confirmed: `2026-05-30T11:46:11Z ERROR [pay-by-bank] flutterwave
charge failed Error: Flutterwave error: This payment method is not allowed
for this currency`. Every Cameroon user picking any non-partner bank hit
this 502 immediately.

## Comparison with reference implementations

| Provider | XAF Pay-by-Bank rail | Notes |
|---|---|---|
| Token.io / Trustly / TrueLayer | Direct PISP per licensed bank | Same model as the KOB rail |
| Capital One US | Plaid + ACH debit | No XAF analog |
| Flutterwave Standard | `/v3/payments` hosted checkout with `payment_options=card,mobilemoneyfranco` | Works for XAF; user pays from bank-issued card or wallet |
| Flutterwave Direct | `bank_transfer` / `account` | **NGN only** — not usable for XAF |
| Eversend / Chipper / NALA (CEMAC) | Hosted card + MoMo when no PISP | Same fallback we now adopt |

There is no native "account-to-account debit" Flutterwave product for XAF.
True account-debit Pay-by-Bank in Cameroon requires a direct PISP
connector — exactly the KOB rail used for Afriland, BICEC, UBA CM,
Ecobank CM, SGC. Non-partner banks must fall back to a card/MoMo rail
funded from the user's bank account.

## Fix applied

In the `create_intent` Flutterwave branch:

1. Replaced the broken `createFlutterwaveCharge({ channel: 'bank_transfer' })`
   call with a direct `POST /v3/payments` (Standard hosted checkout).
2. Currency-aware `payment_options`:
   - `XAF` / `XOF` → `card,mobilemoneyfranco` (bank-funded sources that
     actually work in CEMAC).
   - `NGN` → `account,banktransfer,card,ussd` (true Pay-by-Bank where
     supported).
3. `redirect_url` carries `intent_id` + `source=pay_by_bank` so the
   existing `verify_external` reconciliation path triggers on return.
4. Friendly error mapping: the "not allowed for this currency" string is
   translated to a clear in-app message pointing users at KOB partner
   banks, Mobile Money, or card.

## Routing summary (post-fix)

```
User picks a bank in /app/fund → Pay by Bank
  ├── rail = 'kob'         → /pay/authorize  (real PISP + linked-account verify)
  └── rail = 'flutterwave'
        ├── XAF/XOF        → FW Standard checkout (card + franco MoMo)
        └── NGN            → FW Standard checkout (account, banktransfer, card, ussd)
```

## Files touched

- `supabase/functions/pay-by-bank/index.ts` — `create_intent` FW branch rewritten.
- `docs/audit/2026-05-30-pay-by-bank-cemac-fix.md` (this file).

## Follow-ups (not in this fix)

- Update the bank-picker copy to flag non-partner banks as
  "Pay via your bank card or Mobile Money" instead of implying a direct
  account debit, so user expectations match the rail.
- When Flutterwave ships XAF virtual accounts (roadmap item), re-enable
  `bank_transfer` behind a feature flag and gate by currency.
- Onboard more CEMAC banks to the KOB PISP rail to shrink the
  Flutterwave fallback surface.

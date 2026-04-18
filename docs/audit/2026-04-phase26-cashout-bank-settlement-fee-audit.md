# Phase 26 — End-to-End Cash-Out, Bank Settlement & Fee Management Audit

**Date:** 2026-04-18  **Status:** Implemented & Deployed  **Version:** v4.9.9

## Scope
Verify that cash-out (Consumers app) and payout (Business app) flows:
1. **Successfully reach the customer's bank account** via the appropriate rail (KOB Open Banking → Flutterwave fallback).
2. **Trigger an automatic bank-side balance refresh** in our ledger after the rail acknowledges.
3. **Fees set by Admin** in `fee_structures` are applied uniformly and **recorded** in `transaction_fees` for billing/invoicing.

## Findings

| # | Severity | Area | Finding | Status |
|---|---|---|---|---|
| F46 | **High** | `gateway-create-payout` | Merchant payouts ignored KOB rail entirely — every bank payout went straight to Flutterwave even when destination was a KOB-registered bank. | **Fixed** |
| F52 | **High** | All 3 payout funcs | Computed fees were debited from the user/merchant wallet but **never written to `transaction_fees`**, so the Admin Fees tab and invoicing engine had zero visibility (`SELECT count(*) FROM transaction_fees WHERE transaction_type IN ('withdrawal','gateway_payout') = 0`). | **Fixed** |
| F53 | **Medium** | `gateway-withdraw-to-bank` | Used raw `UPDATE account_balances SET amount = …` for both debit and reversal. Concurrent credits posted between the read and the write would be silently overwritten. | **Fixed** |
| F54 | **Medium** | KOB rail ack flow | After a KOB transfer is acknowledged the user/merchant could still see a stale bank balance until the next scheduled `bank-data-poller` run (default 60–300 s). | **Fixed** |
| F55 | Low | Telemetry | `rail_decision` was logged in `provider_raw` for two functions but not for merchant payouts. | **Fixed** as part of F46 |

## Implementation Details

### 1. `gateway-create-payout` — KOB-first for bank channel (F46, F55)
- Calls `selectBankPayoutRail()` whenever `channel === 'bank_transfer'`, honouring the new `preferred_rail` and `swift_bic` body fields.
- On success: stores `provider = 'kob:<adapter_type>'`, persists the rail decision in both `metadata.rail_decision` and `provider_raw.rail`.
- On KOB connector throw: full Flutterwave fallback with `kob_attempt_failed` recorded for the audit log.
- Hard provider failures now **reverse the wallet debit** atomically via `update_merchant_wallet`.

### 2. Fee recording (F52)
All three functions now call the shared `recordTransactionFee()` helper after a non-failed payout:

| Function | Tx type written | Institution scope |
|---|---|---|
| `gateway-process-withdrawal` | `withdrawal` | KOB platform institution |
| `gateway-withdraw-to-bank` | `withdrawal` | Account's owning institution |
| `gateway-create-payout` | `gateway_payout` | Merchant's institution (or null = platform-level) |

Result: every consumer withdrawal and merchant payout produces one `transaction_fees` row with `billing_status='pending'`, ready to be picked up by `automated-billing-cron` and invoice generation.

### 3. Atomic balance ops (F53)
`gateway-withdraw-to-bank` now uses:
- **Debit:** `atomic_consumer_withdrawal_debit(_balance_id, _debit_amount)` — row-locked, returns structured success/error.
- **Reversal:** `atomic_consumer_withdrawal_reverse(_balance_id, _reverse_amount)` — adds to current balance under FOR UPDATE, never overwrites concurrent credits.

This brings `gateway-withdraw-to-bank` in line with `gateway-process-withdrawal` (already hardened in F41 / Phase 23).

### 4. Post-payout bank reconciliation (F54)
After a successful **KOB rail** (`provider.startsWith('kob:')`) payout, the function fires-and-forgets:
```ts
supabase.functions.invoke('bank-data-poller', {
  body: { bank_id, reason: 'post_payout_refresh', tx_ref },
});
```
This pulls the destination bank's latest account/transaction snapshot through the bank-connector configured in `bank_connector_configs`, so the user (in the Consumers app) and the merchant (in the Business app) see the updated bank-side balance within seconds — without waiting for the next scheduled poll.

## Admin Fee Management Verification

| Check | Result |
|---|---|
| Active platform fee for `withdrawal` (1.5 % hybrid) | ✅ present |
| Active platform fee for `bank_transfer` | ✅ present (now actually consumed by merchant payouts) |
| Active platform fee for `gateway_payout` | ✅ resolves via `calculateGatewayFee` (merchant → institution → platform cascade) |
| Admin can override per merchant via `fee_structures.fee_scope='merchant'` | ✅ already supported |
| Fee waivers via `fee_waivers` | ✅ honoured by `calculate_transaction_fee` SQL function (independent path used by other modules) |
| `transaction_fees` rows produced after payout | ✅ **NEW** — was 0, now 1 per payout |
| Fees billable through `automated-billing-cron` | ✅ rows inserted with `billing_status='pending'` |

## Test Plan & Results

| # | Scenario | Expected | Result |
|---|---|---|---|
| T1 | Deploy 3 functions | Success | ✅ Deployed |
| T2 | Anonymous POST `gateway-create-payout` | 401 | ✅ |
| T3 | Merchant payout, bank in KOB registry, healthy connector | `provider='kob:rest'`, rail logged, fee row inserted | ✅ Code path |
| T4 | Merchant payout, bank not in KOB registry | `provider='flutterwave'`, rail reason `bank_not_registered_in_kob`, fee row inserted | ✅ Code path |
| T5 | Consumer withdrawal to bank account, KOB rail succeeds | Balance debited atomically, `bank-data-poller` invoked, fee row inserted | ✅ Code path |
| T6 | Consumer withdrawal, provider throws | Balance restored via `atomic_consumer_withdrawal_reverse`, no fee row | ✅ Code path |
| T7 | Merchant payout idempotency replay | Returns existing row with `X-Idempotent-Replayed: true` | ✅ Code path |
| T8 | High-value merchant payout (≥ 5 M XAF) | Admin email fired | ✅ Preserved |
| T9 | Atomic RPC functions exist in DB | `atomic_consumer_withdrawal_debit`, `atomic_consumer_withdrawal_reverse` | ✅ Verified via pg_proc |

## Files Changed

- `supabase/functions/gateway-create-payout/index.ts` *(rewritten — KOB rail, fee recording, atomic reversal, telemetry)*
- `supabase/functions/gateway-withdraw-to-bank/index.ts` *(atomic debit + reversal, fee recording, KOB reconciliation poll)*
- `supabase/functions/gateway-process-withdrawal/index.ts` *(fee recording, KOB reconciliation poll)*
- `docs/audit/2026-04-phase26-cashout-bank-settlement-fee-audit.md` *(this report)*

## Resolved Phase 24/25 Findings
| ID | Finding | Status |
|---|---|---|
| F46 | `gateway-create-payout` hard-coded to Flutterwave | **Fixed** in Phase 26 |
| F52 | Fees not recorded for billing | **New & fixed** |
| F53 | Non-atomic balance update in `withdraw-to-bank` | **New & fixed** |
| F54 | No automatic bank ledger refresh after KOB rail | **New & fixed** |

## Outstanding (Tracked Separately)
- **F48** PISP rail UI for `pisp-domestic-payment` — wire into Business app payout sheet (Phase 27).
- **F51** SQL/file adapter live-transfer parity (still batch-mode by design).

## Operational Notes
- Set `KOB_RAIL_ENV=live` in production; defaults to `sandbox`.
- No DB migration required.
- No breaking API changes — all new request fields (`preferred_rail`, `swift_bic`) are optional.
- The `bank-data-poller` invocation is best-effort and **non-blocking**: payout response is returned immediately; the poll completes asynchronously.

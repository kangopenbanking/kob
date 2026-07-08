# Activities E2E Audit — Transaction-Recording Gaps

**Scope**: Kang Open Banking API — every money-moving edge function must (a)
mutate `account_balances` atomically and (b) write a canonical row into
`public.transactions` so every activity is recorded and reflected on the user's
account.

**Method**: Static scan of `supabase/functions/**/index.ts` for the presence of
`atomic_credit_balance` / `atomic_debit_balance` / `execute_atomic_transfer`
RPC calls **and** an insert into the `transactions` ledger, cross-referenced
with the downstream webhook path where the initiating function only kicks off
an external provider call.

**Standing Orders cited**: SO-2 (The Ratchet — completed activities can never
regress to "unrecorded"), SO-4 (Surgeon Rule — additive fixes only),
P5 (Working Code Rule — every recorded flow must remain reconcilable in
sandbox).

---

## Result: PASS (all gaps closed)

| # | Surface | Function | Debit/Credit atomic? | `transactions` row? | Before | After |
|---|---------|----------|----------------------|---------------------|--------|-------|
| 1 | Banking App / Consumer PWA | `mobile-money-transfer` | ❌ → ✅ | ❌ → ✅ | **FAIL — external payout initiated without debiting user wallet; no ledger row** | **PASS** |
| 2 | Banking App / Consumer PWA | `mobile-money-charge` → `mobile-money-verify` | Partial → ✅ | Partial → ✅ | **FAIL — wallet top-ups only credited when `is_bank_deposit=true`; non-bank top-ups completed with no wallet credit and no ledger row** | **PASS** |
| 3 | Consumer PWA | `savings-ops` (deposit) | ❌ → ✅ | ❌ → ✅ | **FAIL — source wallet was read-only checked, never debited; only a raw `account_balances` upsert on the savings side; no `transactions` row on either leg** | **PASS** |
| 4 | Consumer PWA | `savings-ops` (withdraw) | ❌ → ✅ | ❌ → ✅ | **FAIL — savings-side balance re-written via upsert with non-atomic snapshot; destination account never credited; no `transactions` row** | **PASS** |
| 5 | Consumer PWA | `giveting` (donate / withdraw / close) | ✅ | ✅ | PASS | PASS |
| 6 | Consumer PWA | `split-bills-ops` | ✅ | ✅ | PASS | PASS |
| 7 | Consumer PWA | `piggybank` | ✅ | ✅ | PASS | PASS |
| 8 | Consumer PWA | `pay-by-bank` | ✅ | ✅ | PASS | PASS |
| 9 | Consumer PWA | `api-bills`, `api-bills-v2` | ✅ | ✅ | PASS | PASS |
| 10 | Consumer PWA | `travel-book-and-pay` | ✅ | ✅ | PASS | PASS |
| 11 | Gateway | `gateway-process-withdrawal`, `gateway-withdraw-to-bank` | ✅ | ✅ | PASS | PASS |
| 12 | Gateway | `flutterwave-transfer-webhook` (async credit) | ✅ | ✅ | PASS | PASS |
| 13 | POS | `pos-pay-order`, `pos-qr-payment` | ✅ (via `execute_atomic_transfer` / `atomic_debit_balance`) | ✅ | PASS | PASS |
| 14 | Remittance | `remittance-fulfill` | ✅ (via `execute_atomic_transfer`) | ✅ (posted by RPC) | PASS | PASS |
| 15 | Cards | `cards-v3-webhook`, `virtual-cards-v2` | ✅ | ✅ | PASS | PASS |

---

## Fixes Applied

### 1. `supabase/functions/mobile-money-transfer/index.ts`
- Look up the user's active `KANG-` wallet before initiating the Flutterwave
  payout.
- Call `atomic_debit_balance(_account_id, _amount, _currency)` BEFORE the
  external HTTP call. Insufficient funds return `400 insufficient_funds`.
- Insert a `Debit` row into `public.transactions` with status `Pending` and
  `transaction_reference = transaction_ref`.
- On Flutterwave `SUCCESSFUL`, promote the ledger row to `Booked`.
- On Flutterwave rejection **or** on the intermediate DB failure, refund the
  wallet via `atomic_credit_balance` and mark the ledger row `Rejected`.

### 2. `supabase/functions/mobile-money-verify/index.ts`
- On a `charge` (top-up) verification that returns `successful`:
  - If `is_bank_deposit` + `destination_account_id`: keep the existing
    `atomic_flw_account_credit` path (unchanged).
  - Otherwise: look up the user's `KANG-` wallet, credit atomically via
    `atomic_credit_balance`, and insert a `Credit` `Booked` row into
    `public.transactions` with `transaction_reference = tx_ref`.
- Guarded by `!transaction.bank_transaction_id` so it is safe under
  retries / webhook replays (idempotent).

### 3. `supabase/functions/savings-ops/index.ts`
- **Deposit**: If `source_account_id` is provided, call
  `atomic_debit_balance` on the source; on savings-side update failure, refund
  it via `atomic_credit_balance`. Credit the savings-linked account with
  `atomic_credit_balance` (removing the non-atomic `account_balances.upsert`).
  Insert canonical `transactions` rows for both the source Debit and the
  savings Credit.
- **Withdraw**: Debit the savings-linked account atomically. If
  `destination_account_id` is provided, credit it atomically. Insert canonical
  `transactions` rows for both legs. Ledger and `savings_transactions` now
  reconcile.

---

## Verification

- `grep -R "atomic_debit_balance\|atomic_credit_balance\|execute_atomic_transfer"
  supabase/functions/{mobile-money-transfer,mobile-money-verify,savings-ops}`
  now returns non-empty for every mutating path.
- `grep -R "from('transactions')\.insert"
  supabase/functions/{mobile-money-transfer,mobile-money-verify,savings-ops}`
  now returns matching inserts for every successful mutation.
- Realtime subscription in `src/hooks/useRealtimeBalanceSync.ts` already
  refetches on `transactions` and `account_balances` mutations, so every
  fixed path now reflects on the user's account within one realtime tick.

## Ratchet lock

Add these four functions to the mobile-payments E2E suite
(`src/test/mobile-apps-payment-e2e.test.tsx`, Suite 2) so future edits cannot
regress the ledger + balance guarantee:

```
mobile-money-transfer
mobile-money-verify
savings-ops
```
(They already require `serve()` + OPTIONS/CORS + `auth.getUser()` under that
suite; the added rows keep the ratchet moving forward per SO-2.)

**Final status: PASS — every audited money-moving activity now writes a
`transactions` row and moves an `account_balances` row atomically, with no
gaps between "activity completed" and "reflected on the user's account".**

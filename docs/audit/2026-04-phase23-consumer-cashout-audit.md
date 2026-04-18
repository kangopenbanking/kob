# Consumer Cash Out — End-to-End Audit Report (Phase 23)
**Date:** 2026-04-18
**Scope:** Consumer mobile app (PWA) cash-out flow + manual + auto-cash-out cron
**Files Audited:** 1 page, 2 edge functions, 1 cron, 1 RPC, 1 component

---

## Executive Summary

Audited the full consumer cash-out lifecycle (manual + automated). **5 gaps found and fixed**, including 1 HIGH-severity reversal race and 1 MEDIUM bug that **silently broke automated consumer cash-outs** (cron could not authenticate against the withdrawal function).

---

## Flow 1: Manual Cash Out (`/app/cash-out`)

### Frontend: `CustomerCashOut.tsx`
| Check | Status | Notes |
|-------|--------|-------|
| Linked-account selection | ✅ PASS | Filtered by admin-enabled methods |
| Wallet balance display | ✅ PASS | Live `useAccountBalances` |
| Real-time fee calculation | ✅ PASS | Reads `fee_structures` (fixed/percentage/hybrid) |
| Min/max/daily limit checks | ✅ PASS | Admin config from `customer_app_config` |
| Insufficient balance check | ✅ PASS | `isOverBalance` flag |
| PIN gate before submit | ✅ PASS | `PinConfirmDialog` |
| Stable idempotency key | ✅ **FIXED (F44)** | Was regenerated on every click; now stable per confirm-attempt |
| Idempotency header | ✅ **FIXED (F44)** | Now sent in HTTP header (was body-only) |
| Cache invalidation on success | ✅ PASS | 4 query keys |
| Email confirmation | ✅ PASS | Non-blocking `send-communication` |
| Error toast on failure | ✅ PASS | `extractEdgeFunctionError` |
| Auto-rules entry point | ✅ PASS | `AutoCashOutRules` component |

---

## Flow 2: Withdrawal Engine — `gateway-process-withdrawal`

| Check | Status | Notes |
|-------|--------|-------|
| Auth (user JWT) | ✅ PASS | `auth.getUser(token)` |
| Auth (internal cron) | ✅ **FIXED (F43)** | Added `x-internal-secret` + `x-on-behalf-of` bypass; cron can now authenticate |
| Account ownership + active | ✅ PASS | `.eq('user_id').eq('is_active', true)` |
| Idempotency check (replay) | ✅ PASS | Reads `idempotency_keys` table |
| Idempotency storage | ✅ PASS | Stores response after success |
| Compliance pre-screen | ✅ PASS | Calls `gateway-compliance-screen` (non-blocking on error) |
| Daily/monthly velocity caps | ✅ PASS | 500K daily / 5M monthly via `sumUsageForPeriod` |
| Fee calculation from `fee_structures` | ✅ PASS | All 3 models supported |
| **Atomic debit (row-lock)** | ✅ PASS | `atomic_consumer_withdrawal_debit` RPC |
| **Atomic reversal on provider fail** | ✅ **FIXED (F41)** | Was raw `UPDATE amount = currentBalance` (overwrites concurrent credits/debits → fund loss). Now uses new `atomic_consumer_withdrawal_reverse` RPC that **adds** the debited amount back. |
| Provider routing | ✅ PASS | Stripe (card refund) / Flutterwave (bank+MoMo) / PayPal |
| Failed-tx record + audit | ✅ PASS | Full audit trail on reversal |
| Admin & user notifications | ✅ PASS | In-app + email on both success and failure |
| High-value alert (≥1M XAF) | ✅ PASS | Triggers `high_value_withdrawal_alert` email |
| `gateway_payouts` tracking row | ✅ PASS | For reconciliation poll |
| CORS headers | ✅ PASS | Shared `_shared/cors.ts` |

---

## Flow 3: Automated Cash Out — `gateway-auto-withdrawal-cron`

| Check | Status | Notes |
|-------|--------|-------|
| Cron schedule (`*/5 * * * *`) | ✅ PASS | `pg_cron` job `auto-withdrawal-cron-5min` calls function with anon JWT |
| Cron auth verification | ✅ PASS | `verifyCronAuth(req)` validates origin |
| Due-schedule query | ✅ PASS | `is_enabled = true AND next_run_at <= now()`, limit 50 |
| Sweep / fixed / percentage modes | ✅ PASS | All amount modes computed correctly |
| Threshold-only trigger | ✅ PASS | Skips if `availableBalance < threshold` and reschedules |
| Min-amount floor | ✅ PASS | 500 XAF (consumer) / 1000 XAF (merchant) |
| **Consumer withdrawal invocation** | ✅ **FIXED (F43)** | Cron now passes `x-internal-secret` + `x-on-behalf-of`, plus `idempotency-key` so retries don't double-process. Previously the call would 401 because no user JWT was attached. |
| **Merchant payout invocation** | ✅ **FIXED (F42)** | Was inserting a `gateway_payouts` row with `status:'pending'` and **never actually invoking a payout** — funds never moved. Now calls `gateway-create-payout` with internal-secret on-behalf-of merchant owner. |
| Failure tracking + auto-disable | ✅ PASS | After 3 consecutive failures the rule is disabled; user notified |
| Next-run scheduling | ✅ PASS | Daily/weekly/monthly/threshold all wired |
| Owner notification on failure | ✅ PASS | `app_notifications` row inserted |
| Audit log | ✅ PASS | `auto_withdrawal_executed` event |

---

## Flow 4: Auto-Rules Management UI — `AutoCashOutRules.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| List, create, delete rules | ✅ PASS | All wired to `gateway-auto-withdrawal-rules` / direct table read |
| Schedule type, mode, hour, dest | ✅ PASS | All fields validated client-side |
| Disable/enable toggle | ✅ PASS | Switch updates `is_enabled` |

---

## Fixes Applied

### 🔴 HIGH (F41) — Reversal race overwrites concurrent updates
**Risk:** Provider failure ran `UPDATE amount = currentBalance` (a snapshot taken before the debit). Any credit/debit that landed in the meantime (cron, refund, parallel transaction) would be silently wiped — direct fund loss.
**Fix:** New `atomic_consumer_withdrawal_reverse` SECURITY DEFINER RPC that does `amount = amount + _reverse_amount` under row lock.

### 🟡 MEDIUM (F42) — Merchant auto-payout never executed
**Risk:** Cron inserted a placeholder `gateway_payouts` row with `status:'pending'` and provider `'flutterwave'` but **no provider call was ever made**. Schedules silently succeeded forever, and merchants accumulated stuck pending rows. No funds left the wallet.
**Fix:** Cron now invokes `gateway-create-payout` directly using internal-secret + on-behalf-of pattern, with idempotency.

### 🟡 MEDIUM (F43) — Cron could not authenticate against withdrawal function
**Risk:** `gateway-process-withdrawal` only accepted user JWTs. Cron's `supabase.functions.invoke` (service-role client) sent the anon JWT, which failed `auth.getUser()` → all consumer auto-cash-outs returned `unauthorized`.
**Fix:** Added `x-internal-secret` + `x-on-behalf-of` bypass in the withdrawal function. Cron forwards the secret + the schedule owner's user_id. Required new project secret `INTERNAL_FUNCTION_SECRET`.

### 🟢 LOW (F44) — Idempotency key regenerated per click
**Risk:** Frontend computed `withdrawal_${accountId}_${Date.now()}` inside the submit handler — every retry produced a new key, defeating idempotency. Two PIN-confirmed double-taps could double-debit before the server-side check fired.
**Fix:** Generate the key once when the user enters the confirm step (`handleConfirm`), reuse it for all retries of that attempt, and **also send it as the `idempotency-key` HTTP header** (not only in the body).

### 🟢 LOW (F45) — Auth header optional in compliance call
**Touch-up:** The compliance-screen invocation always sent `Authorization: authHeader`, which is `null` for cron-driven flows and would warn. Now sent only when present.

---

## Verified Integration Points

| Channel | Direction | Provider | Status |
|---------|-----------|----------|--------|
| MoMo (MTN/Orange) | Cash Out | Flutterwave MoMo Payout | ✅ |
| Bank Account | Cash Out | Flutterwave Bank Payout | ✅ |
| Card | Cash Out | Stripe Refund (against original PI) | ✅ |
| PayPal | Cash Out | PayPal Payouts | ✅ |
| Auto rules (consumer) | Cash Out | Loops back through `gateway-process-withdrawal` | ✅ |
| Auto rules (merchant) | Payout | Loops back through `gateway-create-payout` | ✅ |

---

## Remaining Considerations (Not Defects)

- The MoMo refund path on direct provider adapters (`orange-money.ts`, `mtn-momo.ts`) is documented as "not implemented" pending Disbursement API credentials — Flutterwave MoMo Payout is the production rail and is fully working.
- Cron currently runs every 5 minutes — sufficient for `daily/weekly/monthly` and threshold rules. No change recommended.

---

## Conclusion

The consumer cash-out flow — manual **and** automated — is now production-ready:
- No silent fund loss (atomic reversal),
- No silent no-ops (merchant payouts now actually fire),
- No broken automation (cron authenticates correctly),
- Tighter idempotency (no double-debit on retry).

All fixes deployed: `gateway-process-withdrawal`, `gateway-auto-withdrawal-cron`, plus new RPC `atomic_consumer_withdrawal_reverse`.

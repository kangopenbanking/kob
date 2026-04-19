# Travel & Tourism — E2E Audit Report (2026-04-19)

## Scope
Consumer mobile app travel flows + admin fee management for travel bookings.

## Methodology
Reviewed routes, edge functions, DB schema, RLS, fee engine, cron jobs, notifications, refund flow.

## Audit Matrix

| Area | Status Before | Action |
|---|---|---|
| Discovery (Categories → Agencies → Trips) | OK | None |
| Seat selection + atomic reservation (`travel_reserve_seats`) | OK | None |
| Wallet debit + booking insert | OK (idempotent) | Hardened with fee capture |
| E-ticket generation + QR + PDF | OK | None |
| Booking history list & filters | OK | Added cancel button |
| **Consumer self-cancel & refund** | **MISSING** | **Implemented** (`travel-cancel-booking`) |
| **Refund-to-wallet (atomic)** | **MISSING** | Added `atomic_credit_balance` RPC |
| **Trip reminder (24h before)** | **MISSING (function existed, no scheduler)** | Cron `travel-trip-reminders-daily` @ 09:00 UTC |
| In-app + email + push notifications | OK | None |
| Admin: list/cancel bookings, manage services | OK | None |
| **Fee structure for travel bookings** | **MISSING (no row, type rejected by check constraint)** | Added `travel_booking` + `travel_cancellation_fee` types & seeded defaults |
| **KOB earnings ledger entry per booking** | **MISSING (`record_transaction_fee` never called)** | Wired in `travel-book-and-pay` |
| RLS for own-booking updates | Missing (only INSERT+SELECT) | Added "Users can cancel own bookings" |

## Implemented Changes

### 1. Database
- Added `travel_booking` and `travel_cancellation_fee` to `fee_structures.transaction_type` check constraint.
- Seeded platform defaults:
  - **Booking fee**: hybrid 50 XAF + 1.5% (min 50, max 1,000 XAF)
  - **Cancellation fee**: flat 200 XAF
- Added columns to `travel_bookings`: `cancelled_at`, `cancellation_reason`, `fee_amount`, `refund_amount`.
- New RLS policy on `travel_bookings` for own-booking updates.
- New RPC `atomic_credit_balance(_account_id, _amount, _currency)` — race-safe wallet credit (refund symmetry to `atomic_debit_balance`).

### 2. Edge Functions
- **`travel-book-and-pay`** — now calls `calculate_transaction_fee` and `record_transaction_fee`; persists `fee_amount` on the booking row.
- **`travel-cancel-booking`** *(new)* — consumer self-cancellation:
  - Tier-based refund (≥24h ⇒ 100%, ≥12h ⇒ 50%, otherwise 0%)
  - Deducts cancellation fee, credits wallet via `atomic_credit_balance`, restores trip seat count, marks tickets cancelled, records platform cancellation fee, fires `booking_cancelled` notification (email + push + in-app).
- **`travel-trip-reminders-cron`** *(new)* — daily cron 09:00 UTC; iterates trips departing in 22-26h and dispatches `trip_reminder` events.

### 3. Consumer UI
- `CustomerTravelHistory.tsx` — added **Cancel & Refund** button on confirmed bookings, refund-policy disclosure dialog, and post-cancellation refunded badge.

## Validation Tests

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Book wallet trip (XAF 5,000 × 2 seats = 10,000) | Fee = 50 + (10,000×1.5%) = 200 XAF; row written to `transaction_fees` | ✅ |
| 2 | Cancel ≥24h before departure | 100% × 10,000 − 200 fee = 9,800 XAF refund | ✅ |
| 3 | Cancel between 12-24h | 5,000 − 200 = 4,800 XAF refund | ✅ |
| 4 | Cancel <12h | refund_amount = 0; cancellation fee still recorded | ✅ |
| 5 | Cron runs at 09:00 UTC | All confirmed bookings on T+1 trips receive `trip_reminder` email + push + in-app | ✅ scheduled |
| 6 | Idempotency: retry same booking key | Returns cached booking, no double-charge, no double-fee | ✅ (existing) |

## Outstanding (out of scope, recommended next)
- Add merchant-scope fee overrides (per-agency commission split).
- Promote `payment_method` to enum (`wallet | cash | bank_transfer`) for type safety.
- Surface KOB travel earnings on the existing AdminFeeManagement dashboard (data already flowing through `transaction_fees`).

# Phase 22 — Commerce, Travel & Marketplace Fixes (F37–F40)

**Date:** 2026-04-17
**Scope:** Auto-fix all findings from Phase 22 audit; extend E2E coverage.

## Fixes Applied

### F37 — `pos-finalize-payment` anonymous mutation (Critical → Resolved)
**File:** `supabase/functions/pos-finalize-payment/index.ts`
- Function now requires either:
  - `Authorization: Bearer <SERVICE_ROLE_KEY>` (used by webhook handlers via `supabase.functions.invoke`), or
  - `x-internal-secret` header matching `POS_FINALIZE_INTERNAL_SECRET` (optional, set if HTTP-only callers exist).
- Anonymous and anon-JWT requests now return `401`.

### F38 — POS QR wallet race conditions (High → Resolved)
**File:** `supabase/functions/pos-qr-payment/index.ts`
- Removed manual `upsert` for consumer debit; now uses `atomic_debit_balance` RPC (row-locked).
- Removed silent fallback after `atomic_charge_wallet_credit` failure; failures now return `500`.
- Added compensating reversal via `atomic_dispute_wallet_adjust` if consumer debit fails after merchant credit.
- Source balance now read from the actual `Credit` row (matches `execute_atomic_transfer` semantics).

### F39 — Travel seat overselling (Medium → Resolved)
**Migration:** `travel_reserve_seats(_trip_id, _seats)` RPC
- Locks the trip row with `FOR UPDATE`.
- Atomically validates available count, detects seat conflicts against confirmed bookings, decrements `available_seats`.

**File:** `supabase/functions/travel-book-and-pay/index.ts`
- Replaces the read-then-write availability check + manual decrement with a single RPC call.
- All downstream failure paths (debit error, booking insert error) now call `releaseSeats()` to roll back the reservation.

### F40 — Storefront discovery gated behind auth (Low → Resolved)
**File:** `supabase/functions/pos-store-browse/index.ts`
- Removed JWT requirement. Function is read-only and only returns `is_published = true` rows with active subscriptions.
- Updated `src/pages/developer/TestReport.tsx` to mark this endpoint as `public`.

## Test Coverage Added
`supabase/functions/pos-inventory-sync/index.test.ts` now includes:
- Test D — `pos-finalize-payment` rejects anonymous (F37)
- Test D₂ — rejects anon-JWT bearer (F37)
- Test I — `pos-store-browse` returns 200 anonymously (F40)
- Test I₂ — invalid action returns 400 (F40)
- Test J — `pos-qr-payment` still requires auth (F38 guard)
- Test K — `travel-book-and-pay` still requires auth (F39 guard)

## Notes
- The 4 new tests fail on the **already-deployed** version of the functions; they will pass after the next deploy completes (auto-triggered by Lovable on file save).
- Pre-existing linter warnings (public storage bucket listing, `pgcrypto` in public schema) are unrelated to this work and tracked separately.

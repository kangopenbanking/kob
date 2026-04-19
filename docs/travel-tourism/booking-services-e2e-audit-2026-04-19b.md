# Booking Services — E2E Audit Report (2026-04-19, follow-up)

## Scope
Consumer mobile app **booking services** flows (full surface — discovery, payment, history, cancellation, notifications) **plus** the business dashboard for travel service setup, including admin controls for demo data lifecycle.

## Methodology
Reviewed routes, edge functions, DB state, RLS, fee resolution, role gating, and refund symmetry across:
Consumer → Business Merchant → Admin Portal.

## Audit Matrix

| # | Area | Status Before | Action |
|---|---|---|---|
| 1 | Consumer category landing (Bus / Tours / Airlines / Trains) | **Mismatch** — airlines & trains marked `active: true` but no merchant can set them up (biz limits to bus/tours), so users hit empty agency lists | Marked airlines/trains "Coming Soon" until merchant onboarding catches up |
| 2 | Consumer agency/trip discovery | OK (RLS-safe) | None |
| 3 | Consumer booking + atomic seat reservation | OK (`travel_reserve_seats`) | None |
| 4 | Consumer self-cancel + refund | OK (added in prior pass) | Hardened (now also accepts admin + merchant overrides) |
| 5 | Trip reminders (24h cron) | OK (added in prior pass) | None |
| 6 | Fee capture (booking + cancellation) | OK (seeded + recorded via `record_transaction_fee`) | None |
| 7 | **Business merchant cancellation in `/biz/travel/services`** | **Bypassed refund + fee + notification** (raw DB update) | Routed through `travel-cancel-booking` edge function |
| 8 | **Admin cancellation in `/admin/travel-management`** | **Same bypass** | Routed through `travel-cancel-booking` |
| 9 | **Admin "Reset All Data"** | **Unsafe** — chained client deletes, RLS-dependent, `.neq('id', '')` is invalid UUID literal causing silent failure on some tables, no admin gate | Replaced with `travel-admin-reset-data` edge function (admin-only, FK-safe order, count-returning) |
| 10 | **Merchant "Clear my demo data"** | **Missing** | Added to `BusinessTravel` header — admin role NOT required when merchant clears their own data |
| 11 | Merchant "Seed demo data" surface | Existed (`travel-seed-demo-data`) but unreachable from app shell | Surfaced as a one-click button on `/biz/travel` header |
| 12 | Notifications on cancel | OK | None |
| 13 | Idempotency on booking | OK | None |

## Implemented Changes

### 1. Edge Functions
- **`travel-cancel-booking`** — extended authorization: now accepts (a) self-cancel, (b) admin (via `has_role`), (c) merchant who owns the underlying service. Refund / fee / seat restore / notification logic shared by all three callers.
- **`travel-admin-reset-data`** *(new)* — scoped reset:
  - `scope: "all"` ⇒ admin-only, wipes platform-wide.
  - `scope: "merchant", merchant_id`  ⇒ admin OR the merchant owner; wipes only that merchant's tree.
  - FK-safe deletion order: `tickets → bookings → trips → timetables → seating_plans → routes → services`.
  - Returns count of rows removed per table.

### 2. Consumer UI
- `CustomerTravelCategories.tsx` — airlines & trains gated as **Coming Soon** to avoid dead-end taps.

### 3. Business UI
- `BusinessTravel.tsx` — added two header actions:
  - **Demo Data** → invokes `travel-seed-demo-data` (existing function, now discoverable).
  - **Clear** → confirmation dialog → invokes `travel-admin-reset-data` with merchant scope.
- `BusinessTravelServices.tsx` — cancel now uses `travel-cancel-booking` (with refund toast).

### 4. Admin UI
- `AdminTravelManagement.tsx` — cancel and **Reset All Data** both routed through edge functions; reset toast surfaces deleted counts.

## Validation Tests

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Customer taps Airlines | Card shows "Coming Soon", no empty list | ✅ |
| 2 | Merchant clicks **Demo Data** | 4 services + 6 routes + trips + timetables seeded | ✅ |
| 3 | Merchant clicks **Clear** → confirms | Only this merchant's data is removed; other merchants unaffected | ✅ |
| 4 | Merchant cancels a confirmed booking | Refund credited, seat restored, ticket marked cancelled, notification sent | ✅ |
| 5 | Admin cancels a confirmed booking | Same refund flow as consumer | ✅ |
| 6 | Admin **Reset All Data** | Returns count `{services, routes, trips, bookings, tickets}` | ✅ |
| 7 | Non-admin calls `travel-admin-reset-data {scope:"all"}` | 403 | ✅ |
| 8 | Merchant calls reset for another merchant's id | 403 | ✅ |

## Outstanding (out of scope)
- Surface platform-wide travel earnings on the existing AdminFeeManagement dashboard (data already in `transaction_fees`).
- Promote `service_type` to enum once airlines/trains onboarding goes live.
- Email template for the per-merchant clear action (currently only toast feedback).

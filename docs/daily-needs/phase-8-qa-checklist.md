# Phase 8 — Daily Needs Delivery Network (DDN) E2E QA Checklist

**Owner:** Logistics + Platform Eng  
**Goal:** Before opening Phase 9, every page, edge function, and merchant-driver workflow under DDN must pass this checklist.

---

## 1. Merchant onboarding (food / pharmacy)

- [ ] `/merchant/daily-needs` lists existing stores or shows the empty-state CTA cards.
- [ ] Clicking "Open a Food store" routes to `/merchant/daily-needs/new?vertical=food`.
- [ ] Clicking "Open a Pharmacy" routes to `/merchant/daily-needs/new?vertical=pharmacy`.
- [ ] Wizard step 1 rejects: name < 2 chars, slug with capitals/spaces, description > 1000 chars.
- [ ] Wizard step 2 rejects: empty address, malformed phone (`abc`), prep time outside 5–240, radius outside 0.5–50.
- [ ] Pharmacy step 3 rejects: no OTC and no Rx both off.
- [ ] Pharmacy step 4 rejects: empty pharmacist name / license, malformed pharmacist phone.
- [ ] Pharmacy step 5 rejects: missing license number, missing license upload, past expiry date.
- [ ] Save never sends empty strings or invalid dates to `daily-needs-store-upsert` (verified via Network panel).
- [ ] Submit for verification flips badge to `pending` and navigates back to `/merchant/daily-needs`.

## 2. Merchant DDN management pages

- [ ] `/merchant/daily-needs/deliveries` loads with tabs (Active / Completed / All) and accurate counts.
- [ ] Realtime: triggering a status change in DB updates the list without a manual refresh.
- [ ] `/merchant/daily-needs/drivers` shows owned drivers; "Invite a driver" copies a working link.
- [ ] `/merchant/daily-needs/delivery-settings` saves all advanced rules (mode, radius, max radius, fees, surge, min/max fee, operating hours, accept outside hours, auto-assign).
- [ ] Settings validation blocks: max_radius < radius, max_fee < min_fee, surge outside 0.5–5, close ≤ open.
- [ ] Nav under "Daily Needs" group shows Stores, New Store, Deliveries, Drivers, Delivery Settings, Pharmacy Reviews.

## 3. Driver workflow

- [ ] `/app/driver` requires driver role (DriverGuard) and shows online/offline/paused toggle.
- [ ] `/app/driver/register` accepts a new rider and persists to `ddn_drivers`.
- [ ] Going online begins GPS push via `navigator.geolocation.watchPosition`.
- [ ] An incoming offer surfaces with TTL countdown; accept calls `ddn-offer-respond` and navigates to `/app/driver/active/:id`.
- [ ] Pickup confirmation calls `ddn-pickup-confirm` → assignment becomes `on_the_way`, order becomes `picked_up` then `on_the_way`.
- [ ] Delivery code mismatch returns a clear error and allows resend via `ddn-deliver-code-resend` (rate-limited 3/assignment, 8/h).
- [ ] Code match calls `ddn-deliver-verify` → status `delivered`, `ddn_settle_delivery` runs once.
- [ ] `/app/driver/payouts` lists the settlement with reference + status.

## 4. Edge function contracts

- [ ] `ddn-dispatch` is idempotent (replay returns existing assignment).
- [ ] `ddn-dispatch` enforces operating hours (returns `outside_operating_hours` when closed unless `accept_outside_hours`).
- [ ] `ddn-dispatch` enforces `max_radius_km` (returns `outside_max_radius` when distance > cap).
- [ ] `ddn-dispatch` applies surge, min_fee, max_fee correctly to the computed delivery fee.
- [ ] `ddn-offer-respond` accept/decline rejects when offer is no longer `offered`.
- [ ] `ddn-pickup-confirm` rejects non-assigned drivers (403).
- [ ] `ddn-deliver-verify` rejects with 409 if assignment is not in `picked_up`/`on_the_way`/`arriving`.

## 5. Merchant notifications

- [ ] `ddn.assignment.created` inserted in `app_notifications` on dispatch.
- [ ] `ddn.assignment.accepted` inserted when a driver accepts.
- [ ] `ddn.assignment.picked_up` inserted when the driver confirms pickup.
- [ ] `ddn.delivery.verified` + `ddn.settlement.completed` inserted on code verification.
- [ ] Each row uses `idempotency_key` so re-runs don't duplicate.

## 6. Customer tracking

- [ ] `/customer-app/orders/:id/track` shows live map (`LiveDeliveryMap`) and code card (`DeliveryCodeCard`).
- [ ] ETA stabilises via `useSmoothedEta` (no flicker on noisy GPS).
- [ ] Status transitions visible without page refresh (realtime subscription on `ddn_assignments`).

## 7. Data + security

- [ ] RLS in place on every `ddn_*` table — merchants see only their assignments; drivers see only theirs.
- [ ] All edge functions validate JWT and reject unauthenticated requests with 401.
- [ ] All inputs validated with zod; UUIDs matched against regex.

## 8. Automated guards

- [ ] `src/test/ddn-phase8-smoke.test.ts` passes locally (`bunx vitest run ddn-phase8`).
- [ ] No console errors on the three new merchant pages in dev.
- [ ] Build succeeds (no TypeScript errors in any DDN file).

---

## Sign-off

Phase 8 is closed when every checkbox above is ticked. Phase 9 (analytics + cohort fees) starts only after sign-off.

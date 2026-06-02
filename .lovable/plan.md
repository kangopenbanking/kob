
# Daily Needs Delivery Network (DDN)

A dedicated, independent on-demand delivery system for Food & Pharmacy only.
**Zero coupling to Kang Transport** (no trips, routes, seats, coach tables). Shares only auth, wallet, KYC, and notifications.

## Scope guardrails

- New namespace: `ddn_*` tables and `ddn-*` edge functions. The existing `daily_needs_drivers` / `daily_needs_delivery_assignments` (created in Phase 7) are migrated into the DDN namespace and kept as the foundation — no Transport tables touched.
- Three modes: **Merchant fleet**, **DDN fleet**, **Hybrid** (default — merchant first, DDN fallback in <5 s).
- Driver UX surfaces inside the existing Customer PWA as a new section (`/app/driver`) — no separate app build.

---

## 1. Architecture (text diagram)

```text
Customer PWA            Merchant Dashboard         Driver Surface (in Customer PWA)
   │ place order            │ accept/prepare/ready      │ online/offline
   ▼                        ▼                           ▼
        ┌───────────────────────────────────────────────────┐
        │   Edge Functions (ddn-*)                          │
        │   order-transition → dispatcher → assignment      │
        │   pickup/deliver/code-verify → settle → wallet    │
        └───────────────────────────────────────────────────┘
                 │ Postgres RPC (SECURITY DEFINER)
                 ▼
        ddn_drivers · ddn_driver_locations · ddn_assignments
        ddn_assignment_offers · ddn_delivery_proofs · ddn_driver_wallets
        ddn_merchant_delivery_settings · ddn_driver_earnings
                 │
                 ▼  Realtime → consumer track page + driver app + merchant board
```

Settlement plugs into the existing **escrow → merchant wallet** flow (Phase 6); driver share is split off at `delivered` and credited to `ddn_driver_wallets`.

---

## 2. Database schema (new — all RLS + GRANT)

| Table | Purpose |
|---|---|
| `ddn_drivers` | One row per driver. Mode = `merchant`/`platform`. KYC + approval status. |
| `ddn_driver_locations` | Latest lat/lng + heading + updated_at per driver. Replaces ad-hoc cols. |
| `ddn_driver_status_log` | Online/Offline/Busy/Delivering/Paused state transitions. |
| `ddn_merchant_delivery_settings` | radius_km, base_fee, per_km_fee, prep_min, mode (`merchant`/`platform`/`hybrid`), auto_assign. |
| `ddn_assignments` | One row per delivery (FK to `daily_needs_orders`). Driver, status, pickup/drop coords, ETA. |
| `ddn_assignment_offers` | Offers sent to drivers with TTL. Accept/Decline/Timeout audit. |
| `ddn_delivery_proofs` | Delivery code, photo URL, GPS, timestamp, customer confirmation. |
| `ddn_driver_wallets` | available_xaf, pending_xaf per driver. |
| `ddn_driver_earnings` | Per-delivery ledger: delivery_fee, platform_fee, driver_earnings. |

Realtime publication: `ddn_assignments`, `ddn_driver_locations`, `ddn_assignment_offers`.

---

## 3. Edge functions (new, additive)

| Function | Trigger | Responsibility |
|---|---|---|
| `ddn-driver-register` | Driver sign-up | Create `ddn_drivers` row in `pending_kyc`. |
| `ddn-driver-status` | Driver toggles online/offline | Update status + heartbeat (PostgREST RLS-safe). |
| `ddn-driver-location` | 15 s heartbeat | Upsert `ddn_driver_locations`. |
| `ddn-dispatch` | Called by `daily-needs-order-transition` on `ready` | Run assignment engine. |
| `ddn-offer-respond` | Driver accept/decline | Move assignment to next candidate on decline/timeout. |
| `ddn-pickup-confirm` | Driver at merchant | Mark `picked_up`, record GPS. |
| `ddn-deliver-verify` | Driver at customer | Verify 6-digit code → `delivered` → release escrow + credit driver wallet. |
| `ddn-merchant-driver-manage` | Merchant CRUD on own drivers | Add/remove/activate/deactivate. |
| `ddn-driver-payout` | Driver withdrawal | Move available → external payout (reuse `gateway_payouts`). |

The existing `daily-needs-assign-driver` becomes a thin wrapper that delegates to `ddn-dispatch`. The external-provider stub is removed (Mode A/B/C only, no Glovo/Uber Direct).

---

## 4. Assignment engine

Single SQL function `ddn_find_eligible_driver(order_id, radius_km)` that ranks by:

1. Mode policy (Merchant → DDN fallback for `hybrid`).
2. Distance (Haversine).
3. Coverage area contains pickup point.
4. `status = 'online'`, not at concurrent-job cap.
5. Vehicle type compatible with order weight class.
6. Rating DESC, last-assignment-time ASC (fairness).

Dispatcher loop (max 5 s wall time, async via Realtime offers):

```text
for candidate in top_n(8):
  insert ddn_assignment_offers(driver, ttl=20s)
  await accept | decline | timeout
  if accepted -> assignment.driver_id, status='accepted'; break
```

If exhausted: notify merchant, mark `assignment_failed` so they can retry or manually assign.

---

## 5. Customer tracking experience (Phase 8 polish)

Single `DailyNeedsOrderTrack` page upgrade:

- Hero status with friendly labels (Accepted → Preparing → Driver Assigned → On The Way → Arriving → Delivered).
- Live Mapbox-style canvas using existing Google Maps connector (browser key already in env): driver marker, pickup pin, drop pin, animated polyline.
- ETA chip computed from driver location + Google Routes API (via gateway).
- Delivery code card (large, copy-to-clipboard).
- Driver mini-card (photo, name, vehicle, call button — masked number via Edge Function).

All updates via existing Supabase Realtime channel on `daily_needs_orders` + new `ddn_driver_locations` filtered by assigned driver.

---

## 6. Driver surface (inside Customer PWA)

Four screens only, mounted at `/app/driver/*`:

- **Home** — Online toggle, today's earnings, next offer modal.
- **Active Deliveries** — Current job stepper (Navigate to merchant → Pickup → Navigate to customer → Verify code).
- **Earnings** — Wallet balance, history, payout button.
- **Profile** — KYC status, vehicle, coverage area.

Bottom nav swaps to driver-mode when `ddn_drivers.is_active = true` and user opts in.

---

## 7. Merchant delivery settings

New tab on `MerchantDailyNeedsOnboarding`: delivery radius, fee schedule, prep time, mode toggle, own-driver roster (Mode A CRUD).

---

## 8. Risk assessment

| Risk | Mitigation |
|---|---|
| Driver pool empty at launch | `hybrid` mode falls back to merchant fleet; merchant can still self-deliver. |
| Concurrent offers to same driver | Unique partial index `(driver_id, status='offered')`. |
| Code-verify replay | One-time hash + `delivered_at` immutable check. |
| Location privacy | Driver location only visible while assignment is `accepted`–`delivered`; RLS scoped. |
| Settlement double-credit | Reuses Phase 6 atomic escrow RPCs with `idempotency_key`. |
| Confusion with Transport | Distinct `ddn_*` namespace, no FKs to `trips`/`vehicles`/`routes`. |

---

## 9. Delivery plan (incremental, non-breaking)

1. **DB foundation** — new `ddn_*` tables, GRANTs, RLS, realtime, RPCs. Phase 7 tables remain; new ones supersede in code.
2. **Dispatch engine + edge functions** — `ddn-dispatch`, offers, accept/decline.
3. **Driver surface** in Customer PWA (`/app/driver`).
4. **Merchant delivery settings** + own-driver CRUD.
5. **Customer live tracking** upgrade (Phase 8 deliverable: map + code card + driver card).
6. **Driver wallet + earnings** (reuses payout rail).
7. **Cutover**: `daily-needs-assign-driver` delegates to `ddn-dispatch`; remove external-provider stub.

Each step ships behind no flag — purely additive routes/functions — so nothing in Transport, Travel, POS, or existing Daily Needs flows changes behaviour.

---

## 10. Technical specifics

- **Stack:** Postgres + RLS, Supabase Edge Functions (Deno), React + shadcn, Google Maps connector (already linked) for routing/ETA.
- **Realtime channels:** `dn-order-{id}` (existing), `ddn-driver-{id}`, `ddn-merchant-{merchantId}`.
- **Idempotency:** every state-changing function requires UUID v4 `idempotency_key`, row-level `FOR UPDATE` locks.
- **No new secrets required** — Google Maps already configured; no third-party logistics provider.

---

Confirm and I'll start with **Step 1 (DB foundation migration)** and then proceed step-by-step. Want me to also retire the Phase 7 external-shipping stub and secrets (`DN_SHIPPING_*`) as part of step 7, or keep them dormant?

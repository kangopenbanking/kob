# Daily Needs — Food & Pharmacy Marketplace

A new **Commerce Layer** inside Kang called **Daily Needs**, additive to all existing modules. Two verticals only: **Food Delivery** and **Pharmacy**. Reuses Wallet, KYC, Transport, WooCommerce, Notifications, and Design System. Nothing existing is replaced or rewritten.

This is a very large scope (10 phases, ~6 surfaces: consumer, merchant, driver, admin, public site, APIs). I'll deliver it incrementally across multiple turns and pause for your approval between phases. This first plan covers **Phase 1 (Audit) + Phase 2 (Foundation)**, with the remaining phases scoped at a high level so you can see the whole picture.

---

## Phase 1 — Architecture Audit (deliverable: report, no code)

I'll produce `docs/daily-needs/impact-assessment.md` covering:

- **Reusable components**: shadcn primitives, `Layout`, `CustomerAppLayout`, `CustomerBottomNav`, `MerchantLayout`, `PinConfirmDialog`, `useRealtimeBalanceSync`, `useConsumerWebhookEvents`, KOBApiClient, gateway-charge flow.
- **Wallet hooks**: confirm `wallets`, `gateway_charges`, escrow/release path, `kob_pos_pay` QR semantics — Daily Needs orders settle via existing escrow `funds_held → released_on_delivery`.
- **WooCommerce**: 6 functions (`woocommerce-*`) + 2 (`pos-woo-*`). Daily Needs **extends** `pos_products` with vertical metadata; does NOT fork.
- **Transport**: reuse existing driver assignment + tracking tables (`trips`, driver assignment edge fn). Daily Needs orders create a `delivery_task` linked to a trip.
- **Notifications**: Resend + OneSignal already wired; add 7 new templates.
- **Nav**: `bottom_nav_items` is admin-configurable — add one "Daily Needs" entry without touching defaults; merchant sidebar gets a "Daily Needs" track under "Accept Payments".
- **Risks**: ratchet rule on OpenAPI (additive only, minor bump), RLS on every new table, no changes to `auth.*` / `storage.*` / financial mutation paths.

## Phase 2 — Daily Needs Foundation (DB + routing + empty surfaces)

### New tables (all `public`, all with GRANTs + RLS, all FK to `gateway_merchants.id`)

```text
daily_needs_stores            (vertical: food|pharmacy, status, hours, radius_km, prep_time_min, banner_url, logo_url)
daily_needs_categories        (store_id, name, position)
daily_needs_products          (store_id, category_id, name, price_xaf, stock, is_otc, requires_prescription, attributes jsonb)
daily_needs_product_images    (product_id, url, position)
daily_needs_carts             (user_id, store_id) + daily_needs_cart_items
daily_needs_orders            (user_id, store_id, status enum, total_xaf, delivery_fee_xaf, service_fee_xaf, charge_id → gateway_charges, delivery_code, prescription_url, escrow_status)
daily_needs_order_items
daily_needs_order_status_history   (immutable)
daily_needs_delivery_assignments   (order_id, trip_id, driver_id, pickup_at, delivered_at)
```

Enums: `dn_vertical`, `dn_store_status`, `dn_order_status` (received, accepted, preparing, ready, picked_up, on_the_way, arriving, delivered, cancelled, refunded), `dn_prescription_status`.

### Edge functions (additive)

- `daily-needs-store-upsert` — merchant CRUD via router
- `daily-needs-order-create` — atomic: lock wallet, create order, escrow via `gateway_charges` (idempotency_key required)
- `daily-needs-order-transition` — state machine, validates actor (merchant/driver/customer code)
- `daily-needs-assign-driver` — calls existing transport assignment fn
- `daily-needs-prescription-review` — pharmacist approval
- `daily-needs-search` — full-text over stores + products

All use existing `corsHeaders`, `supabase.auth.getUser()`, SECURITY DEFINER helpers, structured error envelope.

### Routing

- Consumer: `/app/daily-needs`, `/app/daily-needs/food`, `/pharmacy`, `/store/:id`, `/cart`, `/checkout`, `/orders/:id/track`
- Merchant: `/merchant/daily-needs` (onboarding flow), `/merchant/daily-needs/menu`, `/orders`, `/settings`
- Public site: feature card on homepage + `/daily-needs` marketing page
- Admin: `/admin/daily-needs` (stores, orders, prescription queue)

### Navigation integration (non-disruptive)

- Consumer bottom nav: insert via `bottom_nav_items` seed (admin can hide). If no slot — surface as a **prominent home card** on `/app/home` instead. Default: home card; bottom nav slot opt-in.
- Merchant sidebar: new "Daily Needs" entry inside existing "Accept Payments" track.
- Public homepage: add Daily Needs feature card alongside existing modules.

---

## Phases 3–10 (high-level, delivered after Phase 2 approval)

| Phase | Scope |
|-------|-------|
| 3 | Food marketplace — restaurant list, menu, cart, checkout, Just-Eat-style listings |
| 4 | Pharmacy — OTC vs prescription split, upload, pharmacist review queue |
| 5 | Merchant onboarding flow (native form-wizard) + WooCommerce extension (vertical metadata sync, opening hours, radius, prep time) |
| 6 | Wallet escrow settlement (reuse `gateway_charges` + release on `delivered`) |
| 7 | Transport integration (trip created on `ready`, driver app surfaces task) |
| 8 | Live tracking (Realtime channel on `daily_needs_orders` + delivery_code confirmation) |
| 9 | Performance — lazy routes, image CDN, query prefetch, skeletons |
| 10 | UX polish — micro-animations, empty states, a11y, copy, dark mode parity |

## Files (Phase 1 + 2 only)

**Created**
- `docs/daily-needs/impact-assessment.md`
- `supabase/migrations/<ts>_daily_needs_foundation.sql`
- `supabase/functions/daily-needs-store-upsert/index.ts`
- `supabase/functions/daily-needs-order-create/index.ts`
- `supabase/functions/daily-needs-order-transition/index.ts`
- `supabase/functions/daily-needs-search/index.ts`
- `src/pages/customer-app/DailyNeedsHome.tsx` (shell)
- `src/pages/customer-app/DailyNeedsFood.tsx` (shell)
- `src/pages/customer-app/DailyNeedsPharmacy.tsx` (shell)
- `src/pages/merchant/MerchantDailyNeeds.tsx` (shell)
- `src/pages/admin/AdminDailyNeeds.tsx` (shell)
- `src/pages/DailyNeedsMarketing.tsx` (public)
- `src/components/daily-needs/*` (StoreCard, OrderStatusTimeline, CheckoutSummary — reusing shadcn)

**Edited**
- `src/App.tsx` (routes)
- `src/components/merchant/MerchantLayout.tsx` (sidebar entry)
- `src/pages/Index.tsx` or homepage features section (feature card)
- `src/components/customer-app/CustomerAppLayout.tsx` (home card or nav)
- OpenAPI spec (additive, minor version bump per Standing Order 6)
- Changelog (per Order P7)

## Guardrails honored

- No edits to wallet/savings/transfer/KYC/auth/storage code paths.
- All financial state changes via edge functions with idempotency keys + row locks.
- All new tables: GRANTs + RLS + `has_role` checks.
- OpenAPI additive only, version bump, audit citation in commit.
- Public routes never gated.

---

**Confirm to proceed with Phase 1 (audit report) + Phase 2 (foundation: migration + edge fn skeletons + route shells).** I'll pause after Phase 2 for review before building Phases 3+.

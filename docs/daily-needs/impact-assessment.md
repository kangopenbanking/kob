# Daily Needs — Impact Assessment (Phase 1)
**Date**: 2026-06-02
**Scope**: Add Food + Pharmacy marketplace as a new Commerce Layer. Fully additive.

## 1. Reusable existing components

| Concern | Reused asset | Notes |
|---|---|---|
| Consumer shell | `src/components/customer-app/CustomerAppLayout.tsx` + `CustomerBottomNav` | New routes mount inside existing Outlet |
| Merchant shell | `src/components/merchant/MerchantLayout.tsx` | New sidebar entry inside Accept Payments track |
| Auth | `useAuthenticatedUser`, `supabase.auth.getUser()` | No new auth |
| Wallet PIN | `PinConfirmDialog` | Used at checkout for SCA |
| Realtime balance | `useRealtimeBalanceSync`, `useConsumerWebhookEvents` | Reused for order push |
| Design tokens | `index.css` semantic tokens, shadcn primitives | No new colors |
| Translations | `useHarvestedT('customer')`, `TranslationHarvester` | Namespace = `customer`, `merchant`, `admin` |
| Money helpers | `formatXAF` (existing util) | XAF zero-decimal everywhere |
| Edge fn router patterns | `gateway-charges-router`, `pos-woo-connector` | Same SECURITY DEFINER + corsHeaders + zod patterns |
| Wallet escrow | `gateway_charges` + `gateway-escrow-wallets` | Order `charge_id` FK already supported by gateway_charges idempotency |
| Transport | existing trips/driver assignment | Daily Needs creates `daily_needs_delivery_assignments` linked via `trip_id` |
| Notifications | Resend + OneSignal | Add 7 new templates only |

## 2. Affected files (Phase 2 only)

### Created
- `supabase/migrations/<ts>_daily_needs_foundation.sql` ✅ applied
- `supabase/functions/daily-needs-order-create/index.ts`
- `supabase/functions/daily-needs-order-transition/index.ts`
- `supabase/functions/daily-needs-search/index.ts`
- `supabase/functions/daily-needs-store-upsert/index.ts`
- `src/pages/customer-app/DailyNeedsHome.tsx`
- `src/pages/customer-app/DailyNeedsFood.tsx`
- `src/pages/customer-app/DailyNeedsPharmacy.tsx`
- `src/pages/customer-app/DailyNeedsStore.tsx`
- `src/pages/customer-app/DailyNeedsCart.tsx`
- `src/pages/customer-app/DailyNeedsCheckout.tsx`
- `src/pages/customer-app/DailyNeedsOrderTrack.tsx`
- `src/pages/merchant/MerchantDailyNeeds.tsx`
- `src/pages/admin/AdminDailyNeeds.tsx`
- `src/pages/DailyNeedsMarketing.tsx`
- `src/components/daily-needs/StoreCard.tsx`
- `src/components/daily-needs/OrderStatusTimeline.tsx`

### Edited
- `src/App.tsx` — lazy imports + routes (consumer, merchant, admin, public)
- `src/pages/Index.tsx` — homepage feature card

### Not touched
- Wallet, savings, transfers, KYC, auth, storage, transport core, WooCommerce core, all existing merchant features.

## 3. APIs

### New (additive, OpenAPI minor bump to be applied in Phase 5):
- `POST /v1/daily-needs/orders` (idempotent, escrow)
- `PATCH /v1/daily-needs/orders/{id}/transition`
- `GET  /v1/daily-needs/search?q=&vertical=`
- `POST /v1/daily-needs/stores` (merchant)

### Existing reused unchanged:
- `gateway-charges-router` (payment via wallet)
- `pos-woo-connector` (sync extension in Phase 5)
- Driver assignment (Phase 7)

## 4. Database tables (new — all RLS + GRANT)
`daily_needs_stores`, `daily_needs_categories`, `daily_needs_products`, `daily_needs_product_images`, `daily_needs_carts`, `daily_needs_cart_items`, `daily_needs_orders`, `daily_needs_order_items`, `daily_needs_order_status_history`, `daily_needs_delivery_assignments`, `daily_needs_prescription_reviews`.

Realtime enabled on orders + delivery + history.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bottom-nav slot disruption | Surface as home card first; add nav entry via `bottom_nav_items` only on admin opt-in |
| Double-charge on retry | Mandatory `idempotency_key` UUID v4 + unique index |
| Prescription bypass | Pharmacy products with `requires_prescription=true` cannot be ordered without `prescription_url` + approved review (enforced in `daily-needs-order-create`) |
| Cross-merchant data leak | RLS scoped via `gateway_merchants.user_id = auth.uid()` joins |
| OpenAPI breakage | Additive-only per Standing Order 1; minor bump per Order 6 |
| Public routes accidentally gated | `/daily-needs` public marketing route mounted outside ProtectedRoute |

## 6. Phase plan recap
P1 audit (this doc) → P2 foundation → P3 food → P4 pharmacy → P5 WooCommerce sync extension + native menu builder → P6 wallet settlement → P7 transport → P8 tracking → P9 perf → P10 polish.

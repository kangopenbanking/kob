# WooCommerce + Storefront Checkout — E2E Audit (Round 2)
**Date**: 2026-04-19  
**Scope**: Plugin lifecycle, product import, admin demo-data management, fee management (incl. Enterprise packages), consumer storefront checkout & shipping.

## Summary
| Area | Status | Notes |
|------|--------|-------|
| Legacy plugin (register/validate/payment/webhook/sync/download) | ✅ All 5 edge functions live | Round-1 audit |
| POS Woo connector (connect/import/push/disconnect + webhook ingest) | ✅ Live | Round-1 audit |
| Admin WooCommerce page | ✅ Hardened | Added unified header + "Clear Demo Data" |
| Demo data clearing | ✅ NEW | New `woocommerce-admin-clear-demo` edge function (admin-gated, scoped) |
| Fee mgmt — WooCommerce gateway fee | ✅ NEW | 1.8% + 50 XAF, capped 5,000 XAF |
| Fee mgmt — Enterprise packages | ✅ NEW | Starter 9,900 / Growth 24,900 / Scale 59,900 XAF monthly |
| Consumer storefront → cart → checkout | ✅ Hardened | Added shipping address capture + flat-rate shipping |
| Imported Woo products → consumer marketplace | ✅ Verified | Surfaces via `pos-store-browse` |

## Bugs Fixed
1. **Checkout had no shipping** — `pos_consumer_carts` and `pos_orders` lacked address columns; checkout total ignored shipping. Added 9 shipping columns (recipient, phone, address line, city, region, country, postal, notes, fee) to both tables.
2. **Cart edge function missing `set_shipping`** — added action to persist address before payment.
3. **Checkout did not snapshot shipping or include shipping_fee in total** — `pos-consumer-checkout` now reads `cart.shipping_*` and writes them onto `pos_orders` plus adds `shipping_fee` to total.
4. **Consumer cart UI had no address capture** — added inline form (recipient/phone/address/city/region) and shipping line in summary; pay button blocked until address complete.
5. **Fee management missing 4 transaction types** — `woocommerce_transaction`, `enterprise_subscription_starter|growth|scale`. Added to `fee_structures_transaction_type_check` constraint, inserted at `platform` scope, surfaced in `FeeStructuresTable` metadata under Gateway/Services categories.
6. **No admin demo-data cleanup** — created `woocommerce-admin-clear-demo` (admin/super_admin only), scoped delete: `legacy` (woocommerce_merchants + woocommerce_transactions), `pos_connector` (woo-source pos_products + variants/images/inventory/cart_items + integration mappings/runs/inbox + merchant_integrations), or `all`. Wired "Clear Demo Data" button on `/admin/woocommerce-plugin`.

## Enterprise Package Tiers (verified in DB)
| Package | transaction_type | Monthly (XAF) | Model |
|---------|------------------|---------------|-------|
| Starter | enterprise_subscription_starter | 9,900 | fixed |
| Growth | enterprise_subscription_growth | 24,900 | fixed |
| Scale | enterprise_subscription_scale | 59,900 | fixed |
| WooCommerce gateway | woocommerce_transaction | 1.8% + 50 (cap 5,000) | hybrid |

## Files Created/Edited
- `supabase/functions/woocommerce-admin-clear-demo/index.ts` (new)
- `supabase/functions/pos-consumer-cart/index.ts` (added `set_shipping` action)
- `supabase/functions/pos-consumer-checkout/index.ts` (shipping fee + snapshot in total/order)
- `src/pages/customer-app/CustomerCart.tsx` (delivery address form, shipping line, gated pay)
- `src/pages/admin/WooCommerceManagement.tsx` (header + Clear Demo Data button)
- `src/components/fee-management/FeeStructuresTable.tsx` (metadata for 4 new fee types)
- DB migration: shipping columns + fee constraint extension + 4 fee inserts

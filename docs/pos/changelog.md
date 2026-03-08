# POS Commerce Layer Changelog

## [2.0.0] — 2026-03-08 — QR Payments, Consumer Marketplace & Wallet Integration
- **New Tables**: `pos_store_profiles`, `pos_subscription_plans`, `pos_store_subscriptions`, `pos_consumer_carts`, `pos_consumer_cart_items`
- **Enum**: Added `consumer_app` to `pos_order_channel`
- **Edge Functions (New)**: `pos-store-browse`, `pos-consumer-cart`, `pos-consumer-checkout`, `pos-qr-payment`, `pos-store-subscription`
- **Edge Functions (Updated)**: `pos-pay-order` now supports `wallet` payment method with direct balance debit/credit
- **Consumer App**: New `/app/stores`, `/app/stores/:merchantId`, `/app/cart` pages; updated `CustomerScan` for `kob_pos_pay` QR codes; added "Stores" feature card to home
- **Features**: Merchant marketplace with subscription-gated storefront visibility, QR code generation/scanning for POS payments, wallet-to-wallet checkout, consumer cart management
- **RLS**: Full row-level security on all new tables with merchant ownership and consumer isolation policies
- **Breaking changes**: NONE

## [1.6.0] — 2026-03-08 — Inventory Sync Jobs + Conflict Handling
- **Endpoints**: `pos-inventory-sync` (POST)
- **Features**: Background inventory sync from KOB→WooCommerce, aggregates net stock deltas per variant, supports woo_source_of_truth and kob_source_of_truth strategies, records sync runs with full audit trail
- **Tests**: E2E edge function tests for all POS endpoints (auth guards, idempotency, webhook ingestion)
- **Breaking changes**: NONE

## [1.5.0] — 2026-03-08 — OpenAPI + Postman + Frontend Docs
- **Tags added**: POS, Catalog, Inventory, POS Payments, POS Refunds/Returns, WooCommerce Integration
- **Frontend**: Developer portal "Merchants → POS" guide with full API reference (10 sections, code samples, XAF examples)
- **Navigation**: E-Commerce sidebar section renamed to "E-Commerce & POS" with Merchants → POS link
- **Breaking changes**: NONE

## [1.4.0] — 2026-03-08 — Refunds/Returns + Restock + Woo Sync
- **Endpoints**: `pos-refunds` (POST/GET)
- **Features**: Full/partial refund with gateway refund integration, automatic inventory restock, WooCommerce refund sync for Woo-channel orders
- **Migrations**: Included in 1.1.0 (pos_returns, pos_return_items)
- **Breaking changes**: NONE

## [1.3.0] — 2026-03-08 — POS Orders + Payment Capture
- **Endpoints**: `pos-orders` (POST/GET), `pos-submit-order`, `pos-pay-order`, `pos-finalize-payment`
- **Features**: Draft→Submit→Pay flow, idempotency-key enforcement, multi-method payment (MoMo/Card/PayPal/Bank), webhook-driven finalization with inventory decrement, receipt generation
- **Migrations**: Included in 1.1.0 (pos_orders, pos_order_items, pos_order_payments, pos_order_status_history)
- **Breaking changes**: NONE

## [1.2.0] — 2026-03-08 — WooCommerce Connect + Import + Webhooks
- **Endpoints**: `pos-woo-connector` (connect/import_products/push_order/disconnect), `pos-woo-webhook-ingestion`
- **Features**: Store connection with credential validation, full/incremental product import with variant + stock mapping, HMAC-verified webhook ingestion with deduplication, order push to Woo
- **Migrations**: Included in 1.1.0 (merchant_integrations, integration_mappings, integration_sync_runs, integration_events_inbox)
- **Breaking changes**: NONE

## [1.1.0] — 2026-03-08 — POS Commerce Data Model + Core APIs
- **Endpoints**: `pos-catalog-products` (POST/GET/PATCH), `pos-inventory` (GET/POST), `pos-manage-locations` (locations + staff CRUD)
- **Tables created**: merchant_locations, merchant_pos_staff, pos_products, pos_product_variants, pos_categories, pos_product_category_links, pos_product_images, pos_inventory_items, pos_inventory_movements, pos_orders, pos_order_items, pos_order_status_history, pos_order_payments, pos_returns, pos_return_items, merchant_integrations, integration_mappings, integration_sync_runs, integration_events_inbox
- **Enums**: pos_product_source, pos_order_channel, pos_order_status, pos_payment_status, pos_return_status, inventory_movement_type, integration_type, integration_status, integration_entity_type, sync_run_status, inbox_event_status, pos_staff_role
- **Functions**: is_merchant_owner, is_pos_staff, pos_adjust_inventory (atomic)
- **RLS**: Full merchant-scoped policies on all 19 tables
- **Breaking changes**: NONE

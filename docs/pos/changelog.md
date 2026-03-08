# POS Commerce Layer Changelog

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

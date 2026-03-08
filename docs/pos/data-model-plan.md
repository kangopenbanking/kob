# POS Data Model Plan
**Date**: 2026-03-08

## Design Principles
1. **Additive only** — no modifications to existing tables
2. **gateway_merchants as identity** — POS tables FK to `gateway_merchants.id` (not a new merchant table)
3. **XAF default** — all currency columns default to 'XAF'
4. **Immutable audit trails** — `inventory_movements` and `order_status_history` are append-only
5. **Idempotency** — `order_payments` links to `gateway_charges` which already has idempotency_key

## Entity Relationship Summary

```
gateway_merchants (existing)
  ├── merchant_locations (1:N)
  │     └── inventory_items (1:N per location+variant)
  ├── merchant_pos_staff (1:N)
  ├── pos_products (1:N)
  │     ├── pos_product_variants (1:N)
  │     │     └── inventory_movements (1:N, immutable)
  │     ├── pos_product_categories (M:N via link table)
  │     └── pos_product_images (1:N)
  ├── pos_categories (1:N, self-referencing)
  ├── pos_orders (1:N)
  │     ├── pos_order_items (1:N)
  │     ├── pos_order_payments (1:N → gateway_charges)
  │     └── pos_order_status_history (1:N, immutable)
  ├── pos_returns (1:N → pos_orders)
  │     └── pos_return_items (1:N → pos_order_items)
  ├── merchant_integrations (1:N)
  │     ├── integration_mappings (1:N)
  │     ├── integration_sync_runs (1:N)
  │     └── integration_events_inbox (1:N, deduped)
```

## Table Prefix Convention
All new POS tables use `pos_` prefix to avoid naming collisions, except:
- `merchant_locations` — shared concept
- `merchant_pos_staff` — POS-specific staff
- `merchant_integrations` — integration config
- `integration_*` — integration sync tables

## Enums (New)
- `pos_product_source`: manual, woocommerce
- `pos_order_channel`: pos, woocommerce, api
- `pos_order_status`: draft, pending_payment, paid, processing, completed, cancelled, refunded, partially_refunded, failed
- `pos_payment_status`: initiated, pending, succeeded, failed, cancelled, refunded, partial_refund
- `pos_return_status`: requested, approved, rejected, processed
- `inventory_movement_type`: sale, refund, manual_adjust, sync_adjust, transfer_in, transfer_out
- `integration_type`: woocommerce
- `integration_status`: connected, disconnected, error
- `integration_entity_type`: product, variant, order, customer
- `sync_run_status`: running, success, failed
- `inbox_event_status`: received, processed, ignored, failed
- `pos_staff_role`: merchant_admin, merchant_manager, cashier

## RLS Strategy
- All POS tables: merchant owner (via `gateway_merchants.user_id = auth.uid()`) can CRUD
- Staff access: via `merchant_pos_staff` membership check
- Admin: full access via `has_role(auth.uid(), 'admin')`
- Integration webhooks: service_role only (no JWT)

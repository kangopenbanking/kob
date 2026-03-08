# POS Route Inventory
**Date**: 2026-03-08

## Existing Routes (DO NOT CONFLICT)

### WooCommerce (Live)
- `woocommerce-register-merchant` — POST
- `woocommerce-process-payment` — POST
- `woocommerce-payment-webhook` — POST
- `woocommerce-transaction-sync` — GET
- `woocommerce-validate-install` — POST/GET
- `woocommerce-download-plugin` — GET

### Gateway (Live — 100+ functions)
- `gateway-create-charge` through `gateway-*` (all prefixed)

## New POS Routes (Planned)

### Catalog Management
- `pos-create-product` — POST
- `pos-list-products` — GET
- `pos-update-product` — PATCH
- `pos-create-variant` — POST
- `pos-update-variant` — PATCH

### Inventory
- `pos-list-inventory` — GET
- `pos-adjust-inventory` — POST

### Orders
- `pos-create-order` — POST
- `pos-get-order` — GET
- `pos-list-orders` — GET
- `pos-update-order` — PATCH
- `pos-submit-order` — POST
- `pos-pay-order` — POST

### Refunds/Returns
- `pos-create-refund` — POST
- `pos-list-refunds` — GET

### WooCommerce Integration (New)
- `pos-woo-connect` — POST
- `pos-woo-import-products` — POST
- `pos-woo-webhook-ingestion` — POST
- `pos-woo-push-order` — POST

### Locations & Staff
- `pos-manage-locations` — CRUD
- `pos-manage-staff` — CRUD
- `pos-staff-pin-auth` — POST

## Route Conflict Check
✅ No conflicts detected. All new routes use `pos-` prefix, distinct from existing `gateway-*` and `woocommerce-*` namespaces.

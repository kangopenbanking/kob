# Merchants → POS Documentation

## Overview
The KOB POS Commerce Layer enables merchants to manage products, inventory, orders, and payments through a unified API. It supports two channels:
- **POS** — Direct point-of-sale transactions (in-store, online)
- **WooCommerce** — Bidirectional sync with WooCommerce stores

**Default currency**: XAF (Central African CFA franc)  
**Default country**: Cameroon (CM)

---

## 1. Setup: Locations & Staff

### Create a Location
```bash
curl -X POST "${BASE_URL}/pos-manage-locations?entity=location" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your-merchant-id",
    "name": "Main Store Douala",
    "city": "Douala",
    "country": "CM"
  }'
```

### Add POS Staff
```bash
curl -X POST "${BASE_URL}/pos-manage-locations?entity=staff" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your-merchant-id",
    "user_id": "staff-user-id",
    "role": "cashier",
    "pin": "1234"
  }'
```

---

## 2. Connect WooCommerce Store

```bash
curl -X POST "${BASE_URL}/pos-woo-connector" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "connect",
    "merchant_id": "your-merchant-id",
    "store_url": "https://your-store.com",
    "consumer_key": "ck_...",
    "consumer_secret": "cs_...",
    "default_location_id": "location-uuid"
  }'
```

**Response** includes `webhook_secret` and `webhook_url` — configure these in WooCommerce → Settings → Advanced → Webhooks.

---

## 3. Import Products from WooCommerce

```bash
curl -X POST "${BASE_URL}/pos-woo-connector" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "import_products",
    "merchant_id": "your-merchant-id",
    "mode": "full",
    "include": "both",
    "merge_strategy": "woo_source_of_truth"
  }'
```

**Merge strategies**:
- `woo_source_of_truth` (default) — WooCommerce data overwrites KOB
- `kob_source_of_truth` — KOB data preserved; Woo updates skipped
- `manual_conflict_review` — Conflicts flagged for manual resolution

---

## 4. Manual Products & Inventory

### Create Product
```bash
curl -X POST "${BASE_URL}/pos-catalog-products" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your-merchant-id",
    "name": "Café Camerounais",
    "currency": "XAF",
    "variants": [
      { "name": "Small", "price": 500, "sku": "CAF-SM" },
      { "name": "Large", "price": 1000, "sku": "CAF-LG" }
    ]
  }'
```

### Adjust Inventory
```bash
curl -X POST "${BASE_URL}/pos-inventory" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your-merchant-id",
    "variant_id": "variant-uuid",
    "location_id": "location-uuid",
    "quantity_delta": 50,
    "type": "manual_adjust",
    "reason": "Initial stock"
  }'
```

---

## 5. POS Orders Flow

### Step 1: Create Draft Order
```bash
curl -X POST "${BASE_URL}/pos-orders" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your-merchant-id",
    "location_id": "location-uuid",
    "items": [
      { "variant_id": "variant-uuid", "quantity": 2 }
    ],
    "customer": { "name": "Jean Dupont", "phone": "+237670000000" }
  }'
```

### Step 2: Submit Order
```bash
curl -X POST "${BASE_URL}/pos-submit-order" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "order_id": "order-uuid" }'
```

### Step 3: Pay Order
```bash
curl -X POST "${BASE_URL}/pos-pay-order" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid",
    "method": "mobile_money",
    "customer": { "phone": "+237670000000" }
  }'
```

**Supported methods**: `mobile_money`, `card`, `bank_transfer`, `paypal`

### Step 4: Payment Finalization
Payment is finalized automatically via provider webhooks (Flutterwave/Stripe/PayPal). On success:
- Order status → `paid`
- Inventory decremented automatically
- Receipt payload generated

---

## 6. Refunds & Restocking

```bash
curl -X POST "${BASE_URL}/pos-refunds" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Idempotency-Key: refund-key-456" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid",
    "items": [
      { "order_item_id": "item-uuid", "quantity": 1, "restock": true }
    ],
    "reason": "Customer return"
  }'
```

- **restock: true** automatically adjusts inventory
- **WooCommerce orders** are synced back to the Woo store
- Supports `provider_refund` (default) and `manual_refund`

---

## 7. Inventory Sync Strategy

| Strategy | POS Sale | Woo Stock Change |
|----------|----------|------------------|
| `woo_source_of_truth` | Updates local → queued push to Woo | Webhook updates local via sync_adjust |
| `kob_source_of_truth` | Updates local only | Ignored |

All changes create immutable `inventory_movements` records for full audit trail.

---

## 8. Webhook Security

### Inbound (Woo → KOB)
- HMAC-SHA256 signature verified via `x-wc-webhook-signature` header
- Events deduplicated by `x-wc-webhook-delivery-id`
- Failed events recorded in `integration_events_inbox` with retry capability

### Outbound (KOB → Merchant)
- Existing gateway webhook infrastructure applies
- HMAC-SHA256 signed payloads

---

## 9. Expansion Readiness

The data model is designed for future expansion:
- **Multiple locations** with per-location inventory
- **Staff roles** (admin, manager, cashier) with PIN-based quick auth
- **Device registry** (planned) for physical tills and card readers
- **Multi-country** support via capability flags (currently CM/XAF default)

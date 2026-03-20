

# Merchant Storefront (`/merchant/storefront`) — Full E2E Audit Report

## Module Overview

The storefront page is a 1,172-line component with **11 tabs**: Setup Guide, Profile, Products, Attributes, Plans/Subscription, QR Pay, Preview, Shipping, Integrations (WooCommerce), Demo, and Enterprise. It uses 10 child components across `src/components/storefront/`.

---

## Tab-by-Tab Audit Results

### Tab 1: Setup Guide ✅ PASS
- 7 expandable steps render correctly with tips
- "Go to this step" buttons navigate to correct tabs
- Sidebar with Quick Tips and POS image renders
- **No gaps found**

### Tab 2: Store Profile ✅ PASS (with 2 issues)
- Store name, category, description, country, city, logo, banner all render and bind
- Country change auto-updates currency
- City dropdown grouped by region
- Sub-category selector with custom option works in UI
- Image upload uses `storefront-assets` bucket with 5MB limit
- Publish toggle + Save button works

**Issues found:**
| # | Severity | Issue |
|---|----------|-------|
| P1 | **MEDIUM** | **Sub-category not persisted.** `subCategory` and `customSubCategory` state is never included in the `handleSave` payload (line 147-151). The `pos_store_profiles` table has no `sub_category` column. UI collects the data but discards it on save. |
| P2 | **LOW** | **Custom attributes not persisted.** `customAttributes` state is local-only (line 98). Adding/removing custom attributes is never saved to the database. Reloading the page loses all custom attributes. |

### Tab 3: Products ✅ PASS
- Loads from `pos_products` with variants, filtered by `merchant_id`
- Search by name works (ilike)
- Refresh button reloads data
- Empty state shown when no products
- Shows product count, lowest variant price, image thumbnails
- **No create/edit product UI** — this is intentional (products are managed via POS Till or WooCommerce import)
- **No gap** — read-only catalog view is correct for this context

### Tab 4: Attributes ✅ PASS (with 1 issue)
- Standard POS attributes listed from `POS_PRODUCT_ATTRIBUTES` constant
- Custom attribute add/remove works in UI
- Summary card shows totals

**Issue:**
| # | Severity | Issue |
|---|----------|-------|
| P3 | **MEDIUM** | Same as P2 — custom attributes are not persisted. They could be stored in `custom_brand_json` or a new field. |

### Tab 5: Subscription/Plans ✅ PASS
- Loads plans from `pos_subscription_plans` table
- Shows current subscription if active (start/expiry dates)
- Plan cards with features list, pricing, and "Get Started" button
- `EnterpriseUpgradeModal` opens with feature comparison table
- Subscribe calls `pos-store-subscription` edge function
- Feature highlight cards render below
- **No gaps found**

### Tab 6: QR Pay ✅ PASS (with 2 issues)
- QR code generates with merchant_id, amount, currency, store_name
- Flexible amount (empty) or fixed amount supported
- Copy QR data works
- Print button calls `window.print()`
- "How QR Payments Work" guide renders

**Issues found:**
| # | Severity | Issue |
|---|----------|-------|
| P4 | **MEDIUM** | **"Save" button is non-functional.** Line 960-962: the Save/Download button has no `onClick` handler — it's an empty `<Button>` with just a Download icon. Should download QR as PNG/SVG. |
| P5 | **LOW** | **QR payload uses raw JSON.** The QR contains `{"type":"kob_pos_pay","merchant_id":"..."}` as plain JSON. This works but there's no URL-based fallback for non-KOB scanners. Consider wrapping in a URL like `https://kob.lovable.app/pay?d=...` |

### Tab 7: Preview ✅ PASS
- `StorePreview` renders a mobile-preview card with banner, logo, name, category, city, rating
- Store Checklist shows 8 items with green checkmarks for completed fields
- "Edit Store Profile" button navigates back to profile tab
- Public Store Link shown when published (with copy + open in new tab)
- **No gaps found**

### Tab 8: Shipping ⚠️ FUNCTIONAL BUT LIMITED
- Form collects: Order ID, Carrier, Tracking Number, Tracking URL, Estimated Delivery, Address, Notes
- Carrier dropdown with 7 options (DHL, EMS Cameroon, CamPost, FedEx, Aramex, UPS, Custom)
- Validation: requires Order ID, Carrier, Tracking Number
- Success animation shown after submit

**Issues found:**
| # | Severity | Issue |
|---|----------|-------|
| P6 | **HIGH** | **Shipping does not update the actual order.** `handleConfirmShipping` (line 38-84) only creates an `app_notifications` entry for the merchant themselves. It does NOT: (a) update `pos_orders` status to "shipped", (b) create a shipping record in any table, (c) notify the customer. The "Notify Customer" button text is misleading — no customer notification is sent. |
| P7 | **MEDIUM** | **No order validation.** The form accepts any string as Order ID. There's no lookup against `pos_orders` to validate the order exists or belongs to this merchant. |
| P8 | **LOW** | **No shipping history.** There's no table or list showing previously confirmed shipments. Merchants can't see what they've already shipped. |

### Tab 9: Integrations (WooCommerce) ✅ PASS
- Connect form: Store URL, Consumer Key, Consumer Secret
- Calls `pos-woo-connector` edge function with `action: connect`
- Shows connected integrations list with status badges
- Disconnect button calls `pos-woo-connector` with `action: disconnect`
- Import products button calls `action: import_products`
- Sync inventory button calls `action: sync_inventory`
- Loading and empty states present
- **No gaps found**

### Tab 10: Demo Store ✅ PASS
- Create demo store button calls `pos-demo-store` edge function
- Reset/clear demo data with confirmation dialog
- Shows result summary after creation (products count, variants, location)
- Uses `AlertDialog` for destructive reset action
- **No gaps found**

### Tab 11: Enterprise ✅ PASS (with 1 issue)
- `EnterpriseGate` component gates all sections behind enterprise subscription check
- **Custom Branding:** Primary/secondary color pickers, font selector, receipt header/footer — saves to `custom_brand_json`
- **API Keys:** Load, generate, reveal, revoke — calls `gateway-merchant-keys` edge function
- **Multi-location:** Load, add locations — calls `pos-manage-locations` edge function
- **Account Manager:** Shows assigned manager name/email from `profiles` table

**Issue:**
| # | Severity | Issue |
|---|----------|-------|
| P9 | **LOW** | **Delete location not implemented.** Locations can be added but there's no delete/deactivate button in the UI. |

---

## Public Storefront (`/store/:merchantId`) ✅ PASS
- Loads store profile filtered by `is_published = true`
- Shows banner, logo, name, category, city, rating
- Product grid with search, images, prices
- "Store not found" empty state for unpublished/nonexistent stores
- **No gaps found**

---

## Cross-Cutting Issues

| # | Severity | Issue |
|---|----------|-------|
| P10 | **LOW** | **No loading feedback on Profile save.** The save button shows a spinner but there's no optimistic UI update or success animation beyond the toast. |
| P11 | **LOW** | **No confirmation before toggling publish off.** Unpublishing a live store has no confirmation dialog — could accidentally take store offline. |

---

## Priority Summary

```text
HIGH (1 issue — blocks core functionality)
└── P6: Shipping form doesn't update orders or notify customers

MEDIUM (4 issues — data loss or misleading UI)
├── P1: Sub-category not persisted on save
├── P2/P3: Custom attributes not persisted (local state only)
├── P4: QR Save/Download button non-functional
└── P7: No order validation in shipping form

LOW (4 issues — polish)
├── P5: QR payload not URL-wrapped
├── P8: No shipping history view
├── P9: No delete location in Enterprise
├── P10: No publish toggle confirmation
└── P11: No enhanced save feedback
```

---

## Recommended Fixes

### Fix P6 (HIGH) — Wire Shipping to Orders
- Look up the order by ID in `pos_orders` to validate it exists and belongs to merchant
- Update `pos_orders.status` to `shipped`
- Record shipping details in `pos_order_status_history`
- Create notification for the **customer** (order's user_id), not just the merchant
- Add a shipping history table/query below the form

### Fix P1 + P2/P3 (MEDIUM) — Persist Sub-Category + Custom Attributes
- Add `sub_category` column to `pos_store_profiles` via migration
- Include `sub_category` in `handleSave` payload
- Store custom attributes in `custom_brand_json` or a new `custom_attributes_json` column
- Load them back on page load

### Fix P4 (MEDIUM) — QR Download
- Add `onClick` to the Save button that converts the QR SVG to a PNG blob and triggers a download using `canvas.toBlob()` + `URL.createObjectURL()`

### Fix P7 (MEDIUM) — Order Validation in Shipping
- On Order ID blur, fetch the order from `pos_orders` and show validation feedback (exists/not found/already shipped)

### Fixes P5, P8, P9, P10, P11 (LOW) — Polish
- Wrap QR in a URL scheme
- Add shipping history list component
- Add delete location button
- Add unpublish confirmation dialog
- Enhanced save feedback animation

---

## Files to Modify

| File | Changes |
|---|---|
| `src/pages/merchant/MerchantStorefront.tsx` | Add sub_category to save payload, persist custom attributes, add QR download handler, add unpublish confirmation |
| `src/components/storefront/ShippingForm.tsx` | Wire to pos_orders, add order validation, create customer notification, add shipping history |
| `src/components/storefront/EnterpriseFeaturesTab.tsx` | Add delete location button |
| DB Migration | Add `sub_category` column to `pos_store_profiles` |

**Total: 3 component files modified + 1 DB migration. All additive, non-breaking.**


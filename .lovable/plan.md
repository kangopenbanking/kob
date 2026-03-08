

## POS Enhancement Plan: QR Payments, Marketplace Storefront, and Consumer App Integration

### Gap Analysis

After auditing the codebase, here are the critical gaps between what exists and what's needed:

| Area | Current State | Gap |
|------|--------------|-----|
| **QR Code Payments** | CustomerScan.tsx exists with simulated QR scan and P2P transfer routing. No POS-order QR flow. | Need merchant QR code generation (linked to merchant_id) and consumer scan-to-pay-merchant flow |
| **Merchant Storefront Visibility** | `gateway_merchants` has no public visibility flag. All POS tables are merchant-only via RLS. | No way for consumers to discover or browse merchant stores/products |
| **Merchant Subscription** | No subscription/plan model for POS marketplace listing | Need subscription table + admin-managed plans for marketplace access |
| **Consumer Marketplace** | Customer App has no "Stores" or "Shop" section | Need storefront browsing, product viewing, cart, and wallet-based checkout |
| **Wallet Payment for POS** | `pos-pay-order` supports MoMo/Card/PayPal/Bank only | Missing `wallet` payment method that debits consumer's KOB wallet balance |
| **pos_order_channel enum** | Only `pos`, `woocommerce`, `api` | Missing `consumer_app` channel |

### Implementation Plan

---

#### 1. Database Migration (Additive)

**New tables:**

- **`pos_store_subscriptions`** -- Tracks merchant marketplace subscriptions
  - `id`, `merchant_id` (FK gateway_merchants), `plan_id`, `status` (active/expired/cancelled), `starts_at`, `expires_at`, `created_at`
  
- **`pos_subscription_plans`** -- Admin-managed plans
  - `id`, `name`, `price`, `currency` (XAF), `duration_days`, `features_json`, `is_active`, `created_at`

- **`pos_store_profiles`** -- Public-facing merchant storefront metadata
  - `id`, `merchant_id` (FK, unique), `store_name`, `description`, `logo_url`, `banner_url`, `category`, `city`, `country` (CM), `is_published` (bool), `rating`, `created_at`, `updated_at`

- **`pos_consumer_carts`** -- Consumer shopping carts
  - `id`, `user_id`, `merchant_id`, `status` (active/checked_out/abandoned), `created_at`, `updated_at`

- **`pos_consumer_cart_items`** -- Cart line items
  - `id`, `cart_id` (FK), `variant_id` (FK pos_product_variants), `quantity`, `unit_price`, `created_at`

**Schema changes (additive):**
- Add `consumer_app` to `pos_order_channel` enum
- Add `wallet` to payment methods in `pos-pay-order`

**RLS policies:**
- `pos_store_profiles`: Authenticated users can SELECT where `is_published = true`; merchant owner can CRUD
- `pos_products` + `pos_product_variants` + `pos_product_images`: Add SELECT policy for authenticated users where merchant has published store profile
- `pos_consumer_carts/items`: User can manage own carts
- `pos_subscription_plans`: Public SELECT; admin-only INSERT/UPDATE
- `pos_store_subscriptions`: Merchant owner SELECT/INSERT; admin full access

---

#### 2. Edge Functions (New)

**`pos-store-browse`** -- Public storefront API
- `GET ?action=stores` -- List published stores with active subscriptions (paginated, filterable by city/category)
- `GET ?action=products&merchant_id=X` -- List active products for a published store
- `GET ?action=store&merchant_id=X` -- Single store profile with product count

**`pos-consumer-cart`** -- Cart management
- `POST` -- Add to cart / update quantity / remove item / clear cart
- `GET ?user_id=X` -- Get active cart with items and variant details

**`pos-consumer-checkout`** -- Wallet-based checkout
- `POST` -- Takes `cart_id`, validates stock, creates a `pos_order` with `channel=consumer_app`, debits consumer wallet via `gateway-wallets` debit endpoint, credits merchant wallet, finalizes order immediately (no async webhook needed for wallet payments), decrements inventory
- Idempotency-Key required

**`pos-qr-payment`** -- QR code payment flow
- `POST ?action=generate` -- Merchant generates a QR payload containing `{type: 'kob_pos_pay', merchant_id, amount?, order_id?}`
- `POST ?action=pay` -- Consumer scans QR, pays from wallet. Creates order + finalizes in one atomic step if amount is fixed; otherwise creates draft for consumer to confirm amount

**`pos-store-subscription`** -- Merchant subscription management
- `GET` -- List available plans
- `POST` -- Subscribe to a plan (creates charge via gateway, activates on payment)
- `GET ?merchant_id=X` -- Check active subscription status

---

#### 3. Consumer App Frontend (New Pages)

**`/app/stores`** -- Marketplace landing
- Grid of published merchant stores with logo, name, category, city
- Search and category filter
- Links to individual store pages

**`/app/stores/:merchantId`** -- Store detail page
- Store banner, logo, description
- Product grid with images, names, prices (XAF)
- "Add to Cart" buttons
- Floating cart summary bar

**`/app/cart`** -- Shopping cart
- List items, quantities, line totals
- "Pay with Wallet" button (shows balance, confirms amount)
- Checkout triggers `pos-consumer-checkout`

**`/app/stores/:merchantId/product/:productId`** -- Product detail (optional, can be modal)

**Update `CustomerScan.tsx`:**
- Extend QR scan handler to recognize `kob_pos_pay` type QR codes
- Route to a merchant payment confirmation screen instead of P2P transfer
- Show merchant name, amount, and "Pay from Wallet" button

**Update `CustomerHome.tsx`:**
- Add "Stores" feature card in the services grid linking to `/app/stores`

---

#### 4. Merchant Portal Updates

- Add "Storefront" settings section where merchants can:
  - Edit store profile (name, description, logo, banner, category)
  - Toggle `is_published`
  - View/manage subscription status
  - Generate QR codes for in-store payments (static or dynamic with amount)

---

#### 5. Admin Portal Updates

- Add "Marketplace" management section:
  - Manage subscription plans (CRUD)
  - View active merchant subscriptions
  - Toggle store visibility (override)

---

#### 6. Update Existing Edge Functions

**`pos-pay-order/index.ts`:**
- Add `wallet` case to the switch statement
- For wallet payments: call `gateway-wallets` to debit consumer, credit merchant, finalize immediately (no webhook needed)

**`pos-orders/index.ts`:**
- Accept `consumer_app` as valid channel
- Allow consumer users (not just merchant owner/staff) to create orders for published stores

---

#### 7. Documentation Updates

- Update `MerchantsPOSGuide.tsx` with new sections:
  - QR Code Payments (generate + scan flow)
  - Consumer Marketplace (how stores appear to consumers)
  - Wallet Payments (direct balance debit)
  - Subscription Plans (how to activate marketplace listing)

- Update `docs/pos/changelog.md` with new version entries

---

### Technical Architecture Summary

```text
Consumer App                    Merchant Dashboard
     |                                |
     |  Browse stores                 |  Manage storefront
     |  Add to cart                   |  Subscribe to plan
     |  Pay with wallet              |  Generate QR codes
     |  Scan QR to pay               |
     v                                v
 ┌────────────────────────────────────────┐
 │         Edge Functions Layer           │
 │  pos-store-browse                      │
 │  pos-consumer-cart                     │
 │  pos-consumer-checkout (wallet debit)  │
 │  pos-qr-payment                        │
 │  pos-store-subscription                │
 │  pos-pay-order (+ wallet method)       │
 └───────────────┬────────────────────────┘
                 │
     ┌───────────┴───────────┐
     │   Database (Additive) │
     │  pos_store_profiles   │
     │  pos_store_subs       │
     │  pos_consumer_carts   │
     │  pos_orders (reused)  │
     │  gateway_wallets      │
     └───────────────────────┘
```

### File Count Estimate
- 1 database migration
- 5 new edge functions
- 4 new frontend pages
- 3 existing files updated (CustomerScan, CustomerHome, App.tsx routes)
- 1 merchant portal page update
- 1 admin portal page update
- Documentation updates


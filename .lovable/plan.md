

# Kang Business App — WooCommerce-Grade Enhancement Plan

## Current State Assessment

The Business PWA (`/biz/:merchantId`) already has a solid foundation with 15 pages covering: Home dashboard, Wallet, POS Till, QR Receive, Orders, Refunds, Products, Inventory, Storefront, Staff, Analytics, and Auth. The multi-tenancy routing (`/biz/:merchantId/*`) mirrors the Banking App pattern.

**What's missing vs WooCommerce Mobile App capabilities:**

### Missing Core Features

| Feature | WooCommerce Has | Kang Biz Has | Gap |
|---------|----------------|--------------|-----|
| Product creation from mobile | Yes (touch-first) | Yes but via separate page, not in bottom nav | Accessible but buried in "More" |
| Order creation on-the-fly | Yes | POS Till only | No quick-create order flow |
| Barcode scanning for products | Yes | Enterprise-gated | Should be available to all |
| Coupon/discount management | Yes | Percentage discount in Till only | No dedicated coupons system |
| Customer directory | Yes | No | **Missing entirely** |
| Push notifications ("cha-ching") | Yes | Realtime toast + sound exists | Working |
| Sales stats by period | Yes | Basic analytics page | Needs dashboard-level stats |
| Review/rating management | Yes | No | **Missing entirely** |
| Shipping label management | Yes | No | Not applicable for Cameroon market |
| Notification settings | Yes | No | **Missing** |
| Product image management | Yes | Product images table exists but no mobile upload UI | **Missing UI** |
| Order status management | Yes | View only | No status update from mobile |
| Multi-location switching | Yes | Enterprise-gated | Correct gating |

### Missing Admin Management

The `BusinessAppManagement.tsx` page is a skeleton with hardcoded zeros — no real data or controls.

---

## Implementation Plan

### Phase 1: Enhance Bottom Navigation & Core Missing Pages

**1. Restructure Business App Navigation**
- Replace current 5-tab nav (Home, Wallet, Till, Scan, More) with a smarter layout
- New nav: **Home** | **Orders** | **+** (FAB-style create) | **Products** | **More**
- The "+" button opens a quick-action sheet: New Order, Add Product, Scan Barcode, Receive Payment
- Move Wallet, Till, Receive, Analytics, Staff, Storefront, Inventory into "More" as a settings/tools menu

**2. Create Customer Directory Page** (`BusinessCustomers.tsx`)
- List customers from `pos_orders` (extracted from `customer_name`, `customer_email`, `customer_phone`)
- Show order count, total spent, last order date per customer
- Tap to view customer order history
- Quick actions: call, email, create order for customer

**3. Product Image Upload from Mobile** (enhance `BusinessProductForm.tsx`)
- Add camera/gallery image picker using `<input type="file" accept="image/*" capture="environment">`
- Upload to Supabase Storage `pos-product-images` bucket
- Save URLs to `pos_product_images` table
- Drag-to-reorder images

**4. Order Status Management** (enhance `BusinessOrders.tsx`)
- Add status update actions: Mark as Processing → Completed → Shipped
- Swipe or tap to update status
- Insert into `pos_order_status_history` on each change
- Show status timeline in order detail sheet

### Phase 2: Coupons, Reviews & Notifications

**5. Coupon Management** (`BusinessCoupons.tsx`)
- New table `pos_coupons` (merchant_id, code, type: percentage/fixed, value, min_order, max_uses, current_uses, expires_at, is_active)
- Create/edit/deactivate coupons from mobile
- Apply coupons in POS Till checkout flow
- Track usage stats

**6. Customer Reviews** (`BusinessReviews.tsx`)
- New table `pos_store_reviews` (merchant_id, customer_user_id, order_id, rating 1-5, comment, reply, created_at)
- List reviews with star ratings
- Merchant can reply to reviews
- Consumer App: add review submission after order completion

**7. Notification Preferences** (add to BusinessMore)
- Toggle: New order alerts, Low stock alerts, Review alerts
- "Cha-ching" sound toggle
- Store in `merchant_notification_preferences` table

### Phase 3: Enhanced "More" Menu & Missing Pages

**8. Redesign BusinessMore as a Full Settings Hub**
- Sections: **Account** (Profile, Wallet, Settlements), **Store** (Storefront, Products, Inventory, Coupons), **Sales** (POS Till, Analytics, Customers, Reviews), **Team** (Staff), **Settings** (Notifications, Store QR, Logout)
- Each section with icon, title, subtitle, chevron — premium list style

**9. Quick Order Creation** (`BusinessQuickOrder.tsx`)
- Simple flow: Select products from catalog → Set quantities → Add customer info (optional) → Choose payment method → Create order
- Syncs with inventory automatically
- Different from POS Till — this is for manual/phone orders

### Phase 4: Full Admin Management Dashboard

**10. Rebuild `BusinessAppManagement.tsx`** with real data and controls:

**KPI Dashboard:**
- Total active merchants (from `gateway_merchants` with active `merchant_pos_staff` or active business app sessions)
- Total orders today/week/month across all merchants
- Total GMV (Gross Merchandise Value) across platform
- Active staff count

**Merchant Directory:**
- Searchable list of all merchants using the Business App
- Show: business name, plan tier, order count, revenue, last active
- Click to view merchant detail: orders, products, staff, wallet balance
- Actions: Suspend merchant, change plan tier, send notification

**Feature Toggles:**
- Per-merchant or global toggles: POS Till, Wallet, QR Payments, Coupons, Reviews, Staff Management
- Store in `business_app_feature_flags` table
- BusinessAppLayout reads flags and conditionally renders routes

**App Configuration:**
- Default theme/branding for generic `/biz` route
- Walkthrough/onboarding content management
- Push notification templates for merchants

**Analytics:**
- Platform-wide: orders by day chart, top merchants by revenue, payment method distribution
- Per-merchant drill-down

### Database Changes Required

```sql
-- 1. Coupons
CREATE TABLE pos_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percentage', -- percentage, fixed
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, code)
);

-- 2. Store Reviews
CREATE TABLE pos_store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL,
  customer_user_id UUID NOT NULL,
  order_id UUID REFERENCES pos_orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  merchant_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Feature Flags
CREATE TABLE business_app_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, feature_key)
);

-- 4. Notification Preferences
CREATE TABLE merchant_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  new_order_alert BOOLEAN DEFAULT true,
  low_stock_alert BOOLEAN DEFAULT true,
  review_alert BOOLEAN DEFAULT true,
  cha_ching_sound BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS on all four tables
-- Enable realtime on pos_store_reviews for merchant reply notifications
```

### Files to Create/Edit

| File | Action | Phase |
|------|--------|-------|
| `src/components/business-app/BusinessAppLayout.tsx` | Edit — new nav structure with FAB | 1 |
| `src/pages/business-app/BusinessCustomers.tsx` | Create — customer directory | 1 |
| `src/pages/business-app/BusinessProductForm.tsx` | Edit — add image upload | 1 |
| `src/pages/business-app/BusinessOrders.tsx` | Edit — add status management | 1 |
| `src/pages/business-app/BusinessCoupons.tsx` | Create — coupon CRUD | 2 |
| `src/pages/business-app/BusinessReviews.tsx` | Create — review management | 2 |
| `src/pages/business-app/BusinessMore.tsx` | Rewrite — full settings hub | 3 |
| `src/pages/business-app/BusinessQuickOrder.tsx` | Create — manual order creation | 3 |
| `src/pages/admin/BusinessAppManagement.tsx` | Rewrite — full admin dashboard | 4 |
| `src/App.tsx` | Edit — add new routes | 1-3 |
| Migration SQL | Create 4 new tables + RLS | 1-2 |

### Implementation Priority
Start with **Phase 1** (nav restructure + customers + image upload + order status) and **Phase 4** (admin dashboard) simultaneously, as they are independent workstreams.


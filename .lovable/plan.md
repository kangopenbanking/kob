

# POS Till System for Marketplace Merchants

## Overview
Build a full POS till/register interface that merchants access from both the **Merchant Portal** (`/merchant/pos-till`) and the **Business PWA** (`/biz/:merchantId/till`). The till enables cashiers to browse products, build a cart, apply discounts, process payment (wallet, cash, mobile money), and print/share receipts -- all connected to the merchant's existing POS product catalog and order system.

## Architecture

```text
┌─────────────────────────────────────────────┐
│              POS Till UI                     │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ Product   │  │  Cart / Order Builder    │ │
│  │ Grid with │  │  - Line items            │ │
│  │ Search &  │  │  - Qty +/-              │ │
│  │ Category  │  │  - Discount (% or fixed) │ │
│  │ Filter    │  │  - Subtotal / Tax / Total│ │
│  │           │  │  - Customer (optional)   │ │
│  └──────────┘  └──────────────────────────┘ │
│                ┌──────────────────────────┐  │
│                │  Payment Panel           │  │
│                │  Cash | Wallet | MoMo    │  │
│                │  → pos-orders (create)   │  │
│                │  → pos-pay-order (pay)   │  │
│                └──────────────────────────┘  │
│                ┌──────────────────────────┐  │
│                │  Receipt (print/share)   │  │
│                └──────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## What Already Exists
- **Product catalog**: `pos_products` + `pos_product_variants` tables, queried in `BusinessProducts.tsx`
- **Order creation**: `pos-orders` edge function (POST creates draft order with items)
- **Order submission**: `pos-submit-order` edge function (draft → pending_payment)
- **Order payment**: `pos-pay-order` and `pos-finalize-payment` edge functions
- **QR payments**: `pos-qr-payment` edge function + `BusinessReceive.tsx`
- **Staff roles**: `merchant_pos_staff` with `cashier` role + PIN auth
- **Inventory**: `pos_adjust_inventory` RPC, `inventory_items` table

## Implementation Plan

### 1. Create POS Till Page (`src/pages/merchant/MerchantPOSTill.tsx`)
Desktop-optimized split-panel layout for the Merchant Portal:
- **Left panel (60%)**: Product grid with search bar, category filter tabs, product cards showing name/price/image. Click to add to cart.
- **Right panel (40%)**: Cart with line items (qty adjusters, remove button), optional customer name/phone fields, discount input (% or fixed amount), subtotal/tax/total display, and payment action buttons.

### 2. Create Business App Till (`src/pages/business-app/BusinessTill.tsx`)
Mobile-optimized single-column till for the PWA:
- Product search + scrollable product list at top
- Cart summary as a bottom sheet / expandable panel
- Same payment flow but touch-optimized with larger tap targets

### 3. Create Shared Till Logic Hook (`src/hooks/usePOSTill.ts`)
Shared hook used by both till UIs:
- `useQuery` to fetch `pos_products` + `pos_product_variants` for the merchant
- Cart state: items array with `{variant_id, name, price, quantity, discount}`
- `addItem(variant)`, `removeItem(variantId)`, `updateQuantity(variantId, qty)`, `applyDiscount(amount, type)`
- `checkout(paymentMethod)`: calls `pos-orders` to create order, then `pos-pay-order` to process payment
- Totals calculation: subtotal, discount, tax, grand total
- Receipt data generation after successful payment

### 4. Create Receipt Component (`src/components/pos/POSReceipt.tsx`)
- Order number, date, merchant name
- Line items with quantities and prices
- Subtotal, discount, tax, total
- Payment method indicator
- Print button (window.print with print-specific CSS) + share button

### 5. Routing & Navigation
- Add `/merchant/pos-till` route in `App.tsx` under merchant layout
- Add `/biz/:merchantId/till` and `/biz/till` routes in business app layout
- Add "POS Till" nav item to `merchant-navigation-config.ts` under a new "Point of Sale" section
- Add till icon to `BusinessAppLayout.tsx` bottom nav (replace or add alongside existing items)

### 6. Payment Flow
The till uses existing edge functions:
1. **Create order** via `pos-orders` POST with `channel: 'pos'`, cart items, optional customer info
2. **Submit** via `pos-submit-order` (draft → pending_payment)
3. **Pay** via `pos-pay-order` with method: `cash` | `wallet` | `mobile_money`
4. On success: show receipt, clear cart, optionally print

### 7. No Database Changes Required
All necessary tables and edge functions already exist. The till is purely a frontend interface that orchestrates existing APIs.

## Files to Create/Edit
| File | Action |
|------|--------|
| `src/hooks/usePOSTill.ts` | Create — shared cart + checkout logic |
| `src/components/pos/POSReceipt.tsx` | Create — receipt display + print |
| `src/pages/merchant/MerchantPOSTill.tsx` | Create — desktop till UI |
| `src/pages/business-app/BusinessTill.tsx` | Create — mobile till UI |
| `src/App.tsx` | Edit — add till routes |
| `src/components/merchant/merchant-navigation-config.ts` | Edit — add POS Till nav |
| `src/components/business-app/BusinessAppLayout.tsx` | Edit — add till to bottom nav |


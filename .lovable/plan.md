

# WooCommerce E2E Audit Report — KOB v1 API

## Inventory of WooCommerce Assets

### Edge Functions (7)
| Function | Status | Issues |
|---|---|---|
| `woocommerce-register-merchant` | Implemented | Uses `SUPABASE_SERVICE_ROLE_KEY` correctly, sends welcome email via `send-communication` |
| `woocommerce-process-payment` | Implemented | Routes to MoMo/Stripe/Bank Transfer correctly |
| `woocommerce-payment-webhook` | Implemented | Uses `compute_woo_webhook_hmac` RPC, has deduplication |
| `woocommerce-validate-install` | Implemented | Rate-limited, validates API key hash |
| `woocommerce-transaction-sync` | Implemented | Supports JSON + CSV export, pagination, summary stats |
| `woocommerce-download-plugin` | Implemented | In-memory ZIP with 9 PHP files, audit-logged |
| `pos-woo-connector` | Implemented | Connect/import/push/disconnect with POS |
| `pos-woo-webhook-ingestion` | Implemented | Product/order webhook handling with deduplication |

### UI Pages (8)
| Page | Route | Status | Issues |
|---|---|---|---|
| WooForKang (landing) | `/woo-for-kang` | Complete | None |
| WooCommerceGuide | `/integrations/woocommerce-docs` | Complete | None |
| WooCommerceMerchantRegister | `/integrations/woocommerce-merchant-register` | Complete | **BUG**: "Manage Integration" button navigates to `/admin/woocommerce-plugin` but that route is nested under `/admin/` requiring admin role; merchants can't access it |
| WooCommercePluginCode | `/integrations/woocommerce-plugin-code` | Complete | None |
| WooCommerceManagement (Admin) | `/admin/woocommerce-plugin` | Complete | Admin-only, correct |
| WooCommerceDashboard (FI) | `/institution/woocommerce` | Partially Complete | **BUG**: Queries `woocommerce_merchants` by `institution_id`, but the table has `user_id` not `institution_id` — always returns empty |
| MerchantWooSync | `/merchant/woo-sync` | Complete | Shows sync runs correctly |
| Merchant Storefront Integrations Tab | `/merchant/storefront` | Complete | WooCommerce connector in Integrations tab |

### PHP Plugin (in-memory ZIP)
| File | Status | Issues |
|---|---|---|
| `woo-for-kang.php` | Complete | Proper WC dependency check, hooks, activation/deactivation |
| `class-wfk-payment-gateway.php` | Complete | process_payment, process_refund, thankyou_page |
| `class-wfk-api-client.php` | Complete | **GAP**: Uses `X-API-Key` header but `woocommerce-process-payment` expects `api_key` in body, not header — mismatch |
| `class-wfk-webhook-handler.php` | Complete | HMAC verification, idempotency, all status handlers |
| `class-wfk-logger.php` | Complete | None |
| `payment-instructions.php` | Complete | None |
| `readme.txt` | Complete | None |
| `uninstall.php` | Complete | None |
| `LICENSE` | Complete | None |

### PHP SDK (`packages/sdk-php`)
No WooCommerce-specific resource — not required (plugin uses direct API calls).

---

## Critical Gaps Found

### GAP 1: API Key Authentication Mismatch (HIGH)
**Location**: `class-wfk-api-client.php` vs `woocommerce-process-payment/index.ts`
- The PHP plugin sends `X-API-Key` header in all requests
- `woocommerce-process-payment` expects `api_key` in the **request body** (line 73: `if (!api_key ...`)
- The plugin also sends `api_key` as a property in `$payment_data` which is built from `process_payment()` — but `api_key` is NOT added to `$payment_data` in the gateway. Only `amount`, `currency`, `woocommerce_order_id`, etc.
- **Fix**: Either add `'api_key' => $this->api_key` to `$payment_data` in the gateway class, OR update `woocommerce-process-payment` to also read from `X-API-Key` header.

### GAP 2: WooCommerceDashboard institution_id query bug (HIGH)
**Location**: `src/pages/institution/WooCommerceDashboard.tsx` line 45
- Queries `.eq("institution_id", institutionId)` but `woocommerce_merchants` table uses `user_id`, not `institution_id`
- This means FI portal WooCommerce dashboard always shows zero stores
- **Fix**: Join through `user_id` or add an `institution_id` column

### GAP 3: No WooCommerce Email Templates in managed-send-email (MEDIUM)
**Location**: `supabase/functions/managed-send-email/index.ts`
- Zero WooCommerce-specific email templates exist
- `woocommerce-register-merchant` sends welcome email via `send-communication` (the legacy function), not `managed-send-email`
- Missing templates: payment confirmation, payment failed, refund processed, merchant deactivated
- **Fix**: Add 4 WooCommerce email templates to `managed-send-email` and update edge functions to use them

### GAP 4: Missing Merchant-facing "Manage Integration" route (MEDIUM)
**Location**: `WooCommerceMerchantRegister.tsx` line 244
- After registration, "Manage Integration" button navigates to `/admin/woocommerce-plugin` — an admin-only route
- Merchants without admin role get 403 or blank page
- **Fix**: Redirect to `/merchant/woo-sync` instead

### GAP 5: No Payment Status Notifications for WooCommerce (MEDIUM)
- When `woocommerce-payment-webhook` processes a completed/failed payment, it updates the DB and calls WooCommerce API, but does NOT:
  - Create an `app_notifications` entry for the merchant
  - Send a managed email to the merchant about the transaction
- **Fix**: Add notification + email dispatch in the webhook handler

### GAP 6: Transaction Sync CSV Export Uses Auth Header Directly (LOW)
**Location**: `WooCommerceManagement.tsx` line 172
- Fetches `woocommerce-transaction-sync?format=csv` via raw `fetch()` with the Authorization header
- This works but inconsistent with `supabase.functions.invoke()` pattern used elsewhere
- Not a bug, but a consistency issue

### GAP 7: `woocommerce-process-payment` No Idempotency Check (LOW)
- The function creates a new transaction record on every call without checking for duplicate `woocommerce_order_id` + `payment_method` combination
- Could result in double charges if the WP plugin retries
- **Fix**: Check for existing pending/processing transaction with same `woocommerce_order_id` before creating a new one

### GAP 8: `updateWooCommerceOrderStatus` Missing Auth (LOW)
**Location**: `woocommerce-payment-webhook/index.ts` line 60
- Calls WooCommerce REST API `PUT /orders/{id}` without authentication headers
- WooCommerce REST API requires either OAuth1 or Basic auth with consumer keys
- This call will fail silently (caught by `.catch()`)
- **Fix**: Read merchant's consumer keys from `merchant_integrations` or `woocommerce_merchants` and add auth

---

## Implementation Plan

### Step 1: Fix API Key Mismatch in Plugin + Edge Function
- Update `woocommerce-process-payment` to also accept `api_key` from `X-API-Key` header as fallback
- Update `woocommerce-download-plugin` — add `'api_key' => $this->api_key` to `$payment_data` in the payment gateway class

### Step 2: Fix WooCommerceDashboard Query
- Change `.eq("institution_id", institutionId)` to `.eq("user_id", user.id)` using the logged-in user's ID instead

### Step 3: Fix "Manage Integration" Route
- Change navigation from `/admin/woocommerce-plugin` to `/merchant/woo-sync`

### Step 4: Add WooCommerce Email Templates
- Add 4 templates to `managed-send-email`: `woo_merchant_welcome`, `woo_payment_completed`, `woo_payment_failed`, `woo_refund_processed`
- Update `woocommerce-register-merchant` to use `managed-send-email` instead of `send-communication`

### Step 5: Add Notifications to Webhook Handler
- In `woocommerce-payment-webhook`, after recording transaction, insert into `app_notifications` for the merchant
- Invoke `managed-send-email` for payment completed/failed events

### Step 6: Add Idempotency to Process Payment
- Before creating a transaction, check for existing record with same `woocommerce_order_id` in `pending`/`processing` status

### Step 7: Fix WooCommerce Order Status Update Auth
- In `woocommerce-payment-webhook`, fetch merchant's store credentials and add Basic auth to the WC API call

## Files to Modify

| File | Action |
|---|---|
| `supabase/functions/woocommerce-process-payment/index.ts` | Add X-API-Key header support + idempotency check |
| `supabase/functions/woocommerce-download-plugin/index.ts` | Fix plugin code: add api_key to payment data |
| `supabase/functions/woocommerce-payment-webhook/index.ts` | Add notifications, email dispatch, fix WC API auth |
| `supabase/functions/woocommerce-register-merchant/index.ts` | Switch to managed-send-email |
| `supabase/functions/managed-send-email/index.ts` | Add 4 WooCommerce email templates |
| `src/pages/institution/WooCommerceDashboard.tsx` | Fix institution_id → user_id query |
| `src/pages/integrations/WooCommerceMerchantRegister.tsx` | Fix "Manage Integration" route |


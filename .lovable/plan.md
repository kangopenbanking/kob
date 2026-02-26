

## WooCommerce Plugin E2E Audit & Production Build Plan

### Current State Analysis

**What exists:**
- 6 edge functions: `woocommerce-download-plugin`, `woocommerce-register-merchant`, `woocommerce-process-payment`, `woocommerce-payment-webhook`, `woocommerce-transaction-sync`, `woocommerce-validate-install`
- 5 frontend pages: `WooForKang.tsx` (landing), `WooCommerceGuide.tsx` (docs), `WooCommerceMerchantRegister.tsx` (registration), `WooCommercePluginCode.tsx` (code viewer), `WooCommerceDashboard.tsx` (admin)
- OpenAPI spec: 3 endpoints (register, validate, download) — all with `schema: { type: 'object' }` (no detail)
- Postman: 3 requests matching the spec
- Plugin code: Exists as inline PHP strings in `WooCommercePluginCode.tsx` — NOT as actual downloadable files

### Critical Gaps Found

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| 1 | **No actual downloadable plugin** | CRITICAL | `woocommerce-download-plugin` returns a JSON status message saying "packaging in progress". No ZIP file is generated. The "Download Plugin v1.0.0" button on multiple pages does nothing useful. |
| 2 | **Incomplete PHP plugin code** | HIGH | The inline code in `WooCommercePluginCode.tsx` is partial — missing `class-wfk-logger.php`, `readme.txt`, `payment-instructions.php` template, `WFK_PLUGIN_DIR` constant definition, `wfk_add_gateway_class()` function, and `init_form_fields()` method. |
| 3 | **API Client uses wrong endpoint pattern** | HIGH | `class-wfk-api-client.php` calls `woocommerce-process-payment` as a URL path segment off `WFK_API_BASE_URL` (`https://api.kangopenbanking.com/v1/woocommerce-process-payment`), but the actual edge function URL is `https://api.kangopenbanking.com/functions/v1/woocommerce-process-payment`. |
| 4 | **OpenAPI spec has no request/response schemas** | MEDIUM | All 3 WooCommerce endpoints use `schema: { type: 'object' }` with no properties defined. Missing: process-payment, transaction-sync, payment-webhook endpoints entirely. |
| 5 | **Postman collection missing 3 endpoints** | MEDIUM | `process-payment`, `transaction-sync`, `payment-webhook` are not in the Postman collection. |
| 6 | **Webhook handler has static `handle` method but calls instance `process`** | HIGH | `WFK_Webhook_Handler::init()` registers static `handle` callback, but the code shows a `process()` instance method — these are disconnected. |
| 7 | **No `WFK_PLUGIN_DIR` defined** | HIGH | Main plugin file uses `WFK_PLUGIN_DIR` in require statements but never defines it. |

### Implementation Plan

---

#### Phase 1: Build the Complete WordPress Plugin & Generate ZIP Download

**1a. Create edge function: `woocommerce-download-plugin/index.ts` (REWRITE)**

Replace the placeholder with a function that dynamically generates a valid `.zip` file containing the complete WordPress plugin. The ZIP will be built in-memory using Deno's built-in compression APIs and returned as a binary download.

The plugin ZIP will contain the complete directory structure:

```text
woo-for-kang/
├── woo-for-kang.php              # Main plugin bootstrap
├── readme.txt                     # WordPress.org standard readme
├── LICENSE                        # GPL v2
├── uninstall.php                  # Clean uninstall handler
├── includes/
│   ├── class-wfk-payment-gateway.php   # WC_Payment_Gateway extension
│   ├── class-wfk-api-client.php        # KOB API client
│   ├── class-wfk-webhook-handler.php   # Webhook receiver
│   └── class-wfk-logger.php            # WooCommerce logger wrapper
└── templates/
    └── payment-instructions.php        # Checkout payment instructions
```

**Complete PHP files to include in the ZIP:**

1. **woo-for-kang.php** — Fixed: adds `WFK_PLUGIN_DIR` constant, proper `wfk_add_gateway_class()`, activation/deactivation hooks, text domain loading, admin notices
2. **class-wfk-payment-gateway.php** — Fixed: complete `init_form_fields()` with all settings (API key, client secret, webhook secret, sandbox mode, enabled payment methods, title, description), proper `process_payment()` with error handling, `is_available()` check, admin options display
3. **class-wfk-api-client.php** — Fixed: correct API base URL using `/functions/v1/` path, proper error handling with `WP_Error`, webhook signature verification using `hash_hmac`, validate-install call, process-payment call, transaction-sync call
4. **class-wfk-webhook-handler.php** — Fixed: static `handle()` method that directly processes (no instance delegation), proper signature verification, order status mapping, order note logging, idempotency via transaction ref check
5. **class-wfk-logger.php** — NEW: wrapper around `WC_Logger` with source tagging, debug/info/error levels, conditional debug logging based on gateway setting
6. **readme.txt** — NEW: WordPress.org standard readme with description, installation, FAQ, changelog, screenshots section
7. **uninstall.php** — NEW: clean removal of options on uninstall
8. **templates/payment-instructions.php** — NEW: checkout template showing available payment methods

#### Phase 2: Fix OpenAPI Spec — Expand WooCommerce Section

**File: `supabase/functions/public-api-spec/index.ts`**

Expand the 3 existing stub endpoints with full request/response schemas, and add the 3 missing endpoints:

| Endpoint | Method | Operation |
|----------|--------|-----------|
| `/v1/woocommerce/merchants` | POST | Register merchant (add full schema: store_name, store_url, admin_email, plugin_version) |
| `/v1/woocommerce/validate-install` | POST | Validate install (add schema: api_key, plugin_version, store_url) |
| `/v1/woocommerce/plugin/download` | GET | Download plugin ZIP (update response to binary/zip) |
| `/v1/woocommerce/process-payment` | POST | **NEW** — Process payment (api_key, woocommerce_order_id, payment_method, amount, currency, customer fields) |
| `/v1/woocommerce/transactions` | GET | **NEW** — Sync transactions (query params: start_date, end_date, status, payment_method, limit, offset, format) |
| `/v1/woocommerce/webhook` | POST | **NEW** — Payment webhook (event_type, transaction_ref, woocommerce_order_id, status, amount) |

Add schemas: `WooCommerceMerchantRegistration`, `WooCommercePaymentRequest`, `WooCommerceWebhookPayload`, `WooCommerceTransactionSync`.

#### Phase 3: Fix Postman Collection

**File: `supabase/functions/postman-collection/index.ts`**

Add the 3 missing WooCommerce requests with full example bodies:
- Process Payment
- Transaction Sync
- Payment Webhook

#### Phase 4: Update Frontend Plugin Code Page

**File: `src/pages/integrations/WooCommercePluginCode.tsx`**

- Update all inline PHP code snippets to match the corrected plugin code (fixed API URL, complete `init_form_fields`, `WFK_PLUGIN_DIR`, logger)
- Add the missing files: `class-wfk-logger.php`, `readme.txt`, `uninstall.php`, `payment-instructions.php`
- Update the file count from 7 to 8

#### Phase 5: Update WooForKang Landing & Guide Pages

**File: `src/pages/WooForKang.tsx`**
- Update download handler: the function now returns a ZIP blob, so handle binary response properly

**File: `src/pages/integrations/WooCommerceGuide.tsx`**
- Remove "packaging in progress" banner — plugin is now downloadable
- Update download handler for ZIP response

#### Phase 6: Update Changelog

**File: `src/pages/developer/Changelog.tsx`**

Add v2.7.0 entry:
- Woo for Kang v1.0.0 WordPress plugin — complete production-ready ZIP download
- 8 PHP files: payment gateway, API client, webhook handler, logger, templates, uninstall, readme
- Fixed API base URL to use production endpoint pattern
- OpenAPI spec: 6 WooCommerce endpoints with full schemas (was 3 stubs)
- Postman collection: 6 WooCommerce requests (was 3)
- Plugin code viewer updated with complete file set

#### Phase 7: Tests

**File: `src/test/gateway-integration.test.ts`**

Add WooCommerce-specific tests:
- WooCommerce endpoint count = 6
- Plugin version constant = '1.0.0'
- API base URL uses production domain

---

### Files to Create (0 new, 1 full rewrite)

| File | Change |
|---|---|
| `supabase/functions/woocommerce-download-plugin/index.ts` | Full rewrite — generates ZIP file with complete plugin |

### Files to Modify (7)

| File | Change |
|---|---|
| `supabase/functions/public-api-spec/index.ts` | Expand 3 WooCommerce stubs, add 3 new endpoints with schemas |
| `supabase/functions/postman-collection/index.ts` | Add 3 missing WooCommerce requests |
| `src/pages/integrations/WooCommercePluginCode.tsx` | Update all PHP snippets, add missing files |
| `src/pages/WooForKang.tsx` | Update download handler for ZIP binary |
| `src/pages/integrations/WooCommerceGuide.tsx` | Remove packaging banner, update download handler |
| `src/pages/developer/Changelog.tsx` | Add v2.7.0 |
| `src/test/gateway-integration.test.ts` | Add WooCommerce tests |

### Production Readiness Checklist

| Item | Status After Implementation |
|---|---|
| Downloadable ZIP file | YES — binary ZIP from edge function |
| Complete PHP plugin (8 files) | YES — all classes, templates, readme |
| Correct API endpoints in plugin | YES — `https://api.kangopenbanking.com/functions/v1/` |
| WooCommerce dependency check | YES — admin notice if WC not active |
| Webhook signature verification | YES — HMAC-SHA256 |
| Settings page in WP admin | YES — full `init_form_fields()` |
| Sandbox/Production mode toggle | YES — in gateway settings |
| Error logging | YES — `WFK_Logger` via `WC_Logger` |
| Clean uninstall | YES — `uninstall.php` |
| GPL v2 license | YES — in ZIP |
| WordPress.org readme.txt | YES — in ZIP |
| OpenAPI documented | YES — 6 endpoints with schemas |
| Postman collection | YES — 6 requests |


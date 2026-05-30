# WooCommerce + Merchant Integration — E2E Audit Plan (Round 3)
**Date**: 2026-05-30
**Scope**: Plugin lifecycle, merchant connection, payment processing, webhooks, transaction sync, admin/institution dashboards, and POS connector parity.

## Inventory (current state, verified against `supabase/functions/`)

### Edge Functions Present
| Function | Purpose | Status |
|---|---|---|
| `woocommerce-register-merchant` | Issue API key, secret, webhook secret | ✅ Deployed |
| `woocommerce-validate-install` | Verify PHP plugin install/handshake | ✅ Deployed |
| `woocommerce-process-payment` | Route Woo checkout payment to MoMo/Stripe/Bank | ✅ Deployed |
| `woocommerce-transaction-sync` | JSON/CSV export, filtered reporting | ✅ Deployed |
| `woocommerce-download-plugin` | In-memory ZIP of PHP plugin | ✅ Deployed |
| `woocommerce-admin-clear-demo` | Admin-scoped demo data purge | ✅ Deployed |
| `pos-woo-connector` | POS catalog import/push/disconnect | ✅ Deployed |
| `pos-woo-webhook-ingestion` | HMAC-verified Woo webhook inbox | ✅ Deployed |

### ⚠️ Gap detected
- **Missing `woocommerce-payment-webhook`** — referenced by previous audit (2026-04-19), no longer present in `supabase/functions/`. Either:
  - (a) The PHP plugin posts directly to `woocommerce-process-payment` for status updates, OR
  - (b) Gateway provider webhooks (Flutterwave/Stripe) update `woocommerce_transactions` indirectly through the standard payment webhook handlers.
- **Action**: Verify which path settles Woo transactions before declaring webhook handling complete.

## Audit Checklist

### 1. Merchant onboarding flow
- [ ] `POST /functions/v1/woocommerce-register-merchant` returns `api_key`, `secret_key`, `webhook_secret`
- [ ] One-time view of secrets enforced (per `mem://security/cryptographic-and-api-key-governance`)
- [ ] Plugin download endpoint serves signed ZIP
- [ ] Install handshake via `woocommerce-validate-install` flips `woocommerce_merchants.status → active`
- [ ] Merchant appears in Admin `/admin/woocommerce-plugin` and Institution `/institution/woocommerce`

### 2. Payment processing
- [ ] PHP plugin → `woocommerce-process-payment` with `Idempotency-Key`
- [ ] Routes correctly to MoMo / Stripe / Bank based on `payment_method`
- [ ] Inserts `woocommerce_transactions` row with `pending` status
- [ ] Records fee using `woocommerce_transaction` fee structure (1.8% + 50 XAF, cap 5,000)

### 3. Webhook & settlement
- [ ] Determine final settlement path (see Gap above)
- [ ] Verify `woocommerce_transactions.status` transitions `pending → success | failed`
- [ ] Outbound merchant webhook signed with `webhook_secret`
- [ ] Inbound provider webhook deduplicated by `tx_ref`

### 4. POS Woo connector (parallel track)
- [ ] `pos-woo-connector connect` validates `wc/v3/system_status`
- [ ] `import_products` populates `pos_products` with `source = 'woocommerce'`
- [ ] `pos-woo-webhook-ingestion` HMAC verifies + writes `integration_events_inbox`
- [ ] `pos-inventory-sync` increments `last_sync_at` watermark
- [ ] Imported products surface in consumer `CustomerStores` / `CustomerMarketplace`

### 5. Admin & Institution dashboards
- [ ] `/admin/woocommerce-plugin` lists legacy merchants + transactions + CSV export
- [ ] "Clear Demo Data" button hits `woocommerce-admin-clear-demo` with correct scope
- [ ] `/institution/woocommerce` scoped to FI-owned merchants only (per `mem://architecture/multi-tenant-kyc-governance`)
- [ ] No POS-connector merchants leak into legacy view (intentional duality)

### 6. Security & compliance
- [ ] RLS on `woocommerce_merchants`, `woocommerce_transactions`, `merchant_integrations`, `integration_sync_runs`, `integration_events_inbox`, `integration_mappings`
- [ ] All functions use `SECURITY DEFINER` + `SET search_path = public` where applicable
- [ ] GRANTs present on all 6 Woo-related public tables
- [ ] No plaintext webhook secrets stored (hashed/scoped per cryptographic governance)

### 7. Fee management
- [ ] `woocommerce_transaction` fee active in `fee_structures`
- [ ] Enterprise package tiers (starter/growth/scale) charged via Woo merchant subscription

## Known gaps from previous audits (to re-verify)
1. Admin Portal does not surface POS-connector Woo merchants (legacy-only view) — intentional, deferred
2. Institution Dashboard same duality
3. Consumer mobile app has no direct Woo surface (correct by design)

## Execution plan
1. Run network probes against each edge function (auth/401, missing-idempotency, invalid payload)
2. Read DB sample of last 50 `woocommerce_transactions` to confirm state transitions
3. Confirm webhook settlement path via gateway logs (Flutterwave/Stripe)
4. Verify RLS by attempting cross-merchant read with second test JWT
5. Produce final report at `docs/woocommerce/woo-services-e2e-audit-2026-05-30b.md`

## Files referenced
- `supabase/functions/woocommerce-*` (6 functions)
- `supabase/functions/pos-woo-*` (2 functions)
- `src/pages/admin/WooCommerceManagement.tsx`
- `src/pages/institution/WooCommerceDashboard.tsx`
- `src/pages/merchant/MerchantWooSync.tsx`
- `src/components/storefront/WooConnectTab.tsx`

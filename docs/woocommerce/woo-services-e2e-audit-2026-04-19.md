# WooCommerce Services — E2E Audit Report
**Date**: 2026-04-19  
**Scope**: All WooCommerce surfaces across Consumer Mobile App, Merchant App, Business Dashboard, Admin Portal, and Institution Portal.

## Audit Scope
Full review of:
- 7 edge functions (legacy `woocommerce-*` × 5 + `pos-woo-connector` + `pos-woo-webhook-ingestion`)
- 6 frontend pages (Admin, Institution, Merchant, Storefront tab, 2× Integration guides)
- 3 database tables (`woocommerce_merchants`, `woocommerce_transactions`, `merchant_integrations`)
- 2 sync/event tables (`integration_sync_runs`, `integration_events_inbox`, `integration_mappings`)
- Consumer marketplace flow (indirect: Woo → POS catalog → `CustomerStores`/`CustomerStoreDetail`/`CustomerMarketplace`)

## Two Parallel Architectures Identified

| Track | Tables | Edge Functions | Purpose | Status |
|-------|--------|----------------|---------|--------|
| **Legacy Plugin** | `woocommerce_merchants`, `woocommerce_transactions` | `woocommerce-register-merchant`, `-process-payment`, `-payment-webhook`, `-validate-install`, `-transaction-sync`, `-download-plugin` | KOB-as-payment-gateway for Woo (PHP plugin model) | ✅ Live |
| **POS Connector** | `merchant_integrations`, `integration_sync_runs`, `integration_mappings`, `integration_events_inbox` | `pos-woo-connector`, `pos-woo-webhook-ingestion`, `pos-inventory-sync` | KOB POS imports/syncs Woo catalog, pushes orders | ✅ Live (with bugs) |

## 🐛 Critical Bugs Found & Fixed

### 1. MerchantWooSync — Wrong Column Names (Page Functionally Broken)
**Severity**: 🔴 CRITICAL  
**File**: `src/pages/merchant/MerchantWooSync.tsx`  
**Bug**: Page queried `merchant_integrations` with non-existent column names:
| Used in code | Actual DB column |
|--------------|------------------|
| `integration_type` | `type` |
| `store_url` | `base_url` |
| `last_synced_at` | `last_sync_at` |
| `config.merge_strategy` | `settings_json.sync_strategy` |
| `products_synced` (sync_runs) | `summary_json.products_synced` |
| `completed_at` (sync_runs) | `finished_at` |

**Result**: Page always rendered "No stores connected" and "No sync runs", regardless of actual integrations.

**Fix**: Aligned all column references with actual schema. Joined `merchant_integrations(base_url)` for store name display in run history.

### 2. WooConnectTab — Wrong Status Enum Comparison
**Severity**: 🟡 HIGH  
**File**: `src/components/storefront/WooConnectTab.tsx`  
**Bug**: Compared `int.status === 'active'` but `integration_status` enum values are `connected | disconnected | error`. All connected stores rendered as "secondary" (gray) with X-icon, suggesting the connection failed.

**Fix**: Compare against `'connected'` and add `'error'` → destructive variant.

## ✅ What's Working (Production-Ready)

| Component | Status | Notes |
|-----------|--------|-------|
| `pos-woo-connector` (connect/import/push/disconnect) | ✅ | REST validation against `wc/v3/system_status`, upsert with `(merchant_id, type)` unique key |
| `pos-woo-webhook-ingestion` | ✅ | HMAC verified via `compute_woo_webhook_hmac`, dedup via `integration_events_inbox` |
| `pos-inventory-sync` | ✅ | Incremental sync using `last_sync_at` watermark, writes to `integration_sync_runs` |
| `woocommerce-process-payment` | ✅ | Routes to MoMo/Stripe/Bank via existing gateway |
| `woocommerce-payment-webhook` | ✅ | Signature-verified, idempotent |
| `woocommerce-transaction-sync` | ✅ | JSON + CSV export with date/status/method filters |
| `woocommerce-register-merchant` | ✅ | API key + secret + webhook secret generation |
| `woocommerce-download-plugin` | ✅ | In-memory ZIP for PHP plugin |
| Admin → `/admin/woocommerce-plugin` | ✅ | Legacy merchants + transactions + CSV export |
| Institution → `/institution/woocommerce` | ✅ | Per-institution merchant view |
| Storefront → WooConnectTab | ✅ (after fix) | Connect form + connected list |
| Merchant → `/merchant/woo-sync` | ✅ (after fix) | Connected stores, sync runs, manual import & sync |
| Consumer Marketplace (indirect) | ✅ | Imported Woo products surface via `pos-store-browse` → `CustomerStores`/`CustomerStoreDetail` |

## 🟡 Minor Gaps (Not Blocking)

1. **Admin Portal duality**: `/admin/woocommerce-plugin` only shows legacy `woocommerce_merchants`. New POS-Woo connector merchants (using `merchant_integrations`) are not visible to admins. Recommendation logged for future enhancement (additive admin tab).
2. **Institution Dashboard duality**: Same as admin. `/institution/woocommerce` is legacy-only.
3. **Consumer mobile app**: No direct WooCommerce surface (correct by design). Imported Woo products flow into POS catalog and surface via the universal marketplace — verified working through `pos-store-browse`.

These dualities are **intentional**: legacy plugin merchants are a distinct product (KOB-as-gateway for Woo checkout) versus the POS connector (KOB POS importing Woo catalog). Bridging them requires a product decision; deferred.

## Architecture Assessment

### Strengths
- Clean separation: Legacy plugin (gateway) vs POS connector (sync) coexist without conflict
- HMAC-verified webhooks with deduplication inbox
- Watermark-based incremental sync prevents replay
- Schema-level uniqueness on `(merchant_id, type)` prevents duplicate connections
- RLS via `is_merchant_owner()` on all 4 integration tables

### No Gaps Identified For
- Webhook security (HMAC verification + dedup)
- Connection lifecycle (connect → validate → upsert → disconnect)
- Sync auditability (run history with summary JSON + error capture)
- Consumer marketplace surfacing of imported products

## Files Edited
- `src/pages/merchant/MerchantWooSync.tsx` — column name corrections, sync_run status alignment
- `src/components/storefront/WooConnectTab.tsx` — status enum alignment
- `docs/woocommerce/woo-services-e2e-audit-2026-04-19.md` (this report)

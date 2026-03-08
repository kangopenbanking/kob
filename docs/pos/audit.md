# POS Commerce Layer — System Audit
**Date**: 2026-03-08  
**Status**: Phase 0 Complete

## Existing Infrastructure

### 1. Merchant & Gateway Domain
| Table | Purpose | Status |
|-------|---------|--------|
| `gateway_merchants` | Canonical merchant identity (business_name, user_id, institution_id, kyb_status, webhook_secret, limits) | ✅ Live |
| `gateway_charges` | Payment collection records (amount, channel, provider, tx_ref, idempotency_key, merchant_id) | ✅ Live |
| `gateway_refunds` | Refund records (charge_id, amount, provider, reason, idempotency_key) | ✅ Live |
| `gateway_payouts` | Disbursement records (channel, provider, beneficiary, batch_id) | ✅ Live |
| `gateway_merchant_wallets` | Three-state balance: available/pending/ledger per merchant+currency | ✅ Live |
| `gateway_webhook_events` | Outbound merchant webhook delivery queue | ✅ Live |
| `gateway_settlements` | Settlement aggregation | ✅ Live |

### 2. WooCommerce Domain (Existing — LIVE MERCHANTS)
| Table | Purpose | Status |
|-------|---------|--------|
| `woocommerce_merchants` | WooCommerce store registrations (api_key_hash, client_secret_hash, webhook_secret_hash, store_url) | ✅ Live |
| `woocommerce_transactions` | Payment transactions linked to Woo orders | ✅ Live |

**Edge Functions (6 — all live):**
| Function | Purpose |
|----------|---------|
| `woocommerce-register-merchant` | Register new WooCommerce store, generate API keys |
| `woocommerce-process-payment` | Process payment for a WooCommerce order (routes to MoMo/Stripe/Bank) |
| `woocommerce-payment-webhook` | Inbound webhook from Woo plugin, HMAC verified, deduped |
| `woocommerce-transaction-sync` | List/export transactions with filters (JSON/CSV) |
| `woocommerce-validate-install` | Validate API key, return config to plugin |
| `woocommerce-download-plugin` | In-memory ZIP generator for the PHP plugin |

### 3. Payment Providers
- **Flutterwave**: MoMo charges, bank transfers, webhooks (`gateway-webhook-flutterwave`)
- **Stripe**: Card payments (`stripe-payment-intent`, `gateway-webhook-stripe`)
- **PayPal**: Payouts (`gateway-create-paypal-payout`, `gateway-webhook-paypal`)

### 4. Auth & Roles
- `app_role` enum: admin, personal, institution, merchant, tpp, staff, moderator, developer
- `user_roles` table with RLS
- `merchant_staff_roles` for merchant staff isolation
- All edge functions use `verify_jwt = false` + manual JWT validation

### 5. Existing Atomic DB Functions
- `atomic_charge_wallet_credit` — atomic charge status + wallet credit
- `atomic_refund_wallet_debit` — atomic refund status + wallet debit
- `atomic_dispute_wallet_adjust` — dispute-driven wallet adjustments
- `compute_woo_webhook_hmac` — HMAC verification for Woo webhooks
- `calculate_transaction_fee` — fee resolution engine

## What's Missing for POS

| Component | Status |
|-----------|--------|
| Product Catalog (products, variants, categories) | ❌ Not implemented |
| Inventory Management (items, movements, locations) | ❌ Not implemented |
| POS Orders (orders, order_items, order_payments) | ❌ Not implemented |
| Returns/Refunds (returns, return_items) | ❌ Not implemented |
| Merchant Locations | ❌ Not implemented |
| Merchant Staff (POS cashier role + PIN) | ❌ Not implemented |
| WooCommerce Product Import | ❌ Not implemented |
| WooCommerce Order Sync | ❌ Not implemented |
| Integration Mappings (Woo ↔ KOB entity linking) | ❌ Not implemented |
| Integration Event Inbox (deduped webhook ingestion) | ❌ Not implemented |

## Safe Plan
1. All new tables are **additive** — zero changes to existing tables
2. New edge functions use new `/pos-*` and `/woo-*` prefixes — no route conflicts
3. Existing `woocommerce-*` functions remain untouched (live merchants)
4. New POS orders link to existing `gateway_charges`/`gateway_refunds` via `order_payments`
5. Merchant identity reuses `gateway_merchants` — no new merchant table needed
6. Default currency: XAF, default country: CM

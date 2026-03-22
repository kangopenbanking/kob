# KOB Code Parity Table — Phase 0

**Date**: 2026-03-22

---

## Spec Endpoints Missing Implementation

**None** — All 97 OpenAPI operations have corresponding edge function implementations.

## Implemented Endpoints Missing Spec Documentation

The platform has **338 edge functions** total. Of these:
- 97 are documented in the public OpenAPI spec
- ~241 are internal/admin functions not exposed in the public API

Internal functions include admin dashboards, cron jobs, email processing, and internal orchestration. These are correctly excluded from the public spec.

## Response Shape Mismatches

| Endpoint | Issue | Status |
|----------|-------|--------|
| None identified | Edge functions return shapes matching OpenAPI component schemas | ✅ |

## Inbound Webhook Handlers

| Provider | Function | Signature Verification | Deduplication | Status |
|----------|----------|----------------------|---------------|--------|
| Stripe | `gateway-webhook-stripe` | ✅ HMAC-SHA256 (Web Crypto) | ✅ `webhook_inbox` | ✅ Implemented |
| Flutterwave | `gateway-webhook-flutterwave` | ✅ `verif-hash` header | ✅ `webhook_inbox` | ✅ Implemented |
| PayPal | `gateway-webhook-paypal` | ✅ PayPal verification API | ✅ `webhook_inbox` | ✅ Implemented |
| Payout (multi-provider) | `gateway-payout-webhook` | ✅ Per-provider | ✅ `webhook_inbox` | ✅ Implemented |

## Merchant Platform

| Feature | Edge Function | DB Table | Status |
|---------|-------------|----------|--------|
| Merchant CRUD | `gateway-merchant-lifecycle` | `gateway_merchants` | ✅ |
| KYB Submit/Review | `gateway-merchant-kyb` | metadata on merchants | ✅ |
| API Keys | `gateway-merchant-keys` | `api_credentials` | ✅ |
| Webhooks Config | `gateway-merchant-webhooks` | `gateway_webhook_endpoints` | ✅ |
| Settlement Accounts | `gateway-merchant-lifecycle` | `merchant_settlement_accounts` | ✅ |
| Wallet Balances | `atomic_charge_wallet_credit` | `gateway_merchant_wallets` | ✅ |

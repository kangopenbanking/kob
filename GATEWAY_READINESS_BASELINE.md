# KOB Gateway Readiness Baseline — Phase 0

**Date**: 2026-03-22  
**Version**: v4.1.0  
**Auditor**: Platform Engineering

---

## A) OpenAPI Contract Coverage (Static `public/openapi.json`)

| Metric | Count | % |
|--------|-------|---|
| Total operations | 97 | — |
| Ops with 2xx response code | 97 | 100% |
| Ops with typed 2xx JSON schema | **1** | **1%** ⚠️ |
| Ops with error responses (400/401/500) | 10 | 10% ⚠️ |
| Ops with examples | 0 | 0% |

> **Root cause**: The edge function `public-api-spec` was hardened to 100% typed schemas (v4.1.0), but the **static** `public/openapi.json` was never synced.  
> This means the API Explorer (Swagger UI) loads the hardened spec at runtime, but any static consumers (crawlers, CI, SDK generators) get the stale file.

### Operations Missing Typed 2xx Schema (static file — 96/97)

All 96 non-health endpoints lack `content.application/json.schema` in the static file.

### Edge Function Spec (Source of Truth)

| Metric | Count | % |
|--------|-------|---|
| Ops with typed 2xx JSON schema | 97 | **100%** ✅ |
| Ops with error responses | 97 | **100%** ✅ |
| Defined component schemas | 35+ | — |

---

## B) Backend Implementation Status

| Domain | Spec Endpoints | Edge Functions | Status |
|--------|---------------|----------------|--------|
| Gateway Charges | 8 | gateway-create-charge, gateway-capture-charge, etc. | ✅ Parity |
| Gateway Payouts | 6 | gateway-create-payout, gateway-payout-rails, etc. | ✅ Parity |
| Gateway Refunds | 2 | gateway-create-refund | ✅ Parity |
| Gateway Disputes | 3 | gateway-file-dispute, gateway-submit-dispute-evidence | ✅ Parity |
| Gateway Settlements | 3 | gateway-settlement-cron, gateway-report-settlements | ✅ Parity |
| Merchant Onboarding | 10 | gateway-merchant-lifecycle, gateway-merchant-keys, gateway-merchant-kyb | ✅ Parity |
| Webhooks (Inbound) | 3 | gateway-webhook-stripe, gateway-webhook-flutterwave, gateway-webhook-paypal | ✅ Parity |
| Webhooks (Outbound) | 3 | gateway-deliver-webhook, gateway-merchant-webhooks | ✅ Parity |
| OAuth/Auth | 12 | oauth-token, oauth-authorize, phone-auth-* | ✅ Parity |
| AISP/PISP | 10 | aisp-accounts, pisp-domestic-payment | ✅ Parity |
| POS Commerce | 12 | pos-* functions | ✅ Parity |
| **Total Edge Functions** | — | **338** | — |

---

## C) Gateway Behavior Checklist

| Behavior | Status | Implementation |
|----------|--------|----------------|
| Idempotency-Key enforcement | ✅ Pass | `idempotency_keys` table, 24h TTL, 409 on conflict |
| Webhook HMAC signing (outbound) | ✅ Pass | `compute_webhook_hmac` SECURITY DEFINER function |
| Stripe inbound signature verification | ✅ Pass | HMAC-SHA256 via Web Crypto API |
| Flutterwave inbound hash verification | ✅ Pass | `verif-hash` header check |
| PayPal inbound signature verification | ✅ Pass | `verifyPayPalWebhookSignature` API flow |
| Webhook deduplication | ✅ Pass | `webhook_inbox` table, event_id uniqueness |
| Webhook retry (exponential backoff) | ✅ Pass | 7 attempts, 2^n minutes |
| Rate limiting + Retry-After | ✅ Pass | `check_rate_limit` + `check_webhook_rate_limit` |
| Standard error shape | ✅ Pass | RFC 7807 `Error` schema with `error_id` |
| Audit logs | ✅ Pass | `audit_logs` table + `log_audit_event` function |
| Ledger posting (atomic) | ✅ Pass | `atomic_charge_wallet_credit` function |
| XAF-first currency | ✅ Pass | All examples default XAF |

---

## D) Identified Gaps (P0)

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 1 | Static `public/openapi.json` not synced with edge function spec | P0 | Sync at build time |
| 2 | No `/developer/api-explorer-static` fallback route | P1 | Add Redoc static page |
| 3 | Missing `test-webhooks.md` in sandbox docs | P1 | Create guide |
| 4 | No `openapi-sandbox.json` variant | P2 | Generate sandbox-specific spec |

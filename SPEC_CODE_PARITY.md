# Spec ↔ Code Parity Report
**Date**: 2026-03-22

## Summary
- **Total OpenAPI operations**: 326
- **Edge functions**: 338
- **Spec endpoints missing implementation**: 0 (all mapped to edge functions)
- **Implemented endpoints missing spec**: ~12 internal/admin-only functions (not public API)

## Provider Webhook Endpoints (Critical)

| Spec Path | Edge Function | Implemented |
|-----------|--------------|-------------|
| POST /v1/webhooks/inbound/stripe | gateway-webhook-stripe | ✅ |
| POST /v1/webhooks/inbound/flutterwave | gateway-webhook-flutterwave | ✅ |
| POST /v1/webhooks/inbound/paypal | gateway-webhook-paypal | ✅ |

## Merchant Endpoints

| Spec Path | Edge Function | Implemented |
|-----------|--------------|-------------|
| POST /v1/merchants/kyb | gateway-merchant-kyb | ✅ |
| GET /v1/merchants/kyb/status | gateway-merchant-kyb | ✅ |
| POST /v1/merchants/api-keys | gateway-merchant-keys | ✅ |
| POST /v1/merchants/api-keys/rotate | gateway-merchant-keys | ✅ |
| DELETE /v1/merchants/api-keys/{id} | gateway-merchant-keys | ✅ |
| POST /v1/merchants/settlement-accounts | gateway-merchant-settlement-accounts | ✅ |
| POST /v1/merchants/webhooks | gateway-merchant-webhooks | ✅ |

## Gateway Core

| Spec Path | Edge Function | Implemented |
|-----------|--------------|-------------|
| POST /v1/gateway/charges | gateway-create-charge | ✅ |
| POST /v1/gateway/charges/{id}/verify | gateway-charges (verify) | ✅ |
| POST /v1/gateway/refunds | gateway-refunds | ✅ |
| POST /v1/gateway/payouts | gateway-create-payout | ✅ |
| POST /v1/gateway/payouts/batch | gateway-create-payout-batch | ✅ |

**Result: PASS** — No public spec endpoints missing implementation.
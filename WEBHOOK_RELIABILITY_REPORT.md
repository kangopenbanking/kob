# KOB Webhook Reliability Report — v4.2.1

**Date**: 2026-03-22

## Inbound Provider Webhooks

| Provider | Endpoint | Signature | Dedupe | Rate Limit | E2E Test |
|----------|----------|-----------|--------|------------|----------|
| Stripe | gateway-webhook-stripe | ✅ HMAC-SHA256 (stripe-signature) | ✅ webhook_inbox | ✅ 100/min | ✅ PASS |
| Flutterwave | gateway-webhook-flutterwave | ✅ verif-hash header | ✅ webhook_inbox | ✅ 100/min | ✅ PASS |
| PayPal | gateway-webhook-paypal | ✅ PayPal verification API | ✅ webhook_inbox | ✅ | ✅ PASS |
| Payout | gateway-payout-webhook | ✅ Per-provider | ✅ webhook_inbox | ✅ | ✅ PASS |
| Remittance | remittance-webhook-ingest | ✅ Per-partner adapter | ✅ webhook_inbox | ✅ 200/min | ✅ PASS |

## Outbound Merchant Webhooks

| Feature | Status |
|---------|--------|
| Multi-endpoint registration | ✅ gateway-merchant-webhooks |
| HMAC-SHA256 signing | ✅ compute_webhook_hmac |
| Secret rotation | ✅ |
| Delivery logs | ✅ webhook_deliveries table |
| 7-attempt exponential backoff | ✅ gateway-webhook-deliver-v2 |
| Event catalogue (24 types) | ✅ |

## Security Tests

| Test | Result |
|------|--------|
| Stripe: reject missing signature | ✅ PASS |
| Stripe: reject invalid signature | ✅ PASS |
| Flutterwave: reject missing verif-hash | ✅ PASS |
| Flutterwave: reject invalid verif-hash | ✅ PASS |

**Verdict: ALL PASS ✅**

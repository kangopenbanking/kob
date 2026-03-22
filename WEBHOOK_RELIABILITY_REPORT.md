# Webhook Reliability Report
**Date**: 2026-03-22

## Inbound Provider Webhooks

### Stripe (gateway-webhook-stripe)
- **Signature**: HMAC-SHA256 via `stripe-signature` header ✅
- **Secret**: STRIPE_WEBSECRET_KEY (required, rejects if missing) ✅
- **Rate limiting**: 100 req/min via check_webhook_rate_limit RPC ✅
- **Dedupe**: webhook_inbox table by event_id ✅
- **State updates**: Maps Stripe status → gateway_charges/payouts ✅
- **Funding**: Credits funding_intents via creditFundingIntent ✅

### Flutterwave (gateway-webhook-flutterwave)
- **Signature**: verif-hash header matches FLUTTERWAVE_ENCRYPTION_KEY ✅
- **Rate limiting**: 100 req/min ✅
- **Dedupe**: webhook_inbox by flw_{event_id} ✅
- **State updates**: Maps FLW status → gateway_charges ✅
- **Refund/Payout handling**: Separate processing paths ✅

### PayPal (gateway-webhook-paypal)
- **Signature**: PayPal cert-based verification via verifyPayPalWebhookSignature ✅
- **Secret**: PAYPAL_WEBHOOK_ID (required) ✅
- **Dedupe**: webhook_inbox by event_id ✅
- **State updates**: Maps PayPal event types → charges/payouts/disputes ✅

## Outbound Merchant Webhooks
- **Registration**: gateway-webhook-endpoints ✅
- **Signing**: HMAC-SHA256 via compute_webhook_hmac RPC (secret never leaves DB) ✅
- **Delivery**: gateway-deliver-webhook with 7-attempt exponential backoff ✅
- **Headers**: X-KOB-Signature, X-KOB-Timestamp, X-KOB-Event-Type, X-KOB-Event-ID ✅
- **Timeout**: 10s per delivery attempt ✅

## Result: ✅ PASS — Professional webhook reliability achieved
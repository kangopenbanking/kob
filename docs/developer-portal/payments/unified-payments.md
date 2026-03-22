# Unified Payments

## Overview

KOB provides a single `POST /v1/gateway/charges` endpoint that routes payments to the correct provider based on the `channel` parameter. This abstracts away provider-specific APIs (Flutterwave, Stripe, PayPal) behind a unified interface.

## Supported Channels

| Channel | Provider | Currencies | Regions |
|---------|----------|-----------|---------|
| `mobile_money` | Flutterwave | XAF, XOF, NGN | Cameroon, CEMAC, Nigeria |
| `card` | Stripe / Flutterwave | XAF, USD, EUR, GBP | Global |
| `bank_transfer` | Flutterwave | XAF, NGN | Cameroon, Nigeria |
| `ussd` | Flutterwave | NGN | Nigeria |
| `paypal` | PayPal | USD, EUR, GBP | Global |
| `apple_pay` | Stripe | USD, EUR, GBP | Supported regions |
| `google_pay` | Stripe | USD, EUR, GBP | Supported regions |

## Create a Charge

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/charges \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order_12345" \
  -d '{
    "merchant_id": "merch_uuid",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "237677123456",
    "tx_ref": "order_12345",
    "metadata": { "order_id": "ORD-001" }
  }'
```

### Response

```json
{
  "id": "chg_abc123",
  "merchant_id": "merch_uuid",
  "amount": 5000,
  "currency": "XAF",
  "channel": "mobile_money",
  "status": "pending",
  "tx_ref": "order_12345",
  "provider": "flutterwave",
  "redirect_url": "https://checkout.flutterwave.com/...",
  "created_at": "2026-03-22T10:00:00Z"
}
```

## Charge Statuses

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `pending` | Created, awaiting customer action | No |
| `processing` | Payment initiated with provider | No |
| `successful` | Payment confirmed | Yes |
| `failed` | Payment failed | Yes |
| `cancelled` | Cancelled by merchant or customer | Yes |
| `refunded` | Fully refunded | Yes |

## Verify a Charge

Poll the provider for real-time status:

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/charges/{charge_id}/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Webhook Events

| Event | Trigger |
|-------|---------|
| `charge.created` | Charge record created |
| `charge.processing` | Provider processing started |
| `charge.successful` | Payment confirmed |
| `charge.failed` | Payment failed |
| `charge.cancelled` | Charge cancelled |
| `charge.refunded` | Full refund completed |

## Idempotency

All charge creation requests **must** include an `Idempotency-Key` header. Duplicate keys within 24 hours return the original response without creating a new charge.

## Error Codes

| Code | Description |
|------|-------------|
| `insufficient_funds` | Customer has insufficient balance |
| `invalid_channel` | Unsupported payment channel |
| `merchant_not_found` | Invalid merchant_id |
| `duplicate_tx_ref` | tx_ref already used for this merchant |
| `provider_error` | Upstream provider returned an error |

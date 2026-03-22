# Merchant Webhooks

## Overview

Merchants can subscribe to real-time event notifications. KOB delivers webhooks with HMAC-SHA256 signatures for verification.

## Register a Webhook

```bash
curl -X POST https://api.kangopenbanking.com/v1/merchants/webhooks?merchant_id=merch_uuid \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: wh_setup_001" \
  -d '{
    "url": "https://yourapp.com/webhooks/kob",
    "events": ["charge.successful", "payout.completed", "dispute.created"],
    "label": "Production"
  }'
```

### Response

```json
{
  "id": "wh_abc123",
  "url": "https://yourapp.com/webhooks/kob",
  "events": ["charge.successful", "payout.completed", "dispute.created"],
  "secret": "whsec_abc123def456...",
  "status": "active"
}
```

> ⚠️ The `secret` is shown **only once**. Store it securely.

## Verify Signatures

Every webhook includes these headers:

| Header | Description |
|--------|-------------|
| `X-KOB-Signature` | HMAC-SHA256 hex digest |
| `X-KOB-Timestamp` | Unix timestamp |
| `X-KOB-Event-Type` | Event type string |
| `X-KOB-Event-ID` | Unique event ID |

### Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Verification (PHP)

```php
$expected = hash_hmac('sha256', "$timestamp.$payload", $secret);
$valid = hash_equals($expected, $signature);
```

## Delivery & Retries

- KOB expects a `2xx` response within **10 seconds**.
- Failed deliveries are retried with exponential backoff: 2m, 4m, 8m, 16m, 32m, 64m, 128m (7 attempts).
- After 7 failures, the event is marked as `failed`.
- Delivery logs are available via the API or merchant dashboard.

## Supported Events (24 types)

### Charges
`charge.created`, `charge.processing`, `charge.successful`, `charge.failed`, `charge.cancelled`, `charge.voided`, `charge.captured`, `charge.refunded`

### Payouts
`payout.created`, `payout.processing`, `payout.completed`, `payout.failed`

### Refunds
`refund.created`, `refund.completed`, `refund.failed`

### Disputes
`dispute.created`, `dispute.won`, `dispute.lost`

### Settlements
`settlement.paid`

### Consents (AISP/PISP)
`consent.created`, `consent.authorised`, `consent.revoked`, `consent.expired`

### Accounts
`account.updated`

## Secret Rotation

Rotate your webhook secret without downtime:

```bash
curl -X PATCH https://api.kangopenbanking.com/v1/merchants/webhooks?merchant_id=merch_uuid&webhook_id=wh_abc123&action=rotate_secret \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The response contains the new secret. Update your handler, then both old and new secrets are valid for 24 hours.

# Webhooks Overview

## How KOB Webhooks Work

KOB sends HTTP POST requests to your registered endpoints when events occur (e.g., payment completed, payout failed).

## Event Types (24 supported)

| Event | Description |
|---|---|
| `charge.successful` | Payment completed |
| `charge.failed` | Payment failed |
| `charge.pending` | Payment pending confirmation |
| `refund.completed` | Refund processed |
| `refund.failed` | Refund failed |
| `payout.completed` | Payout delivered |
| `payout.failed` | Payout failed |
| `payout.reversed` | Payout reversed |
| `dispute.opened` | New dispute filed |
| `dispute.won` | Dispute resolved in merchant's favor |
| `dispute.lost` | Dispute resolved against merchant |
| `settlement.created` | New settlement ready |
| `subscription.charged` | Recurring charge processed |
| `subscription.cancelled` | Subscription cancelled |
| `transfer.completed` | Transfer completed |
| `transfer.failed` | Transfer failed |
| `kyb.approved` | KYB verified |
| `kyb.rejected` | KYB rejected |
| `merchant.activated` | Merchant activated |
| `merchant.suspended` | Merchant suspended |
| `virtual_account.credited` | Virtual account received funds |
| `funding_intent.completed` | Funding intent finalized |
| `funding_intent.failed` | Funding intent failed |
| `compliance.alert` | Compliance screening alert |

## Webhook Payload

```json
{
  "event": "charge.successful",
  "data": {
    "id": "chg_xxxx",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "tx_ref": "ORD-001",
    "created_at": "2026-03-22T10:00:00Z"
  },
  "created_at": "2026-03-22T10:00:01Z"
}
```

## Signature Verification

Every webhook includes an `x-webhook-signature` header containing an HMAC-SHA256 signature.

### Node.js
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Python
```python
import hmac, hashlib, json

def verify_webhook(payload: dict, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## Retry Policy

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 30 minutes |
| 6 | 2 hours |
| 7 | 6 hours |

After 7 failed attempts, the webhook is marked as failed. You can manually retry from the Merchant Portal.

## Requirements

- Respond with `200` within 30 seconds
- Use HTTPS endpoints only
- Verify the signature before processing
- Implement idempotent handling (events may be delivered more than once)
- Deduplicate using the event `id` field

## Secret Rotation

Rotate your webhook signing secret without downtime:
1. Generate a new secret in Merchant Portal → Webhooks
2. During rotation, both old and new secrets are valid
3. Update your verification code to use the new secret
4. The old secret expires after 24 hours

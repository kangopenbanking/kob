# Merchant Webhook Integration Guide

> Receive real-time notifications for payment events.

## Overview

KOB sends HTTP POST requests to your registered endpoint when payment events occur. All webhooks include HMAC-SHA256 signatures for verification.

## Setup

### Register Endpoint

**Via Merchant Portal**: Navigate to **Webhooks → Add Endpoint**

**Via API**:
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-webhook-endpoints \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yoursite.com/webhooks/kob",
    "events": ["charge.successful", "charge.failed", "refund.successful", "payout.successful", "payout.failed"],
    "description": "Production webhook"
  }'
```

## Event Catalogue

| Event | Trigger | Payload Key Fields |
|---|---|---|
| `charge.successful` | Payment completed | `charge_id`, `amount`, `currency`, `provider` |
| `charge.failed` | Payment failed | `charge_id`, `error_message` |
| `charge.pending` | Payment pending provider confirmation | `charge_id`, `provider_ref` |
| `refund.successful` | Refund processed | `refund_id`, `charge_id`, `amount` |
| `refund.failed` | Refund failed | `refund_id`, `error_message` |
| `payout.successful` | Payout sent | `payout_id`, `amount`, `destination` |
| `payout.failed` | Payout failed | `payout_id`, `error_message` |
| `dispute.created` | Dispute opened | `dispute_id`, `charge_id`, `reason` |
| `settlement.completed` | Settlement batch done | `settlement_id`, `total_amount` |

## Payload Format

```json
{
  "event": "charge.successful",
  "timestamp": "2026-03-15T10:30:00Z",
  "data": {
    "charge_id": "chg_abc123",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "provider": "flutterwave",
    "payment_type": "mobile_money_cameroon",
    "customer": {
      "phone": "237650000000",
      "name": "Jean Kamga"
    },
    "metadata": { "order_id": "ORD-001" }
  }
}
```

## Signature Verification

Every webhook includes:
```
X-KOB-Signature: sha256=<hex_hmac_digest>
X-KOB-Timestamp: 1710496200
X-KOB-Event: charge.successful
```

### Verification (Node.js)
```javascript
const crypto = require('crypto');

function verifyKOBWebhook(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

// Express middleware
app.post('/webhooks/kob', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-kob-signature'];
  
  if (!verifyKOBWebhook(req.body, signature, process.env.KOB_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(req.body);
  
  switch (event.event) {
    case 'charge.successful':
      // Fulfill order
      break;
    case 'charge.failed':
      // Notify customer
      break;
    case 'refund.successful':
      // Update refund status
      break;
  }
  
  res.status(200).send('OK');
});
```

### Verification (Python)
```python
import hmac
import hashlib

def verify_kob_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), payload, hashlib.sha256
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
| 5 | 1 hour |
| 6 | 6 hours |
| 7 | 24 hours |

After 7 failed attempts, the event is marked as failed. You can view delivery logs in **Merchant Portal → Webhooks → Deliveries**.

## Best Practices

1. **Respond with 200 quickly** — process asynchronously
2. **Verify signatures** — reject unsigned requests
3. **Handle duplicates** — use `charge_id` as idempotency key
4. **Log raw payloads** — for debugging and reconciliation
5. **Use HTTPS** — plaintext endpoints are rejected in production

# Webhooks Guide

> Receive real-time notifications when events occur in the Kang Open Banking platform.

---

## Overview

KOB delivers webhook notifications via HTTPS POST to your registered endpoint whenever key events occur — charge completions, payout status changes, consent updates, and more. All webhooks are signed with HMAC-SHA256, deduplicated, and retried on failure.

---

## Managing Webhook Endpoints

### Register a Webhook Endpoint

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/webhooks \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "url": "https://yourapp.com/webhooks/kob",
    "events": ["charge.successful", "charge.failed", "consent.revoked"],
    "secret": "whsec_your_signing_secret_here"
  }'
```

**Response:**
```json
{
  "webhook_id": "wh_abc123",
  "url": "https://yourapp.com/webhooks/kob",
  "events": ["charge.successful", "charge.failed", "consent.revoked"],
  "is_active": true,
  "created_at": "2026-02-16T10:00:00Z"
}
```

### List Webhook Endpoints

```bash
curl https://api.kangopenbanking.com/v1/gateway/webhooks \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Get Webhook Deliveries

```bash
curl https://api.kangopenbanking.com/v1/gateway/webhooks/{webhookId}/deliveries \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Update a Webhook Endpoint

```bash
curl -X PUT https://api.kangopenbanking.com/v1/gateway/webhooks/{webhookId} \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": ["charge.successful", "charge.failed", "payout.completed", "consent.revoked"],
    "url": "https://yourapp.com/webhooks/kob-v2"
  }'
```

### Delete a Webhook Endpoint

```bash
curl -X DELETE https://api.kangopenbanking.com/v1/gateway/webhooks/{webhookId} \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## Webhook Payload Format

Every webhook delivery follows this envelope:

```json
{
  "event": "charge.successful",
  "event_id": "evt_a1b2c3d4e5f6",
  "timestamp": "2026-02-16T10:05:00Z",
  "data": {
    "charge_id": "ch_xyz789",
    "amount": 50000,
    "currency": "XAF",
    "status": "successful",
    "channel": "mobile_money_mtn",
    "tx_ref": "ref_001",
    "merchant_id": "mer_abc123"
  }
}
```

### Headers

| Header | Description |
|---|---|
| `Content-Type` | `application/json` |
| `x-webhook-signature` | HMAC-SHA256 hex digest of the raw body |
| `x-webhook-id` | Unique delivery ID (for deduplication) |
| `x-webhook-timestamp` | ISO 8601 timestamp of delivery attempt |

---

## Signature Verification

Every webhook is signed using HMAC-SHA256 with the secret you provided during registration. **Always verify signatures before processing.**

### Algorithm

1. Read the raw request body as a UTF-8 string
2. Compute HMAC-SHA256 using your webhook secret as the key
3. Compare the hex digest with the `x-webhook-signature` header
4. Reject with `401` if they don't match

### JavaScript / Node.js

```javascript
const crypto = require("crypto");

function verifyWebhook(rawBody, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

// Express middleware example
app.post("/webhooks/kob", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const rawBody = req.body.toString("utf8");

  if (!verifyWebhook(rawBody, signature, process.env.KOB_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody);
  console.log("Received event:", event.event, event.event_id);

  // Process the event (idempotently!)
  // ...

  res.status(200).json({ received: true });
});
```

### Python

```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = "whsec_your_signing_secret_here"

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route("/webhooks/kob", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("x-webhook-signature", "")
    raw_body = request.get_data()

    if not verify_signature(raw_body, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.get_json()
    print(f"Received: {event['event']} ({event['event_id']})")

    # Process idempotently using event_id
    # ...

    return jsonify({"received": True}), 200
```

### PHP

```php
<?php
$webhookSecret = "whsec_your_signing_secret_here";

$rawBody = file_get_contents("php://input");
$signature = $_SERVER["HTTP_X_WEBHOOK_SIGNATURE"] ?? "";

$expected = hash_hmac("sha256", $rawBody, $webhookSecret);

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid signature"]);
    exit;
}

$event = json_decode($rawBody, true);
error_log("Received: " . $event["event"] . " (" . $event["event_id"] . ")");

// Process idempotently using event_id
// ...

http_response_code(200);
echo json_encode(["received" => true]);
```

---

## Retry Policy

KOB retries failed webhook deliveries using exponential backoff:

| Attempt | Delay | Cumulative Wait |
|---|---|---|
| 1 (initial) | Immediate | 0 |
| 2 | 30 seconds | 30s |
| 3 | 2 minutes | 2m 30s |
| 4 | 10 minutes | 12m 30s |
| 5 | 1 hour | 1h 12m 30s |
| 6 | 4 hours | 5h 12m 30s |
| 7 (final) | 12 hours | 17h 12m 30s |

### Retry Rules

- A delivery is considered **successful** if your endpoint returns `2xx` within **30 seconds**
- Any `4xx` response (except `429`) **stops retries immediately** (the payload is malformed or rejected)
- `429` and `5xx` responses trigger the next retry attempt
- **Timeouts** (no response within 30s) count as failures and trigger retry
- After all 7 attempts fail, the webhook is marked as `failed` and logged

### Monitoring Failed Deliveries

```bash
curl https://api.kangopenbanking.com/v1/gateway/webhooks/{webhookId}/deliveries?status=failed \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## Event Types

KOB supports **24 canonical event types** across 7 domains. When registering a webhook endpoint, use these exact event names in the `events` array.

### Charge Events

| Event | Trigger |
|---|---|
| `charge.created` | A new charge has been created |
| `charge.processing` | Charge is being processed by the payment provider |
| `charge.successful` | Charge completed successfully — funds collected |
| `charge.failed` | Charge attempt failed |
| `charge.cancelled` | Charge was cancelled before completion |
| `charge.voided` | Pre-authorized charge was voided |
| `charge.captured` | Pre-authorized charge was captured |
| `charge.refunded` | Charge was fully or partially refunded |

### Payout Events

| Event | Trigger |
|---|---|
| `payout.created` | A new payout (bank transfer or MoMo disbursement) was created |
| `payout.processing` | Payout is being processed |
| `payout.completed` | Payout settled successfully |
| `payout.failed` | Payout attempt failed |

### Refund Events

| Event | Trigger |
|---|---|
| `refund.created` | A refund was initiated |
| `refund.completed` | Refund processed successfully |
| `refund.failed` | Refund attempt failed |

### Dispute Events

| Event | Trigger |
|---|---|
| `dispute.created` | A new chargeback/dispute was filed |
| `dispute.won` | Dispute resolved in merchant's favor |
| `dispute.lost` | Dispute resolved in customer's favor |

### Settlement Events

| Event | Trigger |
|---|---|
| `settlement.paid` | Merchant settlement was paid out |

### Consent Events

| Event | Trigger |
|---|---|
| `consent.created` | AISP or PISP consent created |
| `consent.authorised` | Customer authorized the consent |
| `consent.revoked` | Consent revoked by customer or TPP |
| `consent.expired` | Consent reached expiration date |

### Account Events

| Event | Trigger |
|---|---|
| `account.updated` | Account details or status changed |

---

## Deduplication

Webhook deliveries may be sent more than once (due to retries or network issues). Use the `event_id` field to deduplicate:

1. When you receive a webhook, check if `event_id` has been processed before
2. If already processed, return `200` immediately without re-processing
3. If new, process the event and store the `event_id`

```javascript
// Example: Redis-based deduplication
async function handleWebhook(event) {
  const key = `webhook:${event.event_id}`;
  const exists = await redis.get(key);
  if (exists) {
    console.log(`Duplicate webhook skipped: ${event.event_id}`);
    return { status: 200, body: { received: true, duplicate: true } };
  }

  // Process the event
  await processEvent(event);

  // Mark as processed with 24h TTL
  await redis.set(key, "1", "EX", 86400);
  return { status: 200, body: { received: true } };
}
```

---

## Error Codes

| Code | Description |
|---|---|
| WH_001 | Invalid webhook signature |
| WH_002 | Webhook delivery failed (all retries exhausted) |
| WH_003 | Unsupported event type in subscription |
| WH_004 | Webhook endpoint unreachable |
| WH_005 | Webhook endpoint not found |
| WH_006 | Maximum webhook endpoints limit reached |

---

## Best Practices

1. **Always verify signatures** — never process unsigned or mis-signed payloads
2. **Return 200 quickly** — do heavy processing asynchronously after acknowledging receipt
3. **Idempotent handlers** — use `event_id` to prevent duplicate processing
4. **Use HTTPS** — plaintext HTTP endpoints will be rejected
5. **Monitor delivery failures** — check `/v1/gateway/webhooks/{webhookId}/deliveries?status=failed` regularly
6. **Rotate secrets periodically** — update your webhook secret and re-register

---

## Next Steps

- [Quick Start](/developer/getting-started) — Get your first API call running
- [Authentication](/developer/authentication) — OAuth grants, DCR, and PKCE
- [PISP Guide](/developer/guides/pisp) — Payment initiation lifecycle
- [Error Reference](/developer/guides/error-reference) — Complete error code catalogue
- [Gateway Guide](/developer/gateway) — Payment gateway integration

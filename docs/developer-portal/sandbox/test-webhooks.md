# Testing Webhooks in Sandbox

## Overview

KOB provides tools to test your webhook integration without making real payments. You can simulate provider events, verify your signature verification code, and inspect delivery logs.

## Simulating Webhook Events

### Using the Merchant Dashboard

1. Navigate to **Merchant Portal → Webhooks → Test**
2. Select an event type (e.g., `charge.successful`)
3. Click **Send Test Event**
4. Check your endpoint received the payload

### Using the API

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-merchant-webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "webhook_id": "wh_xxxx",
    "event_type": "charge.successful"
  }'
```

### Response

```json
{
  "success": true,
  "delivery_id": "del_xxxx",
  "status_code": 200,
  "response_time_ms": 145
}
```

## Verifying Signatures in Sandbox

Sandbox webhooks use the same HMAC-SHA256 signing as production. Your webhook secret is available in the Merchant Portal under **Webhooks → Secret**.

### Node.js Verification

```javascript
const crypto = require('crypto');

function verifyKOBWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express middleware
app.post('/webhooks/kob', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  if (!verifyKOBWebhook(req.body, signature, process.env.KOB_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.body;
  console.log('Event type:', event.event);
  console.log('Data:', event.data);
  
  // Process the event
  switch (event.event) {
    case 'charge.successful':
      // Handle successful payment
      break;
    case 'payout.completed':
      // Handle payout completion
      break;
  }
  
  res.status(200).json({ received: true });
});
```

### Python Verification

```python
import hmac, hashlib, json
from flask import Flask, request, jsonify

app = Flask(__name__)

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhooks/kob', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('x-webhook-signature')
    if not verify_webhook(request.json, signature, KOB_WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    event = request.json
    print(f"Event: {event['event']}, Data: {event['data']}")
    return jsonify({'received': True}), 200
```

## Inspecting Delivery Logs

View all webhook delivery attempts in the Merchant Portal under **Webhooks → Delivery Logs**. Each log entry shows:

| Field | Description |
|-------|-------------|
| `delivery_id` | Unique delivery identifier |
| `event_type` | The event that triggered the webhook |
| `status_code` | HTTP status code returned by your endpoint |
| `response_time_ms` | How long your endpoint took to respond |
| `attempt` | Which retry attempt (1-7) |
| `created_at` | When the delivery was attempted |

## Simulating Provider Webhooks

To test how KOB processes inbound provider events (e.g., Stripe, Flutterwave), you can use the provider's own test tools:

### Stripe

```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata.tx_ref=TEST-001
```

### Flutterwave

Use the Flutterwave dashboard **Webhooks → Test** feature to send simulated events.

### PayPal

Use the PayPal Sandbox **Webhooks Simulator** to generate test events.

## Deduplication Testing

Send the same webhook event twice to verify your integration handles duplicates:

```bash
# First delivery — should process
curl -X POST https://your-endpoint.com/webhooks/kob \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: abc123..." \
  -d '{"event": "charge.successful", "data": {"id": "chg_test_001"}}'

# Second delivery — should be idempotent (no double processing)
curl -X POST https://your-endpoint.com/webhooks/kob \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: abc123..." \
  -d '{"event": "charge.successful", "data": {"id": "chg_test_001"}}'
```

## Retry Behavior in Sandbox

Sandbox uses the same retry policy as production:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 30 minutes |
| 6 | 2 hours |
| 7 | 6 hours |

If your endpoint returns a non-2xx status, KOB will retry up to 7 times with exponential backoff.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Not receiving webhooks | Verify your endpoint URL is correct and publicly accessible |
| Signature verification fails | Ensure you're using the correct webhook secret from the portal |
| Duplicate events processed | Implement idempotency using the event `data.id` field |
| Timeout errors | Ensure your endpoint responds within 30 seconds |

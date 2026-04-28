# Webhook Signature Verification — Reference Snippet

Runtime emits the following headers from `gateway-webhook-deliver-v2`:

- `X-Webhook-Signature` — HMAC-SHA256 of the raw request body using your endpoint secret.
- `X-Webhook-Event` — event type (e.g. `charge.succeeded`).
- `X-Webhook-Timestamp` — Unix seconds; reject deliveries older than 5 minutes to prevent replay.

```js
// Node.js verification (must match runtime in gateway-webhook-deliver-v2)
import crypto from 'node:crypto';

export function verify(rawBody, headers, secret) {
  const sig = headers['x-webhook-signature'];
  const ts  = headers['x-webhook-timestamp'];
  if (!sig || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay guard
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

# Webhook Signature Verification — Reference Snippet

The runtime delivery worker `gateway-webhook-deliver-v2` emits the following headers:

- `X-Webhook-Signature` — `HMAC-SHA256(rawBody, endpointSecret)` encoded as lowercase hex.
- `X-Webhook-Event` — event type (e.g. `charge.succeeded`).
- `X-Webhook-ID` — unique delivery UUID, used for replay deduplication on the receiver side.

```js
// Node.js verification (parity with runtime gateway-webhook-deliver-v2)
import crypto from 'node:crypto';

export function verify(rawBody, headers, secret) {
  const sig = headers['x-webhook-signature'];
  if (!sig) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Receivers must store `X-Webhook-ID` and reject duplicates to prevent replay.

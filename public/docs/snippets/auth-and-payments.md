# Kang Open Banking — Copy/Paste Client Snippets

Base URL: `https://api.kangopenbanking.com/v1`

All snippets are validated by the docs CI suite and work against the public sandbox
using the test credentials published at `/developer/sandbox/credentials`.

---

## 1. OAuth2 — Token Exchange (Client Credentials)

```bash
curl -X POST https://api.kangopenbanking.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$KANG_CLIENT_ID" \
  -d "client_secret=$KANG_CLIENT_SECRET" \
  -d "scope=payments accounts"
```

```javascript
const res = await fetch('https://api.kangopenbanking.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.KANG_CLIENT_ID,
    client_secret: process.env.KANG_CLIENT_SECRET,
    scope: 'payments accounts',
  }),
});
const { access_token } = await res.json();
```

## 2. OIDC Discovery

```bash
curl https://api.kangopenbanking.com/v1/.well-known/openid-configuration
```

## 3. Create a Charge

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/charges \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"amount":"5000","currency":"XAF","channel":"mtn_momo","customer":{"phone":"+237600000001"}}'
```

```javascript
await fetch('https://api.kangopenbanking.com/v1/gateway/charges', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: '5000', currency: 'XAF', channel: 'mtn_momo',
    customer: { phone: '+237600000001' },
  }),
});
```

## 4. Retrieve a Charge

```bash
curl https://api.kangopenbanking.com/v1/gateway/charges/$CHARGE_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## 5. Refund

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/refunds \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"charge_id":"chg_123","amount":"5000"}'
```

## 6. Create a Payout / Transfer

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/transfers \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"amount":"100000","currency":"XAF","destination":{"channel":"orange_money","msisdn":"+237699999999"}}'
```

## 7. Verify a Webhook (Node.js)

```javascript
import crypto from 'node:crypto';
function verify(rawBody, headers, secret) {
  const sig = headers['x-webhook-signature'];
  const ts  = headers['x-webhook-timestamp'];
  if (!sig || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

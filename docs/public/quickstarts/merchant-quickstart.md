# Merchant Quickstart — Accept Payments with KOB

> Start accepting MoMo, Card, and PayPal payments in under 10 minutes.

## 1. Create Your Account

Register at [kangopenbanking.com/auth](https://kangopenbanking.com/auth) → **"Accept Payments"**.

Complete the registration:
- Business name and type
- Phone: `+237 6XX XXX XXX`
- 6-digit PIN

## 2. Submit KYB

Upload your business documents (registration certificate, ID, proof of address).
Your dashboard will show "KYB Under Review" until approved.

## 3. Get Your API Keys

After KYB approval, find your keys in **Merchant Portal → API Keys**:
- **Sandbox**: `sk_test_xxxx` — test freely
- **Production**: `sk_live_xxxx` — real money

## 4. Create Your First Charge

### MoMo (Cameroon — XAF)

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer sk_test_xxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "payment_type": "mobile_money_cameroon",
    "provider": "flutterwave",
    "customer": {
      "phone": "237650000000",
      "name": "Jean Kamga"
    },
    "metadata": { "order_id": "ORD-001" }
  }'
```

### Node.js
```javascript
const response = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_test_xxxx',
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: 5000,
      currency: 'XAF',
      payment_type: 'mobile_money_cameroon',
      provider: 'flutterwave',
      customer: { phone: '237650000000', name: 'Jean Kamga' },
      metadata: { order_id: 'ORD-001' },
    }),
  }
);
const charge = await response.json();
console.log(charge.id, charge.status); // uuid, "pending"
```

## 5. Handle Webhooks

Register your webhook endpoint in **Merchant Portal → Webhooks** or via API.

KOB sends webhooks with HMAC-SHA256 signatures:

```
X-KOB-Signature: sha256=<hex_digest>
```

### Verify (Node.js)
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Webhook Events
| Event | When |
|---|---|
| `charge.successful` | Payment completed |
| `charge.failed` | Payment failed |
| `refund.successful` | Refund processed |
| `payout.successful` | Payout sent |
| `payout.failed` | Payout failed |

## 6. Create a Refund

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-refund \
  -H "Authorization: Bearer sk_test_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "charge_id": "CHARGE_UUID",
    "amount": 2500,
    "reason": "Customer request"
  }'
```

## 7. Export Transactions

```bash
curl -X GET "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-export-transactions?format=csv&from=2026-01-01&to=2026-03-15" \
  -H "Authorization: Bearer sk_test_xxxx"
```

## Next Steps

- [Webhook Integration Guide](/docs/public/webhooks/merchant-webhooks.md)
- [Error Codes Reference](/docs/public/errors.md)
- [Status Lifecycle](/docs/public/statuses.md)
- [Full API Reference](https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec)

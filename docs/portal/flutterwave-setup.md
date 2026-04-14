# Flutterwave Integration Guide

## Architecture

```
Your App → KOB API (/v1/mobile-money/*) → Flutterwave → Mobile Operator → Webhook → Your App
```

## Prerequisites

1. Flutterwave account at [flutterwave.com](https://flutterwave.com)
2. API keys: Secret Key, Public Key, Encryption Key
3. Configure keys in your KOB backend settings

## Mobile Money Charge

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/mobile-money/charge \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "phone_number": "237677123456",
    "provider": "mtn",
    "email": "customer@example.com",
    "tx_ref": "order_12345",
    "fullname": "John Doe"
  }'
```

### Response
```json
{
  "status": "success",
  "data": {
    "id": 4534334,
    "tx_ref": "order_12345",
    "amount": 5000,
    "currency": "XAF",
    "status": "pending"
  }
}
```

## Bank Transfer

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/payments/bank-transfer \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "XAF",
    "account_number": "1234567890",
    "bank_code": "COBACMCX",
    "account_name": "Jane Smith",
    "narration": "Invoice payment"
  }'
```

## Bank Verification

### List Banks
```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/payments/banks?country=CM \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Verify Account
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/payments/verify-account \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{ "account_number": "1234567890", "bank_code": "COBACMCX" }'
```

## Fee Calculation

| Component | Value |
|---|---|
| Base fee | 3.5% of transaction amount |
| Minimum fee | 100 XAF |
| Cap | Varies by provider |

## Webhook Processing

### Signature Verification (HMAC-SHA256)

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
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

### Webhook Event Format
```json
{
  "event": "mobilemoney.charge.completed",
  "event_id": "evt_abc123",
  "timestamp": "2026-02-16T10:05:00Z",
  "data": {
    "id": 4534334,
    "tx_ref": "order_12345",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful"
  },
  "signature": "hmac-sha256-hex"
}
```

### Supported Events
| Event | Trigger |
|---|---|
| `mobilemoney.charge.completed` | Payment successful |
| `mobilemoney.charge.failed` | Payment failed |
| `transfer.completed` | Disbursement successful |
| `transfer.failed` | Disbursement failed |

### Deduplication
Use `event_id` to deduplicate webhook deliveries. Store processed event IDs and skip duplicates.

## Reconciliation

Query stuck transactions:
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/mobile-money/verify \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{ "transaction_id": "4534334" }'
```

## Security Notes

- Never log Flutterwave secret keys
- Always verify webhook signatures before processing
- Use HTTPS for all webhook endpoints
- Implement idempotent webhook handlers
- Store `tx_ref` for reconciliation

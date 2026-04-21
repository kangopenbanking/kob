# Idempotency

## Overview

All money-moving POST endpoints require an `Idempotency-Key` header to ensure safe retries.

## How It Works

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer sk_test_xxxx" \
  -H "Idempotency-Key: charge_ord123_20260322" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "currency": "XAF", ...}'
```

1. First request with a key → processes normally, caches result
2. Retry with **same key + same payload** → returns cached result with `X-Idempotent-Replayed: true`
3. Retry with **same key + different payload** → returns `409 Conflict`

## Key Rules

| Rule | Detail |
|---|---|
| **Format** | Any string up to 255 chars — UUIDs recommended |
| **TTL** | Keys expire after **24 hours** |
| **Scope** | Per-endpoint, per-client |
| **Required on** | All POST/PUT that create or move money |

## Conflict Response (409)

```json
{
  "error": "idempotency_conflict",
  "error_code": "LED_002",
  "message": "Idempotency key already used with a different payload",
  "error_id": "err_abc123"
}
```

## Best Practices

- Use deterministic keys: `{action}_{reference}_{date}` (e.g., `charge_ord123_20260322`)
- Store the key with your order/transaction record
- Always retry on network timeouts with the same key
- Never reuse keys across different operations

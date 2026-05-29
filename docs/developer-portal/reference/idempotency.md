# Idempotency

## Overview

Every money-moving `POST` / `PUT` / `PATCH` endpoint accepts an `Idempotency-Key` header so that a request that fails partway through (network timeout, retry storm) can be safely re-sent without double-charging.

## How It Works

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer sk_test_xxxx" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "currency": "XAF", ...}'
```

1. **First request with a key** → processes normally; response is cached; headers `X-Idempotent-Replay: false`, `X-Idempotency-Status: first_request`.
2. **Retry with same key + same payload** → cached response returned byte-identical, with `X-Idempotent-Replay: true` and `X-Idempotency-Status: replayed`.
3. **Retry with same key + different payload** → `409 Conflict` with `X-Idempotency-Status: conflict_rejected` and an RFC 7807 Problem Details body of `type = .../errors/idempotency-key-reused`.

## Key Rules

| Rule | Value |
|---|---|
| **Format** | UUID v4 (regex `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) |
| **Max length** | 255 characters |
| **Case sensitivity** | Case-sensitive (compared verbatim) |
| **TTL (cached response)** | 24 hours |
| **TTL (in-flight slot)** | 60 seconds — a request still executing holds a lock; concurrent retries get `429 Retry-After: 1` |
| **Scope** | Per-endpoint, per-merchant |
| **Required on** | All financial POST/PUT/PATCH that create or move money |
| **Optional on** | Read endpoints, sandbox utilities |

## Response Headers

| Header | Values | Meaning |
|---|---|---|
| `X-Idempotency-Status` | `first_request` \| `replayed` \| `conflict_rejected` | What the server did with the key |
| `X-Idempotent-Replay` | `true` \| `false` | Quick boolean indicator |

## Conflict Response (409)

```json
{
  "type": "https://api.kangopenbanking.com/errors/idempotency-key-reused",
  "title": "Idempotency Key Conflict",
  "status": 409,
  "detail": "The provided Idempotency-Key was previously used with a different request body.",
  "instance": "/v1/gateway/charges",
  "error_id": "err_idem_a1b2c3",
  "timestamp": "2026-05-29T10:00:00Z"
}
```

## In-Flight Response (429)

If a second request arrives with the same key while the original is still executing, the server returns `429 Too Many Requests` with `Retry-After: 1`. Wait and retry — once the first completes, retries get the cached response.

## Best Practices

- Generate a fresh UUID v4 per logical operation (one per charge, one per refund, etc.) and store it with your order record.
- Always retry on network timeouts with the **same** key.
- Never reuse a key across different operations (refund vs. charge), endpoints, or merchant accounts.
- Do not parse the key for meaning — treat it as opaque.

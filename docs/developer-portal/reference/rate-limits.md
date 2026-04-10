# Rate Limits

## Per-Endpoint Limits

| Endpoint Category | Sandbox | Production | Window |
|---|---|---|---|
| Charges (POST) | 100 | 1,000 | 1 minute |
| Payouts (POST) | 50 | 500 | 1 minute |
| Wallets (CRUD) | 200 | 2,000 | 1 minute |
| Read endpoints (GET) | 500 | 5,000 | 1 minute |
| Webhooks v2 management | 30 | 100 | 1 minute |
| Compliance screening | 50 | 500 | 1 minute |
| OIDC / Token | 60 | 120 | 1 minute |

## Rate Limit Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1709290800
```

On `429` responses, a `Retry-After` header is also present:

```
Retry-After: 12
```

## 429 Response Schema (RateLimitError)

When rate limited, you receive an RFC 7807 Problem Details response:

```json
{
  "type": "https://kangopenbanking.com/errors/rate-limited",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded your rate limit of 1000 requests per minute. Retry after 30 seconds.",
  "error_code": "AUTH_005",
  "error_id": "err_abc123def456",
  "timestamp": "2026-04-10T10:00:00Z"
}
```

## Retry Strategy

- Read the `Retry-After` header for wait time in seconds
- Implement exponential backoff: 1s → 2s → 4s → 8s (max 60s)
- Add jitter to prevent thundering herd
- Use the same `Idempotency-Key` when retrying write operations

## Best Practices

- Implement exponential backoff on 429 responses
- Cache responses where possible
- Use webhooks instead of polling for status updates
- Batch operations where supported (e.g., batch payouts)
- Contact support for higher rate limits on enterprise plans

# Rate Limits

## Default Limits

| Endpoint Type | Limit | Window |
|---|---|---|
| Authentication (`/oauth/token`) | 20 requests | 1 minute |
| Payment creation | 100 requests | 1 minute |
| Read endpoints (GET) | 300 requests | 1 minute |
| Webhook endpoints | 500 requests | 1 minute |

## Rate Limit Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711108800
```

## 429 Response

When rate limited, you receive:

```json
{
  "error": "rate_limited",
  "error_code": "AUTH_005",
  "message": "Rate limit exceeded. Retry after 30 seconds.",
  "error_id": "err_xyz123",
  "timestamp": "2026-03-22T10:00:00Z"
}
```

The `Retry-After` header tells you how many seconds to wait.

## Best Practices

- Implement exponential backoff on 429 responses
- Cache responses where possible
- Use webhooks instead of polling for status updates
- Batch operations where supported (e.g., batch payouts)

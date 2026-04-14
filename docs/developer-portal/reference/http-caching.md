# HTTP Caching & Conditional Requests

## Response Headers

| Header | Description |
|---|---|
| `Cache-Control` | Caching directive per resource type |
| `ETag` | Entity tag for conditional requests |
| `Last-Modified` | Timestamp of last data change |

## Request Headers (Conditional)

| Header | Description |
|---|---|
| `If-None-Match` | Send previous ETag; receive 304 if unchanged |
| `If-Modified-Since` | Send previous Last-Modified; receive 304 if unchanged |

## Cache Policies by Resource

| Resource | Cache-Control | Rationale |
|---|---|---|
| Account balances | `no-cache` | May change on every transaction |
| Transaction history | `no-cache` | New transactions appear continuously |
| Exchange rates | `max-age=300, must-revalidate` | Updated every 5 minutes |
| Bank directory | `max-age=3600, must-revalidate` | Changes infrequently |
| Supported currencies | `max-age=86400` | Version-level changes only |
| OpenAPI spec | `max-age=3600` | Release-level changes only |

## Conditional Request Example

```bash
# First request
curl -i https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/accounts/acc_123/balances \
  -H "Authorization: Bearer sk_live_..."
# → ETag: "v1-balance-abc123"

# Subsequent request with ETag
curl -i https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/accounts/acc_123/balances \
  -H "Authorization: Bearer sk_live_..." \
  -H "If-None-Match: \"v1-balance-abc123\""
# → 304 Not Modified (no body)
```

## Key Facts

- 304 responses do **not** count against rate limit quota
- ETags are opaque — do not parse or construct them
- Combine conditional requests with webhooks for optimal polling

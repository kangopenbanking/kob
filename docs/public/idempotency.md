# Idempotency

> Mirror of [`developer-portal/reference/idempotency.md`](../developer-portal/reference/idempotency.md). The developer portal is the canonical source.

Every money-moving `POST` / `PUT` / `PATCH` endpoint accepts an `Idempotency-Key` header so that a request that fails partway through can be safely re-sent without double-charging.

| Rule | Value |
|---|---|
| Format | UUID v4 |
| Max length | 255 characters |
| Case sensitivity | Case-sensitive |
| TTL (cached response) | 24 hours |
| TTL (in-flight slot) | 60 seconds |
| Required on | All financial POST/PUT/PATCH |

## Response Headers

| Header | Values |
|---|---|
| `X-Idempotency-Status` | `first_request` \| `replayed` \| `conflict_rejected` |
| `X-Idempotent-Replay` | `true` \| `false` |

## Conflict (409)

Same key + different payload → `409 Conflict`, `Content-Type: application/problem+json`, body uses RFC 7807 with `type = .../errors/idempotency-key-reused`. See [errors reference](./errors.md).

## Example

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/charges \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"amount":"5000","currency":"XAF","channel":"mtn_momo"}'
```

# Rate Limits

Published per-tier numbers — fetched live from `GET /v1/rate-limits`.

| Tier | Req/min | Burst | Concurrent | Webhooks/min | Idempotency window |
|---|---|---|---|---|---|
| `free` | 60 | 120 | 10 | 30 | 24 h |
| `pro` | 600 | 1 200 | 100 | 300 | 24 h |
| `enterprise` | 6 000 | 12 000 | 1 000 | 3 000 | 168 h |

Every response carries enforcement headers:

```text
X-RateLimit-Limit:     600
X-RateLimit-Remaining: 599
X-RateLimit-Reset:     1748540400
Retry-After:           60   # only on 429
```

```bash
curl https://api.kangopenbanking.com/v1/rate-limits
```

```ts
const tiers = await fetch("https://api.kangopenbanking.com/v1/rate-limits").then(r => r.json());
```

```py
tiers = requests.get("https://api.kangopenbanking.com/v1/rate-limits").json()
```

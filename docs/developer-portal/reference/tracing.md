# Distributed Tracing (W3C Trace Context)

KOB implements [W3C Trace Context Level 2](https://www.w3.org/TR/trace-context/) end-to-end.

## Request headers

| Header | Required | Notes |
|---|---|---|
| `traceparent` | optional | `00-<trace-id (32 hex)>-<span-id (16 hex)>-<flags (2 hex)>`. If omitted KOB generates one. |
| `tracestate` | optional | Vendor-specific extension; propagated unchanged. |

## Response headers

Every 2xx response echoes `traceparent` with the KOB-side span id so downstream callers can stitch their trace tree.

## Propagation

KOB propagates the inbound `traceparent` to every upstream call:

- Bank connectors (REST + file ingest workers)
- Mobile-money providers (MTN MoMo, Orange Money, Wave, M-Pesa, Airtel)
- Settlement workers and webhook delivery jobs

## Snippets

```ts
// Node.js — generate and propagate
import { randomBytes } from "node:crypto";
const trace = `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
const r = await kob.payments.create(body, { headers: { traceparent: trace } });
console.log("echoed:", r.headers.traceparent);
```

```py
# Python — generate and propagate
import secrets, requests
trace = f"00-{secrets.token_hex(16)}-{secrets.token_hex(8)}-01"
r = requests.post(url, json=body, headers={"Authorization": f"Bearer {token}", "traceparent": trace})
print("echoed:", r.headers["traceparent"])
```

```bash
# cURL
curl -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
     -H "Authorization: Bearer $TOKEN" \
     https://api.kangopenbanking.com/v1/accounts
```

## OTLP export

KOB emits spans to an OTLP/HTTP collector configured per environment. Self-hosted customers can plug in any compatible collector (Jaeger, Tempo, Honeycomb, Datadog APM).

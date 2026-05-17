# Kang Open Banking — Load Test Harness

Phase 8 (Scalability & DX) — v4.40.0.

[k6](https://k6.io/) scenarios that exercise the public sandbox under load.
Each script is bound to a specific SLO budget published in the OpenAPI
`x-scalability` extension and the `/admin/slo` dashboard.

## Scenarios

| Script | Target endpoint | SLO budget |
|---|---|---|
| `charge-burst.js` | `POST /v1/charges` | p95 < 1500ms, success ≥ 99.5% |
| `webhook-flood.js` | Sandbox webhook simulator | p95 delivery < 3000ms, success ≥ 99.0% |
| `aisp-read-storm.js` | `GET /v1/accounts/:id/transactions` | p95 < 800ms, success ≥ 99.9% |

## Run

```bash
export KOB_BASE_URL="https://sandbox-api.kangopenbanking.com/v1"
export KOB_API_KEY="sk_test_xxx"

k6 run e2e/load/charge-burst.js
k6 run e2e/load/webhook-flood.js
k6 run e2e/load/aisp-read-storm.js
```

> The harness uses public sandbox credentials. Tests must never be pointed
> at production (`api.kangopenbanking.com`).

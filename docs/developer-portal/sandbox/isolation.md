# Sandbox Isolation & Fault Injection

> Per-developer credentials, key tiers, and the fault-injection catalog.

## Per-developer keys

Every developer who registers a sandbox account receives their own credential set via `POST /v1/sandbox/api-keys`:

| Field | Format |
|---|---|
| `secret_key` | `sk_test_<64-hex>` — server-to-server auth, shown once |
| `publishable_key` | `pk_test_<48-hex>` — browser/mobile auth, safe in client code |
| `webhook_secret` | `whsec_test_<64-hex>` — HMAC signing secret, shown once |
| `api_key` | `sbx_<64-hex>` — legacy combined key (back-compat alias) |
| `merchant_id` | UUID — your sandbox merchant identity |
| `tier` | `free` \| `pro` \| `enterprise` |

Keys are scoped to the issuing developer's `sandbox_account_id`. There is **no shared sandbox tenant** — every developer's data, charges, webhooks, and audit log is isolated.

## Tier matrix

| Tier | Requests/minute | Requests/day | Use case |
|---|---|---|---|
| `free` | 60 | 1,000 | Local development, smoke tests |
| `pro` | 300 | 10,000 | Integration testing, staging |
| `enterprise` | 1,000 | 100,000 | Load testing, partner certification |

Request a higher tier when creating the key:

```bash
curl -X POST https://api.kangopenbanking.com/v1/sandbox/api-keys \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key_name":"Load Test","tier":"enterprise"}'
```

## Fault injection — `/v1/sandbox/trigger`

Force a specific failure on the **next matching** operation. Useful for verifying client-side error handling.

```bash
curl -X POST https://api.kangopenbanking.com/v1/sandbox/trigger \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"event":"bank_timeout","delay_ms":3000}'
```

| `event` | Effect |
|---|---|
| `bank_timeout` | Bank-side call hangs until `delay_ms` then returns `504` |
| `network_unreachable` | Provider call fails immediately with a connect error |
| `insufficient_funds` | Charge rejected with `GW_005` |
| `operator_unavailable` | Mobile money operator returns `503` |
| `customer_not_registered` | MSISDN not enrolled with operator |
| `daily_limit_exceeded` | Customer-side daily limit breached |
| `rate_limited_429` | Provider rate limits the next call |
| `provider_504` | Upstream gateway timeout |

## Charge-scoped simulate — `/v1/sandbox/charges/{chargeId}/simulate`

Resolve a pending sandbox charge in a specific terminal state.

```bash
curl -X POST https://api.kangopenbanking.com/v1/sandbox/charges/ch_abc123/simulate \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"action":"decline","decline_code":"insufficient_funds"}'
```

| `action` | Outcome |
|---|---|
| `approve` | Charge → `succeeded`, success webhook fires |
| `decline` | Charge → `failed` with the supplied `decline_code` |
| `timeout` | Charge stays `processing`, no webhook |
| `reverse` | Charge → `reversed`, refund webhook fires |

## Webhook deliveries in sandbox

Sandbox webhook deliveries use the same signature format as Live (`X-Webhook-Signature: t=<ts>,v1=<hex>`). The legacy raw-hex header `X-Webhook-Signature-Legacy` is also emitted during the deprecation window for back-compat.

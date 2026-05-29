# Error Codes Reference

> All KOB API errors follow **RFC 7807 Problem Details for HTTP APIs**.
> Content type: `application/problem+json` for every 4xx/5xx response.

## Response Format (RFC 7807)

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

| Field | Type | RFC 7807 | Description |
|---|---|---|---|
| `type` | string (URI) | §3.1 | Absolute URI identifying the problem type — dereference for human-readable docs |
| `title` | string | §3.1 | Short, human-readable summary (stable across occurrences) |
| `status` | integer | §3.1 | HTTP status code (also in the response status line) |
| `detail` | string | §3.1 | Human-readable explanation specific to this occurrence |
| `instance` | string (URI) | §3.1 | Identifies the specific occurrence (typically the request path) |
| `error_id` | string | extension | KOB trace id — include in support requests |
| `timestamp` | string | extension | ISO 8601 timestamp |
| `errors` | array | extension | Per-field validation errors (422 only) |
| `retry_after` | integer | extension | Seconds before the client should retry (429 only) |

## Content Negotiation

| Request `Accept` header | Response `Content-Type` | Body |
|---|---|---|
| `application/problem+json` (preferred) | `application/problem+json` | RFC 7807 envelope |
| `application/json` or omitted | `application/json` (legacy) + `application/problem+json` mirror in some endpoints | Legacy `{error, error_code, message, error_id, timestamp}` envelope, kept for back-compat |
| `*/*` | `application/problem+json` | RFC 7807 envelope |

The legacy envelope will be removed in a future major API version. New integrations should send `Accept: application/problem+json`.

## HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| 400 | Bad Request | Missing/invalid fields |
| 401 | Unauthorized | Invalid/missing authentication |
| 403 | Forbidden | Valid auth, insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Idempotency key reused with different payload |
| 422 | Unprocessable | Valid syntax, semantic errors |
| 429 | Too Many Requests | Rate limit exceeded — check `Retry-After` header |
| 500 | Internal Error | Server error — use `error_id` for support |

## Error Domains

| Prefix | Domain |
|---|---|
| `AUTH_` | Authentication & OAuth |
| `PAY_` / `GW_` | Payment Gateway |
| `LED_` | Ledger |
| `PISP_` | Payment Initiation |
| `AISP_` | Account Information |
| `KYC_` / `KYB_` | Compliance & Verification |
| `WH_` | Webhooks |
| `CONSENT_` | Consent Lifecycle |
| `STD_` | Standards (IBAN/BIC/RIB/ISO 20022) |

## 409 Conflict — Idempotency Reuse Example

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

## 422 Unprocessable — Validation Example

```json
{
  "type": "https://api.kangopenbanking.com/errors/validation",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "One or more request fields failed validation.",
  "instance": "/v1/gateway/charges",
  "error_id": "err_val_d4e5f6",
  "timestamp": "2026-05-29T10:00:00Z",
  "errors": [
    { "field": "amount", "code": "GW_001", "message": "Amount must be > 0" },
    { "field": "currency", "code": "GW_002", "message": "Unsupported currency 'USX'" }
  ]
}
```

## 429 Too Many Requests Example

```json
{
  "type": "https://api.kangopenbanking.com/errors/rate-limited",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Request rate exceeded for the merchant's current tier.",
  "instance": "/v1/gateway/charges",
  "error_id": "err_rl_g7h8i9",
  "timestamp": "2026-05-29T10:00:00Z",
  "retry_after": 30
}
```

Clients should respect the `Retry-After` HTTP response header in addition to the `retry_after` body field.

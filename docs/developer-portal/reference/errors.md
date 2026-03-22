# Errors Reference

> All KOB API errors follow a consistent envelope format.

## Error Response Format

```json
{
  "error": "invalid_request",
  "error_code": "AUTH_001",
  "message": "Invalid client credentials",
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-03-15T10:00:00Z",
  "details": {}
}
```

| Field | Type | Description |
|---|---|---|
| `error` | string | Machine-readable error type |
| `error_code` | string | Domain-prefixed code (e.g., `AUTH_001`, `PAY_003`) |
| `message` | string | Human-readable description |
| `error_id` | string | Unique trace ID — include in support requests |
| `timestamp` | string | ISO 8601 timestamp |
| `details` | object | Optional validation details |

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
| `PAY_` | Payment Gateway |
| `LED_` | Ledger |
| `PISP_` | Payment Initiation |
| `AISP_` | Account Information |
| `KYC_` | Compliance & Verification |
| `WH_` | Webhooks |

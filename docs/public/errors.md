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
| `type` | string (URI) | §3.1 | Absolute URI identifying the problem type |
| `title` | string | §3.1 | Stable, human-readable summary |
| `status` | integer | §3.1 | HTTP status code |
| `detail` | string | §3.1 | Occurrence-specific explanation |
| `instance` | string (URI) | §3.1 | Identifies the specific occurrence |
| `error_id` | string | extension | KOB trace id — include in support requests |
| `timestamp` | string | extension | ISO 8601 timestamp |
| `errors` | array | extension | Per-field validation errors (422 only) |
| `retry_after` | integer | extension | Seconds before retry (429 only) |

## Content Negotiation

Send `Accept: application/problem+json` to opt in to the RFC 7807 envelope. Without it, some legacy endpoints still emit `application/json` with the older `{error, error_code, message}` envelope; new integrations should always send the Problem Details `Accept` header.

## HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| 400 | Bad Request | Malformed body or missing required fields |
| 401 | Unauthorized | Invalid or missing authentication |
| 403 | Forbidden | Valid auth, insufficient scope |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource or idempotency replay conflict |
| 422 | Unprocessable | Valid syntax, semantic errors |
| 429 | Too Many Requests | Rate limit exceeded (`Retry-After` header set) |
| 500 | Internal Error | Server error — use `error_id` for support |

## Error Domains

| Prefix | Domain |
|---|---|
| `AUTH_` | Authentication & OAuth |
| `GW_` / `PAY_` | Payment Gateway |
| `LEDGER_` / `LED_` | Ledger |
| `PISP_` | Payment Initiation |
| `AISP_` | Account Information |
| `CONSENT_` | Consent lifecycle |
| `KYB_` / `KYC_` | Compliance & Verification |
| `WH_` | Webhooks |
| `STD_` | Standards (IBAN/BIC/RIB/ISO 20022) |

## Common Error Codes

### Authentication (AUTH_)
| Code | Error | HTTP |
|---|---|---|
| AUTH_001 | `invalid_client` | 401 |
| AUTH_002 | `token_expired` | 401 |
| AUTH_003 | `insufficient_scope` | 403 |
| AUTH_004 | `invalid_refresh_token` | 401 |
| AUTH_005 | `rate_limited` | 429 |
| AUTH_006 | `invalid_grant` | 400 |
| AUTH_007 | `pkce_required` | 400 |
| AUTH_008 | `account_locked` | 403 |

### Gateway (GW_)
| Code | Error | HTTP |
|---|---|---|
| GW_001 | `invalid_amount` | 400 |
| GW_002 | `unsupported_currency` | 400 |
| GW_003 | `charge_not_found` | 404 |
| GW_004 | `refund_exceeds_charge` | 422 |
| GW_005 | `insufficient_balance` | 422 |
| GW_006 | `provider_error` | 502 |
| GW_007 | `duplicate_charge` | 409 |
| GW_008 | `charge_not_refundable` | 422 |
| GW_009 | `payout_failed` | 422 |
| GW_010 | `webhook_signature_invalid` | 401 |

### Consent (CONSENT_)
| Code | Error | HTTP |
|---|---|---|
| CONSENT_001 | `consent_not_found` | 404 |
| CONSENT_002 | `consent_expired` | 403 |
| CONSENT_003 | `consent_revoked` | 403 |
| CONSENT_004 | `permission_denied` | 403 |
| CONSENT_005 | `consent_already_authorized` | 409 |

### Ledger (LEDGER_)
| Code | Error | HTTP |
|---|---|---|
| LEDGER_001 | `unbalanced_entry` | 422 |
| LEDGER_002 | `account_not_found` | 404 |
| LEDGER_003 | `insufficient_funds` | 422 |

### Standards (STD_)
| Code | Error | HTTP |
|---|---|---|
| STD_001 | `invalid_iban` | 400 |
| STD_002 | `invalid_bic` | 400 |
| STD_003 | `invalid_rib` | 400 |
| STD_004 | `parse_failed` | 422 |

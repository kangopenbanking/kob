# Error Codes Reference

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
| `error_code` | string | Domain-prefixed code (e.g., `AUTH_001`) |
| `message` | string | Human-readable description |
| `error_id` | string | Unique trace ID for support |
| `timestamp` | string | ISO 8601 timestamp |
| `details` | object | Optional additional context |

## HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| 400 | Bad Request | Malformed request body or missing required fields |
| 401 | Unauthorized | Invalid or missing authentication |
| 403 | Forbidden | Valid auth but insufficient permissions/scope |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource or state conflict |
| 422 | Unprocessable Entity | Valid syntax but semantic errors |
| 429 | Too Many Requests | Rate limit exceeded (`Retry-After` header included) |
| 500 | Internal Error | Server error (use `error_id` for support) |

## Authentication Errors (AUTH_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| AUTH_001 | `invalid_client` | 401 | Invalid client_id or client_secret |
| AUTH_002 | `token_expired` | 401 | Access token has expired |
| AUTH_003 | `insufficient_scope` | 403 | Token lacks required scope |
| AUTH_004 | `invalid_refresh_token` | 401 | Refresh token invalid or revoked |
| AUTH_005 | `rate_limited` | 429 | Token endpoint rate limit exceeded |
| AUTH_006 | `invalid_grant` | 400 | Authorization code invalid or expired |
| AUTH_007 | `pkce_required` | 400 | PKCE code_challenge required |
| AUTH_008 | `account_locked` | 403 | Account locked due to brute-force protection |

## Gateway Errors (GW_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| GW_001 | `invalid_amount` | 400 | Amount must be > 0 |
| GW_002 | `unsupported_currency` | 400 | Currency not supported |
| GW_003 | `charge_not_found` | 404 | Charge ID not found |
| GW_004 | `refund_exceeds_charge` | 422 | Refund amount > original charge |
| GW_005 | `insufficient_balance` | 422 | Merchant wallet balance too low |
| GW_006 | `provider_error` | 502 | Payment provider returned an error |
| GW_007 | `duplicate_charge` | 409 | Idempotency key already used |
| GW_008 | `charge_not_refundable` | 422 | Charge status doesn't allow refund |
| GW_009 | `payout_failed` | 422 | Payout could not be processed |
| GW_010 | `webhook_signature_invalid` | 401 | Webhook HMAC verification failed |

## Consent Errors (CONSENT_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| CONSENT_001 | `consent_not_found` | 404 | Consent ID not found |
| CONSENT_002 | `consent_expired` | 403 | Consent has expired |
| CONSENT_003 | `consent_revoked` | 403 | Consent was revoked |
| CONSENT_004 | `permission_denied` | 403 | Requested permission not in consent |
| CONSENT_005 | `consent_already_authorized` | 409 | Consent already in Authorised state |

## KYB/KYC Errors (KYB_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| KYB_001 | `kyb_pending` | 422 | KYB verification still pending |
| KYB_002 | `kyb_rejected` | 403 | KYB was rejected — resubmit required |
| KYB_003 | `document_invalid` | 400 | Uploaded document failed validation |

## Ledger Errors (LEDGER_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| LEDGER_001 | `unbalanced_entry` | 422 | Journal entry debits ≠ credits |
| LEDGER_002 | `account_not_found` | 404 | Ledger account not found |
| LEDGER_003 | `insufficient_funds` | 422 | Account balance too low for debit |

## Standards Errors (STD_)

| Code | Error | HTTP | Description |
|---|---|---|---|
| STD_001 | `invalid_iban` | 400 | IBAN checksum failed |
| STD_002 | `invalid_bic` | 400 | BIC format invalid |
| STD_003 | `invalid_rib` | 400 | RIB MOD-97 key check failed |
| STD_004 | `parse_failed` | 422 | ISO 20022 / SWIFT message parse error |

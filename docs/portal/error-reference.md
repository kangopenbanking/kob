# Error Codes Reference

## RFC 7807 Error Envelope

All errors follow the RFC 7807 Problem Details format:

```json
{
  "error": "insufficient_funds",
  "error_code": "PISP_004",
  "message": "The debtor account has insufficient balance for the requested payment amount.",
  "details": { "available_balance": "25000.00", "requested_amount": "50000.00" },
  "error_id": "err_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-02-16T10:05:00Z"
}
```

## HTTP Status Codes

| Status | Usage |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions / scope |
| 404 | Resource not found |
| 409 | Conflict (duplicate idempotency key) |
| 422 | Unprocessable entity |
| 429 | Rate limit exceeded (includes `Retry-After` header) |
| 500 | Internal server error |

## Error Code Catalogue

### AUTH (Authentication)
| Code | Description |
|---|---|
| AUTH_001 | Invalid client credentials |
| AUTH_002 | Expired access token |
| AUTH_003 | Insufficient scope |
| AUTH_004 | Invalid refresh token |
| AUTH_005 | Token rate limit exceeded |

### CERT (Certificates)
| Code | Description |
|---|---|
| CERT_001 | Invalid certificate format |
| CERT_002 | Certificate expired |
| CERT_003 | Certificate revoked |
| CERT_004 | Thumbprint mismatch |

### AISP (Account Information)
| Code | Description |
|---|---|
| AISP_001 | Consent not found or expired |
| AISP_002 | Insufficient permissions |
| AISP_003 | Account not found |
| AISP_004 | Consent revoked |
| AISP_005 | Account closed |

### PISP (Payment Initiation)
| Code | Description |
|---|---|
| PISP_001 | Missing Idempotency-Key header |
| PISP_002 | Invalid or expired consent |
| PISP_003 | Account blocked |
| PISP_004 | Insufficient funds |
| PISP_005 | Amount exceeds limits |
| PISP_006 | SCA required |
| PISP_007 | Duplicate idempotency key with different payload |

### LOAN (Loans)
| Code | Description |
|---|---|
| LOAN_001 | Loan product not found |
| LOAN_002 | Ineligible for loan |
| LOAN_003 | Amount exceeds maximum |
| LOAN_004 | Loan already disbursed |
| LOAN_005 | Repayment exceeds outstanding |

### SAV (Savings)
| Code | Description |
|---|---|
| SAV_001 | Insufficient balance for withdrawal |
| SAV_002 | Account locked (maturity not reached) |
| SAV_003 | Minimum balance violation |

### LED (Ledger)
| Code | Description |
|---|---|
| LED_001 | Unbalanced journal entry (debits ≠ credits) |
| LED_002 | Invalid account code |
| LED_003 | Period already closed |

### MM (Mobile Money)
| Code | Description |
|---|---|
| MM_001 | Insufficient wallet balance |
| MM_002 | Invalid phone number |
| MM_003 | Authorization timeout |
| MM_004 | Provider unavailable |
| MM_005 | Daily limit exceeded |

### FLW (Flutterwave)
| Code | Description |
|---|---|
| FLW_001 | Flutterwave API error |
| FLW_002 | Invalid bank code |
| FLW_003 | Transfer failed |

### KYC (Compliance)
| Code | Description |
|---|---|
| KYC_001 | Document validation failed |
| KYC_002 | Sanctions match found |
| KYC_003 | Duplicate submission |

### ADM (Admin)
| Code | Description |
|---|---|
| ADM_001 | Unauthorized admin action |
| ADM_002 | Report generation failed |

### WH (Webhooks)
| Code | Description |
|---|---|
| WH_001 | Invalid webhook signature |
| WH_002 | Webhook delivery failed |
| WH_003 | Event type not supported |

## Rate Limiting Response

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```
```json
{
  "error": "rate_limit_exceeded",
  "error_code": "AUTH_005",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "timestamp": "2026-02-16T10:05:00Z"
}
```

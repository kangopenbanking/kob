# Kang Open Banking — API Style Guide

> Version: 1.0 | Last updated: 2026-02-16

---

## 1. URL Structure

All public endpoints live under the `/v1` prefix:

```
https://api.kangopenbanking.com/v1/{domain}/{resource}
```

### Mapping to Edge Functions

Since the backend uses Supabase Edge Functions, each logical `/v1` path maps to a dedicated function:

| API Path | Edge Function |
|---|---|
| `POST /v1/oauth/token` | `oauth-token` |
| `GET /v1/aisp/accounts` | `aisp-accounts` |
| `POST /v1/pisp/domestic-payment` | `pisp-domestic-payment` |
| `POST /v1/ledger/journal` | `journal-post` |

The custom domain (`api.kangopenbanking.com`) routes `/v1/{function-name}` to `/functions/v1/{function-name}`.

---

## 2. Error Model

All errors follow a consistent JSON structure inspired by RFC 7807:

```json
{
  "error": "insufficient_funds",
  "error_code": "PISP_004",
  "message": "The debtor account has insufficient funds for this payment.",
  "details": {
    "available_balance": 25000,
    "requested_amount": 50000,
    "currency": "XAF"
  },
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-02-16T10:30:00Z"
}
```

### Error Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `error` | string | ✅ | Machine-readable error code (snake_case) |
| `error_code` | string | ✅ | Domain-prefixed error code (e.g., `AISP_001`) |
| `message` | string | ✅ | Human-readable description |
| `details` | object | ❌ | Additional context (amounts, field names, etc.) |
| `error_id` | string | ✅ | Unique error trace ID for support |
| `timestamp` | string | ✅ | ISO 8601 timestamp |

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Success (GET, PUT) |
| `201` | Resource created (POST) |
| `204` | Success, no content (DELETE) |
| `400` | Bad request / validation error |
| `401` | Missing or invalid authentication |
| `403` | Insufficient permissions / scope |
| `404` | Resource not found |
| `409` | Conflict (idempotency replay with different payload) |
| `422` | Unprocessable entity (business rule violation) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

### Domain Error Code Prefixes

| Prefix | Domain |
|---|---|
| `AUTH_` | Authentication & OAuth |
| `CERT_` | Certificates |
| `AISP_` | Account Information |
| `PISP_` | Payment Initiation |
| `LOAN_` | Loans |
| `SAV_` | Savings |
| `LED_` | Ledger |
| `MM_` | Mobile Money |
| `FLW_` | Flutterwave |
| `STR_` | Stripe |
| `KYC_` | KYC & Compliance |
| `ADM_` | Admin |
| `WH_` | Webhooks |

---

## 3. Pagination

All list endpoints use **offset-based pagination** with consistent parameters:

### Request Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 25 | Items per page (max 100) |
| `offset` | integer | 0 | Number of items to skip |
| `sort_by` | string | `created_at` | Field to sort by |
| `sort_order` | string | `desc` | `asc` or `desc` |

### Response Envelope

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 142,
    "limit": 25,
    "offset": 0,
    "has_more": true
  }
}
```

### Example

```bash
GET /v1/aisp/accounts/acc_123/transactions?limit=10&offset=20&sort_by=timestamp&sort_order=desc
```

---

## 4. Idempotency

All **write endpoints** (POST, PUT, PATCH) support idempotency via the `Idempotency-Key` header.

### How It Works

1. Client generates a unique key (UUID v4 recommended) and sends it in the `Idempotency-Key` header.
2. Server checks `idempotency_keys` table for existing key.
3. If key exists with same payload hash → return cached response (no side effects).
4. If key exists with different payload hash → return `409 Conflict`.
5. If key is new → process request, store result, return response.

### Request

```bash
POST /v1/pisp/domestic-payment
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amount": 50000,
  "currency": "XAF",
  "debtor_account": "CM21 10003 00100 0123456789 023",
  "creditor_account": "CM21 10003 00200 9876543210 045"
}
```

### Response Headers

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Idempotency-Replayed: true   # Only present on replayed responses
```

### Key Expiry

Idempotency keys expire after **24 hours**. After expiry, the same key can be reused.

### Endpoints Requiring Idempotency

All POST endpoints that create or mutate resources:
- `POST /v1/dcr/register`
- `POST /v1/pisp/consent`
- `POST /v1/pisp/domestic-payment`
- `POST /v1/pisp/payment-submission`
- `POST /v1/savings/create`
- `POST /v1/savings/deposit`
- `POST /v1/savings/withdraw`
- `POST /v1/loans/apply`
- `POST /v1/loans/approve`
- `POST /v1/loans/disburse`
- `POST /v1/loans/repay`
- `POST /v1/mobile-money/charge`
- `POST /v1/mobile-money/transfer`
- `POST /v1/flutterwave/bank-transfer`
- `POST /v1/ledger/journal`
- `POST /v1/admin/create-user`
- `POST /v1/admin/create-client`

---

## 5. Status Lifecycles

### 5.1 Payment Status

```
pending → authorized → submitted → completed
                                  → failed
                                  → cancelled
```

| Status | Description |
|---|---|
| `pending` | Payment consent created, awaiting authorization |
| `authorized` | User authorized the payment |
| `submitted` | Payment submitted to payment rail |
| `completed` | Payment successfully processed |
| `failed` | Payment failed (see error details) |
| `cancelled` | Payment cancelled by user or system |

### 5.2 Consent Status

```
AwaitingAuthorisation → Authorised → Consumed/Expired/Revoked
                      → Rejected
```

| Status | Description |
|---|---|
| `AwaitingAuthorisation` | Consent created, awaiting user approval |
| `Authorised` | User approved the consent |
| `Rejected` | User rejected the consent |
| `Consumed` | Consent used (single-use PISP consents) |
| `Expired` | Consent passed expiration date |
| `Revoked` | Consent revoked by user or TPP |

### 5.3 Loan Status

```
applied → under_review → approved → disbursed → active → completed
                       → rejected              → defaulted
                                                → written_off
```

| Status | Description |
|---|---|
| `applied` | Application submitted |
| `under_review` | Being reviewed by credit team |
| `approved` | Approved, awaiting disbursement |
| `rejected` | Application rejected |
| `disbursed` | Funds disbursed to borrower |
| `active` | Loan is active with outstanding balance |
| `completed` | All repayments made, loan closed |
| `defaulted` | Borrower defaulted on payments |
| `written_off` | Loan written off as loss |

### 5.4 Savings Account Status

```
active → frozen → closed
```

### 5.5 Certificate Status

```
active → revoked → expired
```

---

## 6. Authentication & Security

### 6.1 Auth Methods

| Method | Header | Usage |
|---|---|---|
| Bearer Token | `Authorization: Bearer {token}` | Most API calls |
| mTLS | Client certificate | FAPI 1.0 Advanced flows |
| API Key | `X-API-Key: {key}` | Third-party credit API |

### 6.2 OAuth 2.0 Scopes

| Scope | Description |
|---|---|
| `openid` | OpenID Connect identity |
| `accounts` | Read account information (AISP) |
| `balances` | Read account balances |
| `transactions` | Read transaction history |
| `payments` | Initiate payments (PISP) |
| `offline_access` | Refresh token grant |

### 6.3 Rate Limiting

Rate limits are enforced per client_id per endpoint:

| Tier | Requests/min | Burst |
|---|---|---|
| `standard` | 60 | 10 |
| `premium` | 300 | 50 |
| `enterprise` | 1000 | 200 |

Response headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708099200
```

---

## 7. Currency & Amounts

- **Default currency**: `XAF` (Central African CFA Franc)
- **Amount format**: Integer (XAF has no decimal subdivision) or decimal with 2 places for other currencies
- **All examples** use XAF amounts relevant to Cameroon

### Example Amounts (XAF)

| Description | Amount |
|---|---|
| Mobile money top-up | 5,000 XAF |
| Salary payment | 250,000 XAF |
| Small business loan | 1,000,000 XAF |
| Savings deposit | 50,000 XAF |

---

## 8. Date & Time

- All timestamps are **ISO 8601** in UTC: `2026-02-16T10:30:00Z`
- Date-only fields use `YYYY-MM-DD`: `2026-02-16`
- All `created_at`, `updated_at` fields are server-generated

---

## 9. Webhook Event Format

```json
{
  "event_id": "evt_a1b2c3d4",
  "event_type": "payment.completed",
  "created_at": "2026-02-16T10:30:00Z",
  "data": {
    "payment_id": "pay_xyz789",
    "amount": 50000,
    "currency": "XAF",
    "status": "completed"
  },
  "signature": "sha256=abc123..."
}
```

### Event Types

| Event | Description |
|---|---|
| `payment.created` | Payment initiated |
| `payment.completed` | Payment successful |
| `payment.failed` | Payment failed |
| `consent.authorized` | Consent authorized by user |
| `consent.revoked` | Consent revoked |
| `loan.approved` | Loan application approved |
| `loan.disbursed` | Loan funds disbursed |
| `loan.repayment.received` | Loan repayment received |
| `savings.deposit` | Savings deposit made |
| `savings.withdrawal` | Savings withdrawal made |
| `savings.interest.accrued` | Interest accrued on savings |

---

## 10. Versioning

- Current version: **v1**
- Breaking changes will increment the version (v2, v3)
- Deprecated endpoints will be maintained for **12 months** after deprecation notice
- Deprecation is communicated via `Sunset` and `Deprecation` response headers:

```
Deprecation: true
Sunset: Sat, 16 Feb 2027 00:00:00 GMT
Link: </v2/aisp/accounts>; rel="successor-version"
```

# AISP API Guide — Account Information

## Consent Lifecycle

1. **Create** consent → `POST /v1/aisp/consents`
2. **Authorize** → User approves via redirect
3. **Use** → Access account data with `x-consent-id` header
4. **Revoke** → User or TPP revokes consent

## Required Permissions

| Permission | Data Access |
|---|---|
| `ReadAccountsBasic` | Account ID, type, currency |
| `ReadAccountsDetail` | Full account details |
| `ReadBalances` | Current balances |
| `ReadTransactionsBasic` | Transaction amounts and dates |
| `ReadTransactionsDetail` | Full transaction details |
| `ReadBeneficiariesDetail` | Beneficiary information |
| `ReadStandingOrdersDetail` | Standing order details |
| `ReadDirectDebitsDetail` | Direct debit mandates |

## Endpoints

### Create Consent
```
POST /v1/aisp/consents
Authorization: Bearer {token}
Idempotency-Key: {uuid}
```
```json
{
  "Data": {
    "Permissions": ["ReadAccountsBasic","ReadBalances"],
    "ExpirationDateTime": "2026-12-31T23:59:59Z"
  }
}
```

### List Accounts
```
GET /v1/aisp/accounts
x-consent-id: {consentId}
```

### Account Detail
```
GET /v1/aisp/accounts/{accountId}
x-consent-id: {consentId}
```

### Balances
```
GET /v1/aisp/accounts/{accountId}/balances
x-consent-id: {consentId}
```

### Transactions (with pagination)
```
GET /v1/aisp/accounts/{accountId}/transactions?limit=25&offset=0&fromBookingDateTime=2026-01-01T00:00:00Z
x-consent-id: {consentId}
```

**Pagination response:**
```json
{
  "Data": { "Transaction": [...] },
  "Meta": { "TotalCount": 156, "Limit": 25, "Offset": 0 }
}
```

### Beneficiaries
```
GET /v1/aisp/accounts/{accountId}/beneficiaries
```

### Standing Orders
```
GET /v1/aisp/accounts/{accountId}/standing-orders
```

### Direct Debits
```
GET /v1/aisp/accounts/{accountId}/direct-debits
```

## Error Codes

| Code | Description |
|---|---|
| AISP_001 | Consent not found or expired |
| AISP_002 | Insufficient permissions for requested data |
| AISP_003 | Account not found |
| AISP_004 | Consent revoked by customer |
| AISP_005 | Account closed |

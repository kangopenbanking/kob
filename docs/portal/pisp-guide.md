# PISP API Guide — Payment Initiation

## Payment Lifecycle

```
pending → authorized → submitted → completed
                                  ↘ failed
                                  ↘ cancelled
```

## 5-Step Flow

### 1. Create Consent
```
POST /v1/pisp/consents
Idempotency-Key: {uuid}
```
```json
{
  "Data": {
    "Initiation": {
      "InstructedAmount": { "Amount": "50000.00", "Currency": "XAF" },
      "CreditorAccount": { "Identification": "677123456", "Name": "Merchant Ltd" },
      "RemittanceInformation": { "Unstructured": "Invoice #12345" }
    }
  }
}
```

### 2. Authorize (user redirect)
Redirect user to authorization URL returned in consent response.

### 3. Create Payment
```
POST /v1/pisp/domestic-payments
Idempotency-Key: {uuid}
```
```json
{
  "Data": {
    "ConsentId": "pisp_consent_xyz789",
    "Initiation": {
      "InstructedAmount": { "Amount": "50000.00", "Currency": "XAF" },
      "DebtorAccount": { "Identification": "677987654", "Name": "John Doe" },
      "CreditorAccount": { "Identification": "677123456", "Name": "Merchant Ltd" },
      "EndToEndIdentification": "ref_001"
    }
  }
}
```

### 4. Submit Payment
```
POST /v1/pisp/payment-submissions
Idempotency-Key: {uuid}
```
```json
{ "Data": { "PaymentId": "pay_abc123" } }
```

### 5. Check Status
```
GET /v1/pisp/domestic-payments/{paymentId}
```

## Idempotency-Key Rules

| Rule | Detail |
|---|---|
| Format | UUID v4 |
| Required on | All POST endpoints |
| Expiry | 24 hours |
| Same key + same body | Returns cached response with `X-Idempotent-Replayed: true` |
| Same key + different body | Returns `409 Conflict` (PISP_007) |

## Error Codes

| Code | Description |
|---|---|
| PISP_001 | Missing Idempotency-Key header |
| PISP_002 | Invalid or expired consent |
| PISP_003 | Account blocked or frozen |
| PISP_004 | Insufficient funds |
| PISP_005 | Amount exceeds limits |
| PISP_006 | SCA required |
| PISP_007 | Duplicate Idempotency-Key with different payload |

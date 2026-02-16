# PISP API Examples

> **Base URL:** `https://api.kangopenbanking.com/functions/v1`
>
> All requests require a valid Bearer token. Payment submissions require an `Idempotency-Key` header.

---

## Payment Flow Overview

```
1. Create PISP Consent (TPP → KOB)
2. Authorise Consent (PSU → KOB)
3. Create Domestic Payment (TPP → KOB)
4. Submit Payment for Execution (TPP → KOB, requires Idempotency-Key)
5. Check Payment Status (TPP → KOB)
```

**Status Lifecycle:**
```
AwaitingAuthorisation → Authorised → Pending → AcceptedSettlementInProgress → Completed | Failed
```

---

## 1. Create a PISP Consent

```bash
curl -X POST "${BASE_URL}/pisp-create-consent" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "tpp_pisp_001",
    "payment_type": "domestic",
    "instructed_amount": {
      "amount": "150000.00",
      "currency": "XAF"
    },
    "creditor": {
      "account": {
        "SchemeName": "BBAN",
        "Identification": "10005-00098765-01",
        "Name": "Fournisseur Douala SARL"
      }
    },
    "debtor_account": {
      "SchemeName": "BBAN",
      "Identification": "10003-00012345-01",
      "Name": "Jean Dupont"
    },
    "reference": "INV-2026-001",
    "remittance_information": "Invoice payment February 2026",
    "risk": {
      "payment_context_code": "EcommerceGoods",
      "merchant_category_code": "5411"
    },
    "consent_expires_hours": 24
  }'
```

**Response (201):**
```json
{
  "Data": {
    "ConsentId": "pdpc_550e8400-e29b-41d4-a716-446655440000",
    "Status": "AwaitingAuthorisation",
    "CreationDateTime": "2026-02-16T12:00:00Z",
    "Initiation": {
      "InstructedAmount": { "Amount": "150000.00", "Currency": "XAF" },
      "CreditorAccount": { "SchemeName": "BBAN", "Identification": "10005-00098765-01", "Name": "Fournisseur Douala SARL" },
      "DebtorAccount": { "SchemeName": "BBAN", "Identification": "10003-00012345-01", "Name": "Jean Dupont" },
      "RemittanceInformation": { "Reference": "INV-2026-001", "Unstructured": "Invoice payment February 2026" }
    }
  },
  "Risk": { "payment_context_code": "EcommerceGoods" },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/pisp-consents/pdpc_550e..." },
  "Meta": {}
}
```

---

## 2. Authorise the Consent

```bash
curl -X POST "${BASE_URL}/consent-authorize" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_id": "pdpc_550e8400-e29b-41d4-a716-446655440000",
    "consent_type": "pisp",
    "authorized": true
  }'
```

**Response (200):**
```json
{
  "Data": {
    "ConsentId": "pdpc_550e8400-...",
    "Status": "Authorised",
    "AuthorizedAt": "2026-02-16T12:05:00Z"
  }
}
```

---

## 3. Create a Domestic Payment

```bash
curl -X POST "${BASE_URL}/pisp-domestic-payment" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_id": "pdpc_550e8400-e29b-41d4-a716-446655440000",
    "instructed_amount": { "amount": "150000.00", "currency": "XAF" },
    "creditor_account": {
      "SchemeName": "BBAN",
      "Identification": "10005-00098765-01",
      "Name": "Fournisseur Douala SARL"
    },
    "debtor_account": {
      "SchemeName": "BBAN",
      "Identification": "10003-00012345-01",
      "Name": "Jean Dupont"
    },
    "remittance_information": "Invoice payment February 2026",
    "reference": "INV-2026-001"
  }'
```

**Response (201):**
```json
{
  "Data": {
    "DomesticPaymentId": "PAY-550e8400-e29b-41d4-a716-446655440000",
    "ConsentId": "pdpc_550e8400-...",
    "Status": "Pending",
    "CreationDateTime": "2026-02-16T12:06:00Z",
    "Initiation": {
      "InstructedAmount": { "Amount": "150000.00", "Currency": "XAF" },
      "CreditorAccount": { "SchemeName": "BBAN", "Identification": "10005-00098765-01", "Name": "Fournisseur Douala SARL" },
      "DebtorAccount": { "SchemeName": "BBAN", "Identification": "10003-00012345-01", "Name": "Jean Dupont" },
      "RemittanceInformation": { "Unstructured": "Invoice payment February 2026" },
      "EndToEndIdentification": "INV-2026-001"
    }
  },
  "Links": { "Self": "/pisp/v4/domestic-payments/PAY-550e..." },
  "Meta": {}
}
```

---

## 4. Submit Payment for Execution (Idempotent)

**⚠️ Requires `Idempotency-Key` header** — same key returns the cached response.

```bash
IDEMPOTENCY_KEY=$(uuidgen)

curl -X POST "${BASE_URL}/pisp-payment-submission" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "payment_id": "PAY-550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response (200):**
```json
{
  "Data": {
    "DomesticPaymentId": "PAY-550e8400-...",
    "ConsentId": "pdpc_550e8400-...",
    "Status": "AcceptedSettlementInProgress",
    "CreationDateTime": "2026-02-16T12:06:00Z",
    "StatusUpdateDateTime": "2026-02-16T12:07:00Z",
    "ExpectedExecutionDateTime": "2026-02-17",
    "ExpectedSettlementDateTime": "2026-02-18",
    "Initiation": { "..." }
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/pisp/domestic-payment-submissions/PAY-550e..." },
  "Meta": {}
}
```

**Replay (same Idempotency-Key):** Returns the same response with header `X-Idempotent-Replayed: true`.

### Idempotency Rules

| Scenario | Behaviour |
|----------|-----------|
| First request | Processes normally, caches response |
| Duplicate with same key | Returns cached response + `X-Idempotent-Replayed: true` |
| Concurrent with same key | Returns `409 Conflict` |
| Missing header | Returns `400 Bad Request` (PISP_001) |
| Key expires after | 24 hours |

---

## 5. Get Payment Details

```bash
curl -X GET "${BASE_URL}/pisp-payment-details/PAY-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

**Response (200):**
```json
{
  "Data": {
    "DomesticPaymentId": "PAY-550e8400-...",
    "ConsentId": "pdpc_550e8400-...",
    "Status": "AcceptedSettlementInProgress",
    "CreationDateTime": "2026-02-16T12:06:00Z",
    "StatusUpdateDateTime": "2026-02-16T12:07:00Z",
    "ExpectedExecutionDateTime": "2026-02-17",
    "ExpectedSettlementDateTime": "2026-02-18",
    "Initiation": {
      "InstructedAmount": { "Amount": "150000.00", "Currency": "XAF" },
      "CreditorAccount": { "SchemeName": "BBAN", "Identification": "10005-00098765-01", "Name": "Fournisseur Douala SARL" },
      "DebtorAccount": { "SchemeName": "BBAN", "Identification": "10003-00012345-01", "Name": "Jean Dupont" },
      "RemittanceInformation": { "Unstructured": "Invoice payment February 2026" },
      "EndToEndIdentification": "INV-2026-001"
    }
  },
  "Links": { "Self": "/pisp/v4/domestic-payments/PAY-550e..." },
  "Meta": {}
}
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `PISP_001` | 400 | Missing Idempotency-Key header |
| `PISP_002` | 409 | Request already being processed (concurrent duplicate) |
| `PISP_003` | 400 | Missing payment_id |
| `PISP_004` | 404 | Payment not found |
| `PISP_005` | 400 | Payment not in submittable status |
| `PISP_006` | 403 | Consent invalid or expired |
| `PISP_007` | 500 | Failed to update payment |
| `PISP_999` | 500 | Internal server error |

---

## Payment Events

Every status transition is tracked in `payment_events`:

| Event Type | When |
|------------|------|
| `created` | Payment record created via `pisp-domestic-payment` |
| `status_change` | Payment submitted via `pisp-payment-submission` |

Events include metadata with `from_status`, `to_status`, `idempotency_key`, and actor ID.

---

## Webhook Notifications

TPPs subscribed to payment events receive webhooks on status changes:

```json
{
  "event_type": "payment.status_changed",
  "data": {
    "payment_id": "PAY-550e8400-...",
    "status": "AcceptedSettlementInProgress",
    "previous_status": "Pending",
    "timestamp": "2026-02-16T12:07:00Z"
  }
}
```

Configure webhooks via the TPP dashboard or `admin-webhooks` endpoint.

# AISP API Examples

> **Base URL:** `https://api.kangopenbanking.com/functions/v1`
>
> All requests require a valid Bearer token and `x-consent-id` header (except consent creation).

---

## 1. Create an AISP Consent

```bash
curl -X POST "${BASE_URL}/aisp-create-consent" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "tpp_abc123",
    "permissions": [
      "ReadAccountsBasic",
      "ReadBalances",
      "ReadTransactionsBasic",
      "ReadTransactionsDetail",
      "ReadBeneficiariesBasic",
      "ReadDirectDebits",
      "ReadStandingOrdersBasic"
    ],
    "expiration_days": 90,
    "transaction_from_date": "2025-01-01T00:00:00Z",
    "transaction_to_date": "2026-12-31T23:59:59Z"
  }'
```

**Response (201):**
```json
{
  "Data": {
    "ConsentId": "aac_550e8400-e29b-41d4-a716-446655440000",
    "Status": "AwaitingAuthorisation",
    "CreationDateTime": "2026-02-16T12:00:00Z",
    "ExpirationDateTime": "2026-05-17T12:00:00Z",
    "Permissions": ["ReadAccountsBasic", "ReadBalances", "..."],
    "TransactionFromDateTime": "2025-01-01T00:00:00Z",
    "TransactionToDateTime": "2026-12-31T23:59:59Z"
  },
  "Risk": {},
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-consents/aac_550e..." },
  "Meta": { "TotalPages": 1 }
}
```

---

## 2. Authorise a Consent

```bash
curl -X POST "${BASE_URL}/consent-authorize" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_id": "aac_550e8400-e29b-41d4-a716-446655440000",
    "consent_type": "aisp",
    "authorized": true,
    "selected_accounts": ["ACC-001", "ACC-002"]
  }'
```

**Response (200):**
```json
{
  "Data": {
    "ConsentId": "aac_550e8400-e29b-41d4-a716-446655440000",
    "Status": "Authorised",
    "StatusUpdateDateTime": "2026-02-16T12:01:00Z",
    "AuthorizedAt": "2026-02-16T12:01:00Z"
  }
}
```

---

## 3. Revoke a Consent

```bash
curl -X POST "${BASE_URL}/consent-revoke" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_id": "aac_550e8400-e29b-41d4-a716-446655440000",
    "consent_type": "aisp",
    "reason": "User no longer needs data sharing"
  }'
```

**Response (200):**
```json
{
  "Data": {
    "ConsentId": "aac_550e8400-...",
    "Status": "Revoked",
    "RevokedAt": "2026-02-16T14:00:00Z",
    "RevocationReason": "User no longer needs data sharing"
  }
}
```

---

## 4. List Accounts

```bash
curl -X GET "${BASE_URL}/aisp-accounts" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "Account": [
      {
        "AccountId": "ACC-001",
        "Currency": "XAF",
        "AccountType": "Personal",
        "AccountSubType": "CurrentAccount",
        "Nickname": "Mon Compte Courant",
        "Account": [{
          "SchemeName": "BBAN",
          "Identification": "10003-00012345-01",
          "Name": "Jean Dupont"
        }],
        "OpeningDate": "2024-06-15"
      }
    ]
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-accounts" },
  "Meta": { "TotalPages": 1 }
}
```

---

## 5. Get Account Balances

```bash
curl -X GET "${BASE_URL}/aisp-balances/ACC-001/balances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "Balance": [
      {
        "AccountId": "ACC-001",
        "CreditDebitIndicator": "Credit",
        "Type": "InterimAvailable",
        "DateTime": "2026-02-16T10:30:00Z",
        "Amount": { "Amount": "1250000.00", "Currency": "XAF" }
      }
    ]
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-accounts/ACC-001/balances" },
  "Meta": { "TotalPages": 1 }
}
```

---

## 6. List Transactions (with Pagination)

```bash
# Page 1 (default: 25 per page)
curl -X GET "${BASE_URL}/aisp-transactions/ACC-001/transactions?limit=25&offset=0" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"

# With date filtering
curl -X GET "${BASE_URL}/aisp-transactions/ACC-001/transactions?fromBookingDateTime=2026-01-01T00:00:00Z&toBookingDateTime=2026-02-16T23:59:59Z&limit=10&offset=0" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "Transaction": [
      {
        "AccountId": "ACC-001",
        "TransactionId": "tx-uuid-1",
        "CreditDebitIndicator": "Debit",
        "Status": "Booked",
        "BookingDateTime": "2026-02-15T14:30:00Z",
        "ValueDateTime": "2026-02-15T14:30:00Z",
        "Amount": { "Amount": "50000.00", "Currency": "XAF" },
        "TransactionInformation": "Mobile Money Transfer"
      }
    ]
  },
  "Links": {
    "Self": "https://api.kangopenbanking.com/v1/aisp-accounts/ACC-001/transactions?limit=25&offset=0"
  },
  "Meta": {
    "TotalPages": 4,
    "TotalCount": 87,
    "Limit": 25,
    "Offset": 0
  }
}
```

### Pagination Parameters

| Parameter | Default | Min | Max | Description |
|-----------|---------|-----|-----|-------------|
| `limit`   | 25      | 1   | 100 | Number of transactions per page |
| `offset`  | 0       | 0   | —   | Number of transactions to skip |
| `fromBookingDateTime` | — | — | — | ISO 8601 start date filter |
| `toBookingDateTime`   | — | — | — | ISO 8601 end date filter |

---

## 7. List Beneficiaries

```bash
curl -X GET "${BASE_URL}/aisp-beneficiaries/ACC-001/beneficiaries" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "Beneficiary": [
      {
        "AccountId": "ACC-001",
        "BeneficiaryId": "ben-uuid-1",
        "Reference": "Monthly Rent",
        "CreditorAccount": {
          "SchemeName": "BBAN",
          "Identification": "10005-00098765-01",
          "Name": "Immobilier Yaoundé SARL"
        }
      }
    ]
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-accounts/ACC-001/beneficiaries" },
  "Meta": { "TotalPages": 1 }
}
```

---

## 8. List Direct Debits

```bash
curl -X GET "${BASE_URL}/aisp-direct-debits/ACC-001/direct-debits" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "DirectDebit": [
      {
        "AccountId": "ACC-001",
        "DirectDebitId": "dd-001",
        "MandateIdentification": "MND-2025-001",
        "DirectDebitStatusCode": "Active",
        "Name": "ENEO Electricity",
        "PreviousPaymentDateTime": "2026-01-15T00:00:00Z",
        "PreviousPaymentAmount": { "Amount": "35000.00", "Currency": "XAF" }
      }
    ]
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-accounts/ACC-001/direct-debits" },
  "Meta": { "TotalPages": 1 }
}
```

---

## 9. List Standing Orders

```bash
curl -X GET "${BASE_URL}/aisp-standing-orders/ACC-001/standing-orders" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-consent-id: aac_550e8400-e29b-41d4-a716-446655440000"
```

**Response (200):**
```json
{
  "Data": {
    "StandingOrder": [
      {
        "AccountId": "ACC-001",
        "StandingOrderId": "so-001",
        "Frequency": "EvryMonth",
        "Reference": "Savings Transfer",
        "FirstPaymentDateTime": "2025-01-01T00:00:00Z",
        "NextPaymentDateTime": "2026-03-01T00:00:00Z",
        "FirstPaymentAmount": { "Amount": "100000.00", "Currency": "XAF" },
        "NextPaymentAmount": { "Amount": "100000.00", "Currency": "XAF" },
        "CreditorAccount": {
          "SchemeName": "BBAN",
          "Identification": "10003-00012345-02",
          "Name": "Jean Dupont Savings"
        }
      }
    ]
  },
  "Links": { "Self": "https://api.kangopenbanking.com/v1/aisp-accounts/ACC-001/standing-orders" },
  "Meta": { "TotalPages": 1 }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "invalid_consent",
  "error_description": "Consent not found, expired, or lacks required permission"
}
```

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 400 | `invalid_request` | Missing required parameters |
| 401 | `Invalid or expired token` | Bearer token is invalid |
| 403 | `invalid_consent` | Consent missing, expired, or lacks permission |
| 404 | `Account not found` | Account doesn't exist or not in consent scope |
| 405 | `Method not allowed` | Wrong HTTP method |
| 429 | `Rate limit exceeded` | Too many requests (300/hour per client on accounts) |
| 500 | `Internal server error` | Unexpected failure |

---

## Required Permissions by Endpoint

| Endpoint | Permission Required |
|----------|-------------------|
| `aisp-accounts` | `ReadAccountsBasic` |
| `aisp-balances` | `ReadBalances` |
| `aisp-transactions` | `ReadTransactionsBasic` or `ReadTransactionsDetail` |
| `aisp-beneficiaries` | `ReadBeneficiariesBasic` |
| `aisp-direct-debits` | `ReadDirectDebits` |
| `aisp-standing-orders` | `ReadStandingOrdersBasic` |

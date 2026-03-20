# Bank Connector Contract

## Integration Modes

| Mode | Direction | Description |
|---|---|---|
| **connector_push** | Bank → KOB | Bank pushes account/transaction data to KOB ingestion endpoints |
| **connector_pull** | KOB → Bank | KOB calls bank connector REST endpoints |
| **file_feed** | Bank → KOB | Bank uploads CSV/pain.001 files; KOB processes asynchronously |
| **hybrid** | Both | Combination of push and pull for different data types |

## Canonical Data Schemas

### BankAccount
```json
{
  "external_account_id": "string (unique per bank)",
  "customer_id": "uuid (optional)",
  "account_type": "CurrentAccount | SavingsAccount",
  "identification_scheme": "BBAN | IBAN | RIB",
  "identification_value": "string",
  "currency": "XAF (default)",
  "status": "active | closed | frozen",
  "nickname": "string (optional)"
}
```

### BankTransaction
```json
{
  "external_tx_id": "string (unique per account)",
  "booking_date": "YYYY-MM-DD",
  "value_date": "YYYY-MM-DD",
  "amount": "number",
  "currency": "XAF",
  "credit_debit": "Credit | Debit",
  "reference": "string",
  "description": "string"
}
```

### BankBalance
```json
{
  "account_id": "uuid",
  "balance_type": "ClosingAvailable | InterimBooked | OpeningBooked",
  "amount": "number",
  "currency": "XAF",
  "as_of_datetime": "ISO 8601"
}
```

## Ingestion Endpoints (PUSH Model)

All ingestion endpoints accept bulk arrays and perform upsert with deduplication.

| Action | Dedupe Key |
|---|---|
| `ingest_accounts` | `(bank_id, external_account_id)` |
| `ingest_transactions` | `(account_id, external_tx_id)` |
| `ingest_balances` | Insert only (append) |
| `ingest_beneficiaries` | `(account_id, beneficiary_name, identification)` |

## Security

- **mTLS**: Required for production connectors
- **HMAC**: Optional payload signing for integrity verification
- **Scoped tokens**: Bank admins can only manage their own connectors
- **Correlation IDs**: Every ingestion request must include `correlation_id` for tracing

# Bank File Format Specification — KOB File-Based Connector

## Overview
Banks without APIs integrate with KOB by uploading CSV files. KOB ingests these files, validates data, deduplicates, and serves via AISP endpoints.

## Supported File Types

### 1. Accounts (`accounts`)
```csv
external_account_id,account_type,identification_scheme,identification_value,currency,status,nickname
ACC-001,CurrentAccount,CM_RIB,10001-00001-0000000001-01,XAF,active,Compte Courant
```

### 2. Transactions (`transactions`)
```csv
external_tx_id,account_id,booking_date,value_date,amount,currency,credit_debit,reference,description
TX-001,ACC-001,2026-03-15,2026-03-15,50000,XAF,Credit,SAL-2026-03,Salary March
```

### 3. Balances (`balances`)
```csv
account_id,balance_type,amount,currency,as_of_datetime
ACC-001,ClosingAvailable,185000,XAF,2026-03-18T23:59:59Z
```

### 4. Beneficiaries (`beneficiaries`)
```csv
account_id,beneficiary_name,scheme_name,identification,bank_id_code
ACC-001,Jean Pierre Kamga,CM_RIB,20002-00005-0000000099-88,AFRILAND
```

### 5. Payment Status (`payment_status`)
```csv
reference,status,executed_at,bank_tx_id,reason_code,reason_message
ref-001,executed,2026-03-19T10:00:00Z,BNK-TX-9001,,
ref-003,failed,,,,Insufficient funds
```

## Defaults
- **Currency**: XAF (if omitted)
- **Country**: CM (Cameroon)
- **Phone format**: +237XXXXXXXXX

## Dedupe Keys
- Accounts: `(bank_id + external_account_id)`
- Transactions: `(bank_id + external_tx_id)` or composite fallback
- Balances: `(account_id + as_of_datetime)`
- Beneficiaries: `(account_id + beneficiary_name)`

## File Upload
- Max size: 50MB
- Duplicate detection: SHA-256 hash per (bank_id, file_type)
- Re-upload same content: rejected with `409 Conflict`

# Bank Integration Quickstart

Connect your bank to KOB Open Banking in 4 steps.

## Step 1: Register Your Bank

Contact KOB admin or use the Bank Directory API:

```bash
POST /v1/bank-directory
{
  "action": "register_bank",
  "legal_name": "Your Bank SA",
  "display_name": "Your Bank",
  "short_code": "YBK",
  "swift_bic": "YBKCMCMXXX",
  "bank_code": "10099",
  "integration_mode": "connector_push",
  "contact_email": "tech@yourbank.cm"
}
```

## Step 2: Register a Connector

```bash
POST /v1/bank-directory
{
  "action": "register_connector",
  "bank_id": "<your-bank-id>",
  "name": "Production Connector",
  "environment": "prod",
  "connector_type": "rest",
  "base_url": "https://connector.yourbank.cm"
}
```

## Step 3: Upload mTLS Certificate

```bash
POST /v1/bank-directory
{
  "action": "upload_certificate",
  "bank_id": "<your-bank-id>",
  "instance_id": "<connector-id>",
  "certificate_pem": "-----BEGIN CERTIFICATE-----\n...",
  "thumbprint": "<sha256-thumbprint>",
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_until": "2027-01-01T00:00:00Z"
}
```

## Step 4: Push Data

Ingest accounts, balances, and transactions:

```bash
POST /v1/bank-directory
{
  "action": "ingest_accounts",
  "bank_id": "<your-bank-id>",
  "correlation_id": "batch-001",
  "accounts": [
    {
      "external_account_id": "ACCT-001",
      "account_type": "CurrentAccount",
      "identification_value": "CM21 10005 00101 00000000101 52",
      "currency": "XAF"
    }
  ]
}
```

## Sandbox Testing

Use the sandbox bank simulator:
```bash
POST /v1/bank-directory
{ "action": "sandbox_seed_bank" }
```

This creates a fully populated sandbox bank with sample customers, accounts, balances, and transactions.

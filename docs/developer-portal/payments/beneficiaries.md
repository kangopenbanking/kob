# Beneficiaries

## Overview

Beneficiaries are pre-saved payout recipients. Create beneficiaries once, then reference them in payout requests by ID.

## Create Beneficiary

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/beneficiaries \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ben_jean_momo" \
  -d '{
    "merchant_id": "merch_uuid",
    "name": "Jean Dupont",
    "channel": "mobile_money",
    "phone": "237677123456",
    "currency": "XAF"
  }'
```

## List Beneficiaries

```bash
curl "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/beneficiaries?merchant_id=merch_uuid" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Delete Beneficiary

```bash
curl -X DELETE "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/beneficiaries/ben_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Supported Channels

| Channel | Required Fields |
|---------|----------------|
| `mobile_money` | `phone` |
| `bank_transfer` | `account_number`, `bank_code` |
| `paypal` | `paypal_email` |

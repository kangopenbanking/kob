# Payouts

## Single Payout

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/payouts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pay_salary_001" \
  -d '{
    "merchant_id": "merch_uuid",
    "amount": 50000,
    "currency": "XAF",
    "channel": "mobile_money",
    "beneficiary_phone": "237677123456",
    "beneficiary_name": "Jean Dupont",
    "narration": "Salary payment",
    "tx_ref": "pay_salary_001"
  }'
```

## Batch Payouts

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/payout-batches \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch_march_salaries" \
  -d '{
    "merchant_id": "merch_uuid",
    "currency": "XAF",
    "items": [
      { "amount": 50000, "channel": "mobile_money", "beneficiary_phone": "237677111111", "beneficiary_name": "Alice" },
      { "amount": 75000, "channel": "bank_transfer", "beneficiary_account": "1234567890", "beneficiary_bank": "SGCM", "beneficiary_name": "Bob" }
    ]
  }'
```

## Payout Channels

| Channel | Destination |
|---------|-------------|
| `mobile_money` | MTN/Orange MoMo |
| `bank_transfer` | Bank account via Flutterwave |
| `paypal` | PayPal email/phone/ID |

## Webhook Events

- `payout.created` — Payout initiated
- `payout.processing` — Provider processing
- `payout.completed` — Funds delivered
- `payout.failed` — Payout failed

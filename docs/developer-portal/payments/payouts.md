# Payouts

## Single Payout

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/payouts \
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

### Response — `201 Created`

```json
{
  "id": "po_M4n5O6",
  "merchant_id": "merch_uuid",
  "amount": 50000,
  "currency": "XAF",
  "channel": "mobile_money",
  "status": "processing",
  "beneficiary": {
    "name": "Jean Dupont",
    "phone": "237677123456"
  },
  "tx_ref": "pay_salary_001",
  "fee": 250,
  "estimated_arrival": "2026-03-22T10:10:00Z",
  "created_at": "2026-03-22T10:05:00Z"
}
```

### Response — `402 Payment Required` (insufficient settlement balance)

```json
{
  "error": "insufficient_balance",
  "error_code": "PAY_010",
  "message": "Settlement balance 12000 XAF is insufficient for payout amount 50000 XAF.",
  "error_id": "err_a2c3d4e5",
  "timestamp": "2026-03-22T10:05:00Z",
  "details": {
    "available_balance": "12000",
    "requested_amount": "50000",
    "currency": "XAF"
  }
}
```

### Response — `502 Bad Gateway` (provider failure — retryable)

```json
{
  "error": "payout_failed",
  "error_code": "PAY_006",
  "message": "Mobile money provider returned a transient error.",
  "error_id": "err_77ff21bc",
  "timestamp": "2026-03-22T10:05:00Z",
  "details": {
    "provider": "mtn_momo",
    "provider_error_code": "PROVIDER_TIMEOUT",
    "retryable": true
  }
}
```

## Batch Payouts

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/payout-batches \
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

### Response — `202 Accepted`

```json
{
  "id": "pob_001",
  "merchant_id": "merch_uuid",
  "currency": "XAF",
  "total_amount": 125000,
  "item_count": 2,
  "status": "processing",
  "items": [
    { "id": "po_001", "status": "processing", "amount": 50000, "channel": "mobile_money" },
    { "id": "po_002", "status": "processing", "amount": 75000, "channel": "bank_transfer" }
  ],
  "created_at": "2026-03-22T10:05:00Z"
}
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

## Related

- Error catalog: [PAY_006](/developer/api-reference/errors#PAY_006), [PAY_010](/developer/api-reference/errors#PAY_010)
- Webhook signature verification: [Webhooks Overview](../webhooks/webhooks-overview.md#signature-verification)

# Refunds

## Create a Refund

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/refunds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: refund_order_12345" \
  -d '{
    "charge_id": "chg_abc123",
    "amount": 5000,
    "reason": "Customer request"
  }'
```

- Omit `amount` for a full refund.
- Partial refunds are supported — multiple partial refunds allowed until the total equals the charge amount.

### Response — `200 OK`

```json
{
  "id": "ref_xyz789",
  "charge_id": "chg_abc123",
  "amount": 5000,
  "currency": "XAF",
  "status": "pending",
  "reason": "Customer request",
  "created_at": "2026-03-22T10:05:00Z",
  "estimated_arrival": "2026-03-25T10:05:00Z"
}
```

### Response — `409 Conflict` (idempotency replay, identical payload)

The original refund is returned unchanged. Treat as success.

```json
{
  "id": "ref_xyz789",
  "charge_id": "chg_abc123",
  "amount": 5000,
  "currency": "XAF",
  "status": "pending",
  "idempotency_replay": true
}
```

### Response — `422 Unprocessable Entity` (refund exceeds remaining balance)

```json
{
  "error": "refund_exceeds_amount",
  "error_code": "PAY_005",
  "message": "Refund amount 5000 exceeds remaining refundable balance 2000.",
  "error_id": "err_8a4f1c2e",
  "timestamp": "2026-03-22T10:05:00Z",
  "details": {
    "charge_amount": "10000",
    "already_refunded": "8000",
    "remaining_refundable": "2000",
    "requested_amount": "5000"
  }
}
```

### Response — `404 Not Found` (charge does not exist or belongs to another merchant)

```json
{
  "error": "merchant_not_found",
  "error_code": "PAY_007",
  "message": "Charge chg_abc123 not found.",
  "error_id": "err_3b91ee07",
  "timestamp": "2026-03-22T10:05:00Z"
}
```

## Refund Statuses

| Status | Description |
|--------|-------------|
| `pending` | Refund initiated |
| `completed` | Funds returned to customer |
| `failed` | Refund failed (check provider) |

## Webhook Events

- `refund.created` — Refund record created
- `refund.completed` — Funds returned
- `refund.failed` — Refund failed

## Constraints

- Cannot refund charges older than 180 days.
- Cannot refund more than the original charge amount.
- Only `successful` charges can be refunded.

## Related

- Error catalog: [PAY_005](/developer/api-reference/errors#PAY_005), [PAY_007](/developer/api-reference/errors#PAY_007)
- Webhook signature verification: [Webhooks Overview](../webhooks/webhooks-overview.md#signature-verification)

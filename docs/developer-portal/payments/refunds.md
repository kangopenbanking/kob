# Refunds

## Create a Refund

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/refunds \
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

### Response

```json
{
  "id": "ref_xyz789",
  "charge_id": "chg_abc123",
  "amount": 5000,
  "currency": "XAF",
  "status": "pending",
  "reason": "Customer request",
  "created_at": "2026-03-22T10:05:00Z"
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

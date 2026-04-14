# Settlements

## Overview

KOB automatically generates settlement statements for merchants based on completed transactions. Settlements aggregate charges, refunds, disputes, and fees into a net payout amount.

## Settlement Cycle

| Frequency | Description |
|-----------|-------------|
| Daily (T+1) | Default for active merchants |
| Weekly | Available on request |
| Monthly | For low-volume merchants |

## List Settlements

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/settlements?merchant_id=merch_uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "data": [
    {
      "id": "stl_abc123",
      "merchant_id": "merch_uuid",
      "amount": 450000,
      "fees_total": 13500,
      "net_amount": 436500,
      "currency": "XAF",
      "status": "paid",
      "period_start": "2026-03-01T00:00:00Z",
      "period_end": "2026-03-15T23:59:59Z",
      "created_at": "2026-03-16T06:00:00Z"
    }
  ]
}
```

## Settlement Breakdown

Each settlement includes a fee breakdown:

| Field | Description |
|-------|-------------|
| `amount` | Gross transaction volume |
| `fees_total` | Total platform fees |
| `net_amount` | Amount paid to merchant |
| `charge_count` | Number of successful charges |
| `refund_count` | Number of refunds deducted |
| `dispute_count` | Number of disputes deducted |

## Webhook Events

- `settlement.paid` — Settlement disbursed to merchant

## CSV Export

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/reports/settlements?merchant_id=merch_uuid&format=csv \
  -H "Authorization: Bearer YOUR_TOKEN"
```

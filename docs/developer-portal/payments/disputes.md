# Disputes

## Overview

Disputes (chargebacks) occur when a customer contests a charge with their bank or card issuer. KOB automatically syncs disputes from payment providers and provides a unified API for managing them.

## Dispute Lifecycle

```
opened → under_review → won/lost
```

## List Disputes

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/disputes?merchant_id=merch_uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Submit Evidence

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/disputes/{dispute_id}/evidence \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: evidence_disp_001" \
  -d '{
    "evidence_text": "Customer received goods on 2026-02-18.",
    "evidence_type": "receipt",
    "customer_name": "Jean Dupont",
    "customer_email": "jean@example.com",
    "product_description": "Premium subscription — 12 months"
  }'
```

### Response — `200 OK` (evidence accepted)

```json
{
  "id": "disp_xyz123",
  "charge_id": "chg_abc123",
  "status": "under_review",
  "amount": 5000,
  "currency": "XAF",
  "reason": "fraudulent",
  "evidence_submitted_at": "2026-03-22T10:05:00Z",
  "due_by": "2026-03-29T23:59:59Z"
}
```

### Response — `409 Conflict` (evidence already submitted or dispute closed)

```json
{
  "error": "dispute_invalid_state",
  "error_code": "PAY_009",
  "message": "Evidence cannot be submitted: dispute is already in 'lost' state.",
  "error_id": "err_5b2c3a44",
  "timestamp": "2026-03-22T10:05:00Z",
  "details": { "current_status": "lost" }
}
```

## Webhook Events

- `dispute.created` — New dispute filed
- `dispute.won` — Resolved in merchant's favor
- `dispute.lost` — Resolved against merchant

## Auto-Sync

For Stripe-based charges, disputes are automatically created when `charge.dispute.created` webhooks are received. The status is auto-updated when `charge.dispute.closed` fires.

## Related

- Error catalog: [PAY_009](/developer/api-reference/errors#PAY_009)
- Webhook signature verification: [Webhooks Overview](../webhooks/webhooks-overview.md#signature-verification)

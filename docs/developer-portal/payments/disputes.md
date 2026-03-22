# Disputes

## Overview

Disputes (chargebacks) occur when a customer contests a charge with their bank or card issuer. KOB automatically syncs disputes from payment providers and provides a unified API for managing them.

## Dispute Lifecycle

```
opened → under_review → won/lost
```

## List Disputes

```bash
curl https://api.kangopenbanking.com/v1/gateway/disputes?merchant_id=merch_uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Submit Evidence

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/disputes/{dispute_id}/evidence \
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

## Webhook Events

- `dispute.created` — New dispute filed
- `dispute.won` — Resolved in merchant's favor
- `dispute.lost` — Resolved against merchant

## Auto-Sync

For Stripe-based charges, disputes are automatically created when `charge.dispute.created` webhooks are received. The status is auto-updated when `charge.dispute.closed` fires.

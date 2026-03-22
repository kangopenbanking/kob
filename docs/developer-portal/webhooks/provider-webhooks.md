# Provider Webhooks (Inbound)

## Overview

KOB receives webhooks from payment providers (Stripe, Flutterwave, PayPal) to sync payment statuses in real-time. These endpoints are internal but documented for transparency.

## Stripe

**Endpoint**: `POST /webhooks/stripe`

### Verified Events
- `payment_intent.succeeded` → updates charge to `successful`
- `payment_intent.payment_failed` → updates charge to `failed`
- `charge.dispute.created` → creates `gateway_disputes` record
- `charge.dispute.closed` → updates dispute to `won`/`lost`
- `charge.refunded` → creates/updates refund record

### Signature Verification
KOB verifies the `stripe-signature` header using the `STRIPE_WEBSECRET_KEY`. Requests without valid signatures are rejected with `401`.

## Flutterwave

**Endpoint**: `POST /webhooks/flutterwave`

### Verified Events
- `charge.completed` → updates charge to `successful`
- `transfer.completed` → updates payout to `completed`

### Signature Verification
KOB verifies the `verif-hash` header against the `FLUTTERWAVE_HASH` secret.

## PayPal

**Endpoint**: `POST /webhooks/paypal`

### Verified Events
- `PAYMENT.CAPTURE.COMPLETED` → updates charge to `successful`
- `PAYMENT.PAYOUTSBATCH.SUCCESS` → updates payout batch

### Signature Verification
KOB verifies webhooks using PayPal's `verify-webhook-signature` API.

## Deduplication

All inbound events are stored in the `webhook_inbox` table with a SHA-256 hash of the event ID. Duplicate events are silently ignored (idempotent processing).

## Event Storage

Raw provider events are stored in `provider_raw` on the corresponding charge/payout record for audit and debugging purposes.

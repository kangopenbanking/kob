# Provider Webhooks (Inbound)

## Overview

KOB receives webhooks from payment providers (Stripe, Flutterwave, PayPal) to sync payment statuses in real-time. These endpoints are internal but documented for transparency and integration debugging.

All inbound webhooks follow the same reliability pipeline:
1. **Signature verification** — reject invalid requests with `401`
2. **Deduplication** — idempotent processing via `webhook_inbox` table
3. **Normalization** — map provider events to KOB internal event types
4. **State update** — update payment/payout/dispute records
5. **Merchant notification** — deliver outbound webhook to merchant if configured

---

## Stripe

**Endpoint**: `POST /webhooks/stripe`

### Verified Events
| Provider Event | KOB Action |
|---|---|
| `payment_intent.succeeded` | Charge → `successful` |
| `payment_intent.payment_failed` | Charge → `failed` |
| `charge.dispute.created` | Creates `gateway_disputes` record |
| `charge.dispute.closed` | Dispute → `won` / `lost` |
| `charge.refunded` | Creates/updates refund record |

### Signature Verification
KOB verifies the `stripe-signature` header using Stripe's `constructEvent()` method with the `STRIPE_WEBSECRET_KEY` endpoint secret. Invalid signatures are rejected with `401`.

```
Headers verified:
  stripe-signature: t=<timestamp>,v1=<HMAC-SHA256>
```

---

## Flutterwave

**Endpoint**: `POST /webhooks/flutterwave`

### Verified Events
| Provider Event | KOB Action |
|---|---|
| `charge.completed` | Charge → `successful` |
| `transfer.completed` | Payout → `completed` |
| Refund events | Refund status sync |

### Signature Verification
KOB verifies the `verif-hash` header against the `FLUTTERWAVE_ENCRYPTION_KEY` secret. Requests without a matching hash are rejected with `401`.

```
Headers verified:
  verif-hash: <HMAC hash>
```

---

## PayPal

**Endpoint**: `POST /webhooks/paypal`

### Verified Events
| Provider Event | KOB Action |
|---|---|
| `PAYMENT.CAPTURE.COMPLETED` | Funding intent → `succeeded`, triggers auto-credit |
| `CHECKOUT.ORDER.APPROVED` | Auto-captures PayPal order, then waits for capture event |
| `PAYOUTS-ITEM.*` | Payout status sync (succeeded/failed/reversed) |

### Signature Verification (Certificate-Based)

PayPal uses a **certificate-based** signature verification model, not simple HMAC. KOB implements full verification:

1. **Extract signature headers** from each webhook request:
   ```
   paypal-auth-algo: SHA256withRSA
   paypal-cert-url: https://api.paypal.com/v1/notifications/certs/CERT-xxx
   paypal-transmission-id: <unique-id>
   paypal-transmission-sig: <base64-signature>
   paypal-transmission-time: <ISO-8601>
   ```

2. **Verify via PayPal API**: KOB calls PayPal's `POST /v1/notifications/verify-webhook-signature` endpoint with:
   ```json
   {
     "auth_algo": "<paypal-auth-algo>",
     "cert_url": "<paypal-cert-url>",
     "transmission_id": "<paypal-transmission-id>",
     "transmission_sig": "<paypal-transmission-sig>",
     "transmission_time": "<paypal-transmission-time>",
     "webhook_id": "<PAYPAL_WEBHOOK_ID>",
     "webhook_event": <raw-event-body>
   }
   ```

3. **Decision**: If PayPal returns `verification_status: "SUCCESS"`, the event is processed. Otherwise, it is rejected with `401`.

### Required Configuration
| Secret | Description |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal app client ID (for OAuth token) |
| `PAYPAL_CLIENT_SECRET` | PayPal app secret (for OAuth token) |
| `PAYPAL_WEBHOOK_ID` | The webhook ID from PayPal Developer Dashboard |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |

### PayPal Webhook Setup (Developer Dashboard)
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
2. Select your app → **Webhooks** tab
3. Add webhook URL: `https://your-domain.com/functions/v1/gateway-webhook-paypal`
4. Subscribe to events: `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`, `PAYOUTS-ITEM.*`
5. Copy the **Webhook ID** and configure it as `PAYPAL_WEBHOOK_ID`

---

## Deduplication

All inbound events are stored in the `webhook_inbox` table keyed by `{provider}_{event_id}`. Duplicate events return `200 { "status": "already_processed" }` without re-processing (idempotent).

## Rate Limiting

Each provider endpoint enforces a rate limit of **100 requests/minute** via the `check_webhook_rate_limit` RPC function. Excess requests receive `429 Too Many Requests`.

## Event Storage

Raw provider events are persisted in `webhook_inbox` with full payload and processing status for audit, debugging, and reconciliation.

## Audit Trail

Every processed webhook generates an `audit_logs` entry with:
- `action_type`: e.g., `paypal_webhook_payment_capture_completed`
- `entity_type`: `gateway_payout`, `gateway_charge`, or `funding_intent`
- `details`: provider event ID, mapped status, correlation references

# Payment Intents (Async)

> Canonical rail-agnostic asynchronous payment resource.
> Standing Order #3 citation: Stripe API Reference §payment_intents; UK Open Banking Read/Write API v3.1.10.

## Why Payment Intents

Synchronous "create-and-confirm" payment APIs cannot model African payment rails honestly. Mobile money operators take seconds to push an STK, banks settle CEMAC transfers in minutes-to-hours, and Pay-by-Bank flows require the user to leave the app and authorize at their bank. A payment intent is a long-lived server-side object that tracks the lifecycle of a single payment across all those latency windows.

## State Machine

```text
                   ┌──────────────────────────────┐
                   │  requires_payment_method     │
                   └──────────────┬───────────────┘
                                  │ attach method
                                  ▼
                   ┌──────────────────────────────┐
                   │  requires_confirmation       │
                   └──────────────┬───────────────┘
                                  │ POST /:id/confirm
                                  ▼
   ┌────────────►   ┌──────────────────────────────┐
   │                │  processing                  │
   │                └──────┬─────────────┬─────────┘
   │                       │             │
   │                       ▼             ▼
   │      ┌────────────────────┐   ┌──────────────┐
   │      │ requires_action    │   │  succeeded   │
   │      │ (e.g. bank auth)   │   └──────────────┘
   │      └──────────┬─────────┘
   │                 │ user completes redirect
   └─────────────────┘

   Any non-terminal → canceled (POST /:id/cancel)
   Any → failed (provider/system error)
```

Terminal states: `succeeded`, `canceled`, `failed`. Webhooks fire on every transition (`payment_intent.created`, `payment_intent.requires_action`, `payment_intent.processing`, `payment_intent.succeeded`, `payment_intent.failed`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/payment-intents` | Create intent (returns `202 Accepted`) |
| GET | `/v1/payment-intents` | List merchant intents |
| GET | `/v1/payment-intents/{id}` | Retrieve current state |
| POST | `/v1/payment-intents/{id}/confirm` | Move `requires_confirmation` → `processing` |
| POST | `/v1/payment-intents/{id}/cancel` | Cancel a non-terminal intent |

All mutating calls require an `Idempotency-Key` header (UUID v4).

## Create

```bash
curl -X POST https://api.kangopenbanking.com/v1/payment-intents \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "payment_method_types": ["mobile_money", "pay_by_bank"],
    "confirm": false,
    "description": "Order #1234"
  }'
```

```http
HTTP/1.1 202 Accepted
X-Idempotent-Replay: false
X-Idempotency-Status: first_request
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 5000,
  "currency": "XAF",
  "status": "requires_confirmation",
  "payment_method_types": ["mobile_money", "pay_by_bank"],
  "created_at": "2026-05-29T10:00:00Z"
}
```

```javascript
// Node.js
const intent = await fetch('https://api.kangopenbanking.com/v1/payment-intents', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    currency: 'XAF',
    payment_method_types: ['mobile_money'],
    confirm: true,
  }),
}).then((r) => r.json());
```

```python
# Python
import requests, uuid
intent = requests.post(
  "https://api.kangopenbanking.com/v1/payment-intents",
  headers={
    "Authorization": f"Bearer {access_token}",
    "Idempotency-Key": str(uuid.uuid4()),
    "Content-Type": "application/json",
  },
  json={"amount": 5000, "currency": "XAF",
        "payment_method_types": ["mobile_money"], "confirm": True},
).json()
```

## Poll for terminal state

```bash
curl https://api.kangopenbanking.com/v1/payment-intents/$INTENT_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Most clients should subscribe to the `payment_intent.succeeded` and `payment_intent.failed` webhooks instead of polling.

## next_action discriminator

When `status = requires_action`, the `next_action` object tells the client what to do:

| `next_action.type` | Meaning |
|---|---|
| `redirect_to_url` | Open `next_action.redirect_to_url.url` in the browser; bank authorises payment; user returns to `return_url`. |
| `display_qr` | Render `next_action.display_qr.qr_payload` as a QR code; customer scans with their wallet app. |
| `use_stk_push` | An STK push has been sent to `next_action.use_stk_push.msisdn` on the named operator. Wait for `payment_intent.succeeded`. |
| `poll_provider` | Provider has not finalised; continue polling. |

## Relationship to per-rail intents

Internally, a payment intent delegates to one of the existing per-rail resources:

| Rail | Underlying resource |
|---|---|
| `pay_by_bank` | `/v1/pay-by-bank/intents` |
| `mobile_money`, `card`, `wallet` | `/v1/gateway/charges` |
| `bank_transfer` (top-up) | `/v1/gateway/funding-intents` |

The underlying ID is surfaced as `child_intent_id` / `child_resource` on the payment intent. Existing direct callers of the per-rail resources continue to work unchanged (Standing Order #1).

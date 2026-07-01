# Nium Inbound Webhooks

Nium delivers event notifications (incoming payments, payout status, FX conversions, RFI, account status)
to our public endpoint. Every request is verified, deduplicated, and audited.

## Endpoint

- **Production:** `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-webhook`
- **Method:** `POST`
- **Content-Type:** `application/json`

## Required headers

| Header | Required | Purpose |
| --- | --- | --- |
| `x-nium-signature-key` | **Required** (Nium "Header Parameters" model) | Static shared secret. Compared in constant time to `NIUM_WEBHOOK_SECRET`. |
| `x-nium-signature` | Optional | HMAC-SHA256 hex digest of the raw request body, keyed by `NIUM_WEBHOOK_SECRET`. Accepted if present and used as a fallback if `x-nium-signature-key` fails. |
| `x-nium-event` | Optional | Event type override when the JSON body does not carry `eventType`. |

At least one of `x-nium-signature-key` or a valid `x-nium-signature` MUST match. Requests with no valid signature return **`401 invalid_signature`**.

## Idempotency & replay protection

- Each event is deduplicated by `event_id` (derived from
  `payload.eventId → event_id → transactionId → systemReferenceNumber → id`) within a **24-hour TTL**.
- A duplicate returns **`200 { duplicate: true }`** and is not reprocessed.
- Every outcome (accepted / duplicate / rejected) is recorded in the `nium_webhook_audit` table for admin review.

## Example — valid request (static key)

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-webhook \
  -H "content-type: application/json" \
  -H "x-nium-signature-key: $NIUM_WEBHOOK_SECRET" \
  -H "x-nium-event: payment_incoming" \
  -d '{
    "eventType": "payment_incoming",
    "transactionId": "nium_txn_1001",
    "accountId": "acct_va_usd_1",
    "amount": 150.00,
    "currency": "USD"
  }'
```

Expected: `200 { "received": true, ... }`

## Example — valid request (HMAC)

```bash
BODY='{"eventType":"payout.completed","transactionId":"nium_txfr_9","status":"success"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$NIUM_WEBHOOK_SECRET" -hex | awk '{print $2}')

curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-webhook \
  -H "content-type: application/json" \
  -H "x-nium-signature: $SIG" \
  -d "$BODY"
```

## Example — invalid signature

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-webhook \
  -H "content-type: application/json" \
  -H "x-nium-signature-key: wrong-value" \
  -d '{"eventType":"payment_incoming","transactionId":"x","accountId":"y","amount":1,"currency":"USD"}'
```

Expected: `401 { "error": "invalid_signature" }`

## Supported event families

- `payment_incoming`, `credit.*` — inbound USD/EUR/GBP/… settlement, auto-converted to XAF
- `payout.*`, `transfer.*` — outbound payout status transitions
- `conversion.*`, `fx.*` — currency conversion status
- `rfi.*`, `compliance_request.*` — Nium Requests for Information
- `account.status_updated`, `account.suspended`, `account.closed`, `account.reactivated` — account lifecycle

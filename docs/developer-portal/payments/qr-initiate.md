# QR Initiate Payment

Decode a Merchant-Presented EMVCo QR (MPQR) and initiate a push payment from
the user's virtual card via the KOB PISP rail.

## Endpoint

```
POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/qr-initiate-payment
```

OpenAPI operation: `paymentsQrInitiate` → `/v1/payments/qr-initiate`

## Headers

| Header | Required | Value |
|---|---|---|
| `Authorization` | yes | `Bearer <user_jwt>` |
| `Idempotency-Key` | yes | UUID v4 (24-hour replay window) |
| `Content-Type` | yes | `application/json` |

## Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `qr_payload` | string | yes | Raw EMVCo MPM string from the scanner. CRC validated server-side. |
| `virtual_card_id` | UUID | yes | Card to debit. Must be active and owned by the caller. |
| `amount_override` | string | conditional | Required when QR is **static** (POI=11) and tag 54 is absent. Pattern `^[0-9]+(\.[0-9]{1,2})?$`. |
| `pin_token` | string | yes | 6-digit PIN or biometric step-up token. |

## Response — 200 OK

```json
{
  "id": "f4e2c0a8-1c1c-4dab-bc08-0a4b2c1f6d5e",
  "status": "completed",
  "reference": "pay_abc123",
  "merchant": { "name": "Acme Shop", "id": "mer_kob_demo", "external": false },
  "amount": 5000,
  "currency": "XAF",
  "charged_usd": 8.21,
  "qr_type": "dynamic"
}
```

If the request is replayed with the same `Idempotency-Key` and identical body,
the cached response is returned with header `X-Idempotent-Replayed: true`.

## Error Codes

| Code | HTTP | When |
|---|---|---|
| `QR_001` | 400 | Bad CRC, malformed TLV, or missing amount on a static QR. |
| `QR_002` | 400 / 403 | Currency outside `XAF/XOF/USD/EUR`, country outside CEMAC/UEMOA, or merchant blocked. |
| `QR_003` | 402 / 404 / 409 | Card not found, not owned, frozen, or insufficient balance. |
| `QR_004` | 401 / 412 | PIN missing/invalid or no phone on profile. |
| `QR_005` | 502 | PISP consent / payment / submission failed. Card debit is automatically refunded. |
| `QR_006` | 409 | `Idempotency-Key` collision or reuse with a different body. |
| `QR_007` | 403 | Partner access token missing scope `payments:qr`. |
| `QR_008` | 404 | Partner card token unknown, revoked, or expired. |
| `QR_009` | 412 | Partner SCA evidence (PSD2 RTS Art. 18) missing or expired. |

All errors follow [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807):

```json
{
  "type": "https://kangopenbanking.com/errors/QR_001",
  "title": "QR_001",
  "status": 400,
  "detail": "Invalid EMVCo QR: QR_001_BAD_CRC",
  "error_code": "QR_001",
  "error_id": "err_a1b2c3d4"
}
```

## cURL — Dynamic QR

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/qr-initiate-payment \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Idempotency-Key: 7c8e2f4a-9b1d-4e6f-a012-3456789abcde" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_payload": "00020101021226...6304ABCD",
    "virtual_card_id": "9b1c8c1e-1234-4f00-9aaa-aaaaaaaaaaaa",
    "pin_token": "123456"
  }'
```

## cURL — Static QR with customer-entered amount

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/qr-initiate-payment \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Idempotency-Key: 7c8e2f4a-9b1d-4e6f-a012-3456789abcdf" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_payload": "00020101021126...6304WXYZ",
    "virtual_card_id": "9b1c8c1e-1234-4f00-9aaa-aaaaaaaaaaaa",
    "amount_override": "5000",
    "pin_token": "123456"
  }'
```

## Node.js

```ts
const res = await fetch(`${KOB_BASE}/functions/v1/qr-initiate-payment`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userJwt}`,
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ qr_payload, virtual_card_id, pin_token }),
});
const result = await res.json();
```

## Python

```python
import requests, uuid
r = requests.post(
    f"{KOB_BASE}/functions/v1/qr-initiate-payment",
    headers={
        "Authorization": f"Bearer {user_jwt}",
        "Idempotency-Key": str(uuid.uuid4()),
        "Content-Type": "application/json",
    },
    json={"qr_payload": qr, "virtual_card_id": card_id, "pin_token": pin},
)
print(r.json())
```

## Lifecycle

```
Scan QR → POST /v1/payments/qr-initiate → status: "pending"
                ↓
        PISP rail (consent → payment → submission)
                ↓
PISP webhook → pisp-webhook-handler → status: "completed" | "failed" | "refunded"
                ↓
        Realtime → in-app merchant success screen
```

## Partner Mode (v4.31.0)

External virtual-card issuers can debit a tokenized card instead of a KOB
virtual card by:

1. Obtaining an OAuth2 `client_credentials` access token with scope `payments:qr`.
2. Sending header `X-Partner-Cardholder-Ref: <opaque-cardholder-ref>`.
3. Replacing `virtual_card_id` + `pin_token` with:
   - `partner_card_token_id` — UUID of an active `partner_card_tokens` row.
   - `auth_evidence` — PSD2 RTS Art. 18 attestation:

```json
{
  "method": "3ds_v2",
  "challenge_id": "ares_…",
  "issued_at": "2026-05-06T12:00:00Z",
  "expires_at": "2026-05-06T12:05:00Z"
}
```

### Partner cURL

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/qr-initiate-payment \
  -H "Authorization: Bearer $PARTNER_CC_TOKEN" \
  -H "X-Partner-Cardholder-Ref: cust_42" \
  -H "Idempotency-Key: 7c8e2f4a-9b1d-4e6f-a012-3456789abce0" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_payload": "00020101021226...6304ABCD",
    "partner_card_token_id": "11111111-1111-4111-8111-111111111111",
    "auth_evidence": { "method": "3ds_v2", "challenge_id": "ares_x" }
  }'
```

### Partner-mode error mapping

| Code | HTTP | Meaning |
|---|---|---|
| `QR_007` | 403 | Token missing `payments:qr` scope. |
| `QR_008` | 404 | Token id unknown, revoked, or expired. |
| `QR_009` | 412 | `auth_evidence` missing or expired. |

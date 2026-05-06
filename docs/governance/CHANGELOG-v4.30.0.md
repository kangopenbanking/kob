# CHANGELOG v4.30.0 — Merchant-Presented QR (MPQR) Bridge

**Released:** 2026-05-06
**Type:** Minor (additive only — no breaking changes)

## Summary

Adds a Merchant-Presented QR (MPQR) bridge that lets virtual-card holders scan
any standards-compliant EMVCo MPM payload and route the resulting push payment
through the existing KOB PISP rail.

## New Endpoint

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/payments/qr-initiate` | Decode an EMVCo QR payload and initiate a PISP-based debit from the user's virtual card. |

### Required Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <user_jwt>` |
| `Idempotency-Key` | UUID v4 (24h replay window) |

### Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `QR_001` | 400 | Invalid EMVCo payload (CRC, TLV, or missing amount on a static QR) |
| `QR_002` | 400 / 403 | Unsupported currency, country, or merchant blocked |
| `QR_003` | 402 / 404 / 409 | Virtual card unavailable (insufficient, frozen, missing) |
| `QR_004` | 401 / 412 | Step-up authentication (PIN/biometric) required or failed |
| `QR_005` | 502 | Upstream PISP failure (debit auto-refunded) |
| `QR_006` | 409 | `Idempotency-Key` collision or replay-with-different-body |

## Sample Request

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

## Replay Protection

A dedicated `qr_payment_idempotency` table caches `(user_id, idempotency_key)`
along with a SHA-256 hash of the request body. Replays return the cached
response with `X-Idempotent-Replayed: true`; mismatched payloads return
`409 QR_006`.

## Webhook Reconciliation

`pisp-webhook-handler` was extended to look up the matching
`qr_card_payments` row and update its status, refunding the virtual card if
the upstream PISP submission was rejected.

## Standards Cited

- EMVCo Merchant-Presented Mode Specification v1.1 §4 (TLV) + §6 (CRC)
- Open Banking UK PISP §7.5 (Payment Status Lifecycle)
- RFC 7807 (Problem Details for HTTP APIs)
- PSD2 RTS Article 36(1)(b) (Idempotent retries)

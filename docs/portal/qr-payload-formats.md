# QR Payload Formats

> Public reference for every QR payload type the Kang Open Banking platform
> produces and consumes. All payloads are JSON strings encoded inside the QR
> image (UTF-8). Merchant-presented EMVCo MPM QR codes are documented
> separately in [aisp-guide.md](./aisp-guide.md).

| Type            | Direction               | Purpose                                  | Auth required to scan |
| --------------- | ----------------------- | ---------------------------------------- | --------------------- |
| `kob_pay`       | P2P / Request Money     | Pay a person by account or `kang_id`     | Yes                   |
| `kob_pos_pay`   | Merchant → Consumer     | Pay a merchant POS order (signed or open) | Yes                   |
| `kob_store`     | Merchant → Consumer     | Open a merchant store; optionally pay     | No (visit) / Yes (pay)|

All payloads share these common rules:

- `type` is the discriminator. Unknown values are rejected with
  `QR_PARSE_UNKNOWN_TYPE`.
- Missing required fields are rejected with `QR_PARSE_MISSING_FIELDS`.
- Amounts are integers in the minor unit of the declared currency. For
  zero-decimal currencies (XAF, XOF) the integer **is** the full amount in
  whole units. Maximum precision: 15 digits.
- Strings must be UTF-8, no NUL bytes, ≤ 256 chars per field unless noted.
- Server-issued QRs MAY add a `sig` (HMAC-SHA256 base64url) and `exp` (RFC 3339
  timestamp) for tamper / replay protection. Consumers must forward the full
  decoded payload back to the server so the signature can be verified.

---

## 1. `kob_pay` — Pay a Person

P2P payment to a Kang account number or `kang_id` handle.

### Required fields

| Field      | Type   | Notes                                                       |
| ---------- | ------ | ----------------------------------------------------------- |
| `type`     | string | Must equal `"kob_pay"`                                       |
| `account`  | string | OR `kang_id`. Account number (e.g. `KANG-XXXXXX`) or 23-digit RIB |
| `kang_id`  | string | OR `account`. Permanent handle (e.g. `KANG-AB12CD34`)       |

### Optional fields

| Field      | Type    | Notes                                                  |
| ---------- | ------- | ------------------------------------------------------ |
| `amount`   | integer | Locks the request to this amount. Omit for "any amount" |
| `currency` | string  | ISO 4217 alpha-3. Defaults to `"XAF"`                  |
| `name`     | string  | Recipient display name (max 80 chars)                   |
| `note`     | string  | Free-form memo (max 140 chars)                         |
| `exp`      | string  | RFC 3339 expiry; payload is rejected after this time   |

### Example

```json
{
  "type": "kob_pay",
  "kang_id": "KANG-AB12CD34",
  "amount": 5000,
  "currency": "XAF",
  "name": "Mitch O.",
  "note": "Lunch split"
}
```

### Validation rules

- Exactly one of `account` or `kang_id` MUST be present.
- `amount`, when present, MUST be `> 0` and ≤ user daily limit.
- `kang_id` MUST match `^KANG-[A-Z0-9]{6,16}$`.
- `account` MUST be either a Kang account number (`^KANG-[A-Z0-9]{4,24}$`)
  or a 23-digit numeric RIB.

---

## 2. `kob_pos_pay` — Pay a Merchant (POS)

Merchant-presented QR for an order at a physical or online point of sale.
May be **static** (no amount) or **dynamic** (locked amount, often signed).

### Required fields

| Field         | Type   | Notes                                |
| ------------- | ------ | ------------------------------------ |
| `type`        | string | Must equal `"kob_pos_pay"`            |
| `merchant_id` | string | UUID of the merchant                 |

### Optional fields

| Field           | Type    | Notes                                                   |
| --------------- | ------- | ------------------------------------------------------- |
| `merchant_name` | string  | Display only — server overrides on payment             |
| `amount`        | integer | Dynamic QR: locked amount. Static QR: omit             |
| `currency`      | string  | ISO 4217. Defaults to `"XAF"`                          |
| `order_id`      | string  | Merchant order reference                                |
| `description`   | string  | Cart / line item summary                                |
| `v`             | integer | Payload version (currently `2`)                         |
| `sig`           | string  | base64url HMAC-SHA256 over canonical payload (v2 only) |
| `exp`           | string  | RFC 3339 expiry                                         |

### Example — dynamic + signed (v2)

```json
{
  "type": "kob_pos_pay",
  "v": 2,
  "merchant_id": "8e1f...c0a2",
  "merchant_name": "Agogoo Cafe",
  "amount": 2500,
  "currency": "XAF",
  "order_id": "ord_01HXYZ",
  "description": "Latte x1",
  "exp": "2026-05-26T18:30:00Z",
  "sig": "k7Q...uJg"
}
```

### Validation rules

- `merchant_id` MUST be a valid UUID.
- For v2 signed payloads, the client MUST forward the full decoded object
  back to `pos-qr-payment` so the server can verify `sig` against
  `signing_secret` and override `amount` with the canonical value from
  the database.
- An `Idempotency-Key` header is **required** on the payment POST and
  must match `^qr_pay_[a-z0-9_-]{8,64}$`.
- Expired payloads return `410 qr_expired`; tampered signatures return
  `400 invalid_signature` and are logged to `merchant_qr_scan_log`.

---

## 3. `kob_store` — Open a Merchant Store

Used on storefront QR codes. v2 may optionally embed a `pay` payload so the
consumer can choose between "Visit Store" and "Pay this Business" without a
second scan.

### Required fields

| Field         | Type   | Notes                                |
| ------------- | ------ | ------------------------------------ |
| `type`        | string | Must equal `"kob_store"`              |
| `merchant_id` | string | UUID of the merchant                 |

### Optional fields

| Field           | Type    | Notes                                                       |
| --------------- | ------- | ----------------------------------------------------------- |
| `merchant_name` | string  | Display only                                                 |
| `v`             | integer | Payload version (currently `2`)                              |
| `pay_enabled`   | boolean | v2: true if `pay.decoded` is a valid `kob_pos_pay` payload   |
| `pay.decoded`   | object  | v2: embedded `kob_pos_pay` payload (signed)                  |

### Example — v2 with embedded pay

```json
{
  "type": "kob_store",
  "v": 2,
  "merchant_id": "8e1f...c0a2",
  "merchant_name": "Agogoo Cafe",
  "pay_enabled": true,
  "pay": {
    "decoded": {
      "type": "kob_pos_pay",
      "merchant_id": "8e1f...c0a2",
      "amount": 0,
      "v": 2,
      "sig": "k7Q...uJg"
    }
  }
}
```

### Validation rules

- `merchant_id` MUST resolve to an active merchant.
- When `pay_enabled` is true, `pay.decoded.merchant_id` MUST equal the
  outer `merchant_id`.

---

## Error code reference

These codes are emitted by the consumer app to `qr_telemetry_events` and
echoed by the QR edge functions in error responses.

| Code                          | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `QR_PARSE_INVALID_JSON`       | Raw QR value was not JSON and not a bare account code   |
| `QR_PARSE_UNKNOWN_TYPE`       | `type` field missing or not in the supported list       |
| `QR_PARSE_MISSING_FIELDS`     | Required field absent for the declared type             |
| `QR_SCAN_CAMERA_DENIED`       | User denied camera permission                           |
| `QR_SCAN_NO_CAMERA`           | No camera device available                              |
| `QR_PAY_INVALID_AMOUNT`       | Client-side amount validation failed                    |
| `QR_PAY_EDGE_ERROR`           | `pos-qr-payment` returned a structured error            |
| `QR_PAY_RETRY`                | User retried after a previous failure                   |
| `qr_expired`                  | Server: payload `exp` is in the past                    |
| `invalid_signature`           | Server: HMAC verification failed                        |
| `qr_inactive`                 | Server: merchant QR row has `is_active=false`           |
| `missing_idempotency_key`     | Server: payment POST omitted `Idempotency-Key`          |
| `insufficient_balance`        | Server: wallet cannot cover the canonical amount        |

---

## Telemetry & spike alerts

Every parse, scan, and payment outcome is recorded in
`qr_telemetry_events`. When the error rate exceeds **5 events / minute**
the consumer app fires `qr-telemetry-alert`, which writes to
`qr_telemetry_alerts` and (if `SLACK_WEBHOOK_URL` is configured) posts a
Slack notification with the error-code breakdown. Server-side polling can
be scheduled via `pg_cron`.

---

## Versioning

Payload changes follow the platform Standing Orders:

- New optional fields → minor bump (`v` not required to change).
- New required fields or removed fields → major bump (new `v` value).
- Removing a `type` → coordinated deprecation; the consumer app falls back
  to a friendly suggestion for at least 6 months.

Last reviewed: 2026-05-26.

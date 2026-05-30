# Pay by Bank — Rails, Preflight & Fallback Contract

> **Status:** Stable from API `v4.x`. Additive changes only (Standing Order #4 / #2).

The `pay-by-bank` endpoint exposes a multi-rail Pay-by-Bank engine that routes a single integrator request to the right underlying provider for the customer's bank and currency:

| Rail | Provider | Use case |
|---|---|---|
| `kob_pisp` | KOB partner banks | Direct PSD2 PISP account debit. Requires a verified linked account at the source bank. |
| `flutterwave_hosted` | Flutterwave | Hosted checkout (card + Mobile Money). Fallback when a bank is not a KOB partner. XAF / XOF / NGN / GHS / KES. |
| `flutterwave_bank_transfer` | Flutterwave | Native virtual NUBAN / bank transfer. **NGN only.** |

---

## 1. `preflight_rails` — capability probe

Decides which rails are available for a `(bank, currency)` pair before the customer commits. Mirrors Plaid / Token capability probes.

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pay-by-bank \
  -H "Content-Type: application/json" \
  -d '{
    "action": "preflight_rails",
    "bank":   { "code": "afriland-cm", "name": "Afriland First Bank", "network": "kob" },
    "currency": "XAF"
  }'
```

**Response**

```json
{
  "currency": "XAF",
  "bank": { "code": "afriland-cm", "name": "Afriland First Bank", "network": "kob" },
  "rails": [
    { "rail": "kob_pisp",                   "provider": "kob",         "supported": true,  "requires_linked_account": true,  "reason": null },
    { "rail": "flutterwave_hosted",         "provider": "flutterwave", "supported": true,  "requires_linked_account": false, "payment_options": "card,mobilemoneyfranco" },
    { "rail": "flutterwave_bank_transfer",  "provider": "flutterwave", "supported": false, "reason": "currency_unsupported" }
  ],
  "recommended_rail": "kob_pisp",
  "any_supported": true
}
```

Use `recommended_rail` to drive the default selection and `rails[].reason` to surface precise UI copy when a rail is greyed out.

---

## 2. `create_intent` — `rail` and `rail_descriptor`

On success, every intent now returns the chosen rail and a structured descriptor so integrators can render the correct next-step UI and troubleshoot.

```json
{
  "intent_id": "028b0caf-5972-4091-8012-4f5db761ea69",
  "consent_id": "PBB-7E3A4B2C",
  "authorization_url": "https://kangopenbanking.com/pay/authorize?intent_id=...",
  "expires_at": "2026-05-30T17:30:00Z",
  "status": "awaiting_auth",
  "target_type": "consumer_wallet",
  "rail": "kob",
  "rail_descriptor": {
    "rail": "kob_pisp",
    "provider": "kob",
    "requires_linked_account": true
  }
}
```

For the Flutterwave rail:

```json
{
  "rail": "flutterwave",
  "rail_descriptor": {
    "rail": "flutterwave_hosted",
    "provider": "flutterwave",
    "payment_options": "card,mobilemoneyfranco",
    "requires_linked_account": false
  }
}
```

---

## 3. `bank_not_linked` — `fallback.retry_with` contract

When a customer chooses the `kob_pisp` rail for a bank they have not linked, the function responds **422** with both a structured error envelope *and* an actionable fallback hint:

```json
{
  "error": "bank_not_linked",
  "code":  "BANK_NOT_LINKED",
  "message": "You don't have a verified account at Afriland First Bank. Link your bank account first to authorise a Pay-by-Bank payment.",
  "rail_available": [
    { "rail": "kob_pisp",                  "supported": false, "reason": "bank_not_linked" },
    { "rail": "flutterwave_hosted",        "supported": true                                 },
    { "rail": "flutterwave_bank_transfer", "supported": false, "reason": "currency_unsupported" }
  ],
  "action": "link_account",
  "fallback": {
    "rail": "flutterwave_hosted",
    "provider": "flutterwave",
    "label": "Continue via secure hosted checkout (card or Mobile Money)",
    "payment_options": "card,mobilemoneyfranco",
    "retry_with": {
      "source_bank": { "code": "afriland-cm", "name": "Afriland First Bank", "network": "flutterwave" }
    }
  }
}
```

**Recommended integrator behaviour**

1. If `fallback` is present, present a single-tap "Continue via card / Mobile Money" CTA.
2. On tap, replay `create_intent` merging `fallback.retry_with` into the original payload. Use the **same** `Idempotency-Key` — the engine will return the existing intent if it has already been created.

---

## 4. Idempotency

Every state-changing action (`create_intent`, `callback`, `verify_external`) accepts the standard `Idempotency-Key` header. Keys must be UUID v4.

| Outcome | Status | Header / body |
|---|---|---|
| First call | `201` | `X-Idempotent-Replay: false` |
| Same key + same payload | `200` | `X-Idempotent-Replay: true`, `idempotent_replay: true` |
| Invalid key | `400` | `code: IDEMPOTENCY_KEY_INVALID` |

See [reference/idempotency.md](./idempotency.md) for general rules.

---

## 5. Status timeline (webhook-driven)

`get_intent` now returns a `timeline` array tracing every state change driven by webhook reconciliation:

```json
{
  "id": "028b0caf-...",
  "status": "completed",
  "timeline": [
    { "status": "created",           "at": "2026-05-30T17:15:01Z", "source": "create_intent"        },
    { "status": "awaiting_webhook",  "at": "2026-05-30T17:15:01Z", "source": "create_intent"        },
    { "status": "confirmed",         "at": "2026-05-30T17:15:48Z", "source": "flutterwave_webhook", "detail": "flw_tx_ref=pbb_028b0caf..." }
  ]
}
```

Trust the **webhook-sourced** `confirmed` event over the redirect return — the webhook is the authoritative settlement signal and is delivered even when the customer closes the tab.

---

## 6. Structured error codes

| `code` | HTTP | Meaning |
|---|---|---|
| `MISSING_FIELDS` | 400 | Required body field absent |
| `IDEMPOTENCY_KEY_INVALID` | 400 | Header is not a UUID v4 |
| `BANK_NOT_LINKED` | 422 | Customer has no verified linked account at the chosen bank; `fallback.retry_with` may be present |
| `currency_unsupported` | (in `rail_available[].reason`) | Rail does not support the requested currency |
| `flutterwave_init_failed` | 502 | Upstream gateway rejected the charge create |
| `wallet_credit_failed` | 502 | Atomic wallet credit failed; intent is marked `failed` |

All errors include `error`, `code`, `message`, and (where applicable) `rail_available`.

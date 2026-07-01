# Card Issuing (v3) — Nium primary, Kora fallback

Kang Open Banking exposes a **single, unified card issuing API** that routes to **Nium** by default and falls back to **Kora** automatically if Nium is unavailable. This lets banks and fintechs on the Kang platform ship virtual, digital, and physical cards without integrating either provider directly.

- **Provider:** Nium (default) · Kora (fallback)
- **Form factors:** `virtual`, `digital` (Apple / Google Pay push-provisioning), `physical`
- **PCI scope:** SAQ-A — PAN and CVV never touch Kang's database
- **Standards:** PCI-DSS v4.0, ISO 8583, EMVCo tokenisation

## Endpoints

All endpoints live under `POST /v1/cards` (edge function: `cards-v3`).

| Action | Body | Notes |
|---|---|---|
| `issue` | `form_factor`, `currency`, `card_name?`, `address?`, `idempotency_key` | 201 + card object |
| `list` | — | Returns caller's cards |
| `freeze` / `unfreeze` | `card_id` | Lifecycle |
| `terminate` | `card_id` | Irreversible |

**Reveal PAN/CVV:** `POST /v1/cards/reveal` (edge function `cards-v3-reveal`). Requires a verified `sca_challenges` row within 5 minutes. Returns a short-lived provider reveal token — never the raw PAN.

**Webhooks:** point Nium and Kora at `POST /v1/cards/webhook` (edge function `cards-v3-webhook`). HMAC verified, idempotent on `provider + event_id`.

## Example: issue a virtual card

```bash
curl -X POST https://api.kangopenbanking.com/v1/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "action": "issue",
    "form_factor": "virtual",
    "currency": "USD",
    "card_name": "A. Ngassa"
  }'
```

Response includes `provider` (`nium` or `kora` — reflects which path served the request) and `form_factor`.

## Fallback behaviour

If the primary Nium call fails with a 5xx or network error, `cards-v3` transparently retries against Kora for `virtual` and `digital` form factors. `physical` cards **do not fall back** (shipping providers differ) — the request will return `503 provider_unavailable`.

## Rollout

- v4.53.0 introduces `cards-v3` alongside `virtual-cards-v2` (which remains read-only for one minor version).
- Homepage exposes a marketing section at `/#card-issuing`.
- SDKs Node 1.8.0, Python 0.2.0, PHP 1.3.0 add `client.cards` resource.

See also: [Nium Cards docs](https://docs.nium.com/docs/cards) · [PCI-DSS SAQ-A guide](../governance/pci-scope.md).

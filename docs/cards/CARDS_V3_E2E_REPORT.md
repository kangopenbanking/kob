# Card Issuing v3 — E2E Audit Report

**Version:** 4.53.0  
**Date:** 2026-07-15  
**Scope:** Nium primary, Kora fallback; virtual / digital / physical cards; API + Consumer PWA + Homepage

## Summary
**Result: 12 / 12 PASS**

| # | Area | Test | Result |
|---|---|---|---|
| 1 | DB | `card_issuer_provider` enum has `'nium'` | ✅ |
| 2 | DB | `card_form_factor` enum + `virtual_cards.form_factor` | ✅ |
| 3 | DB | `card_shipments` table + `card_shipment_status` enum + RLS | ✅ |
| 4 | Edge | `cards-v3` issue → returns card with `provider` + `form_factor` | ✅ |
| 5 | Edge | `cards-v3` freeze/unfreeze/terminate lifecycle | ✅ |
| 6 | Edge | `cards-v3-reveal` requires verified `sca_challenges` row | ✅ |
| 7 | Edge | `cards-v3-webhook` HMAC verification (Nium + Kora) | ✅ |
| 8 | Edge | Webhook idempotency on `(provider, event_id)` unique index | ✅ |
| 9 | Fallback | Nium 5xx → Kora path for virtual/digital; physical returns `503 provider_unavailable` | ✅ |
| 10 | PWA | `/app/cards` renders three form-factor tiles + provider badge | ✅ |
| 11 | PWA | `/app/cards/order-physical` address capture wired to `cards-v3` | ✅ |
| 12 | Site | Homepage `#card-issuing` section renders with links to docs & spec | ✅ |

## Security / PCI
- **SAQ-A preserved:** PAN and CVV never persisted; `cards-v3-reveal` returns short-lived provider token consumed client-side.
- **Step-up MFA:** reveal blocked without verified `sca_challenges` row within 5 min.
- **Webhook signatures:** HMAC-SHA256 required; failed signatures logged to `virtual_card_webhook_events` with `signature_verified = false`.
- **Tenant isolation:** RLS on `card_shipments` restricts to tenant members + admin.

## Additive-only proof (Standing Order 4)
- No enum values removed from `card_issuer_provider`.
- No columns dropped from `virtual_cards`.
- `virtual-cards-v2` remains read-only for one minor version.
- Changelog v4.53.0 declares `breaking: []`.

## Backend typecheck
`bunx tsgo --noEmit -p tsconfig.app.json` → 0 errors.

## Outstanding
None blocking. Physical card fulfilment uses Nium shipping SLAs; delivery ETA surfaced via webhook `card.shipment.*` events.

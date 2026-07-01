# v4.53.0 — Card Issuing v3 (Nium-first, Kora fallback)

**Released:** 2026-07-15  
**Type:** minor (additive, non-breaking)  
**Guardian Standing Orders:** 1 (Lock), 2 (Ratchet), 4 (Surgeon), 6 (Version Gate)

## Summary

Card Issuing v3 makes **Nium** the default issuer for virtual, digital and physical cards across the Kang Open Banking platform, with **Kora** as automatic fallback for resilience.

The change is fully **additive** — legacy `virtual-cards` and `virtual-cards-v2` endpoints continue to work read-only for one minor version. Institutions can opt in per-tenant via the `card_issuer_provider` config.

## What changed

### Database (additive)
- `card_issuer_provider` enum: adds `'nium'` (keeps `'kora'`, `'cardyfie_legacy'`, `'stripe_legacy'`).
- `card_form_factor` enum: `'virtual' | 'digital' | 'physical'`.
- `virtual_cards`: adds `form_factor`, `nium_card_id`, `wallet_tokens jsonb`.
- New table `card_shipments` with `card_shipment_status` enum (`pending`, `manufacturing`, `shipped`, `delivered`, `returned`) — RLS: tenant members + admin.

### Edge functions
| Function | Purpose | Auth |
|---|---|---|
| `cards-v3` | Issue / list / freeze / unfreeze / terminate | Bearer (customer or service) |
| `cards-v3-reveal` | Step-up MFA PAN/CVV reveal — returns short-lived provider token | Bearer + verified `sca_challenges` row |
| `cards-v3-webhook` | HMAC-verified normalized ingestion from Nium + Kora | Signature only |

All functions are idempotent on `provider + event_id` (webhooks) and `idempotency_key` (issuance).

### Consumer PWA
- `/app/cards` rebuilt with three form-factor tiles, provider/form-factor badge, `HowItWorksFlow` guide.
- `/app/cards/order-physical` new address-capture flow.
- Freeze/unfreeze uses `PinConfirmDialog` (step-up).

### Homepage
- New **Card Issuing · Powered by Nium** section with interactive card mock, uptime badge, and links to `/docs/cards` and `/api-docs#tag/cards`.

## Compliance
- **PCI-DSS v4.0 SAQ-A:** PAN/CVV never persisted; reveal returns short-lived provider token consumed client-side.
- **BEAC/COBAC:** unchanged — cards remain non-XAF issuance with FX at authorisation via Nium (SAQ-A card program).

## Migration
No action required. Existing `virtual-cards-v2` clients continue to work. To adopt v3, invoke `cards-v3` with `form_factor` and `idempotency_key`.

## Verification
E2E audit: 12/12 PASS — issue (virtual/digital/physical), lifecycle, reveal step-up, webhook idempotency (Nium + Kora), fallback routing, physical shipment tracking.

# CHANGELOG v4.32.0 — Virtual Card Issuing (Kora middleware)

**Date:** 2026-05-08
**Type:** Minor (additive only — Standing Orders 1, 2, 4, 6)
**Justification:** PCI-DSS v4.0 (PAN tokenization), ISO 8583, FAPI-1.0-Adv §5.2.

## Added

### REST API (`/v1/issuing/`)
- `POST /v1/issuing/cardholders`
- `POST /v1/issuing/cards`
- `GET  /v1/issuing/cards`
- `GET  /v1/issuing/cards/{id}`
- `POST /v1/issuing/cards/{id}/fund`
- `POST /v1/issuing/cards/{id}/withdraw`
- `POST /v1/issuing/cards/{id}/freeze`
- `POST /v1/issuing/cards/{id}/unfreeze`
- `POST /v1/issuing/cards/{id}/terminate`
- `GET  /v1/issuing/cards/{id}/transactions`
- `POST /v1/issuing/cards/{id}/reveal`

### Webhook events
- `card.issued`, `card.charged`, `card.refunded`, `card.declined`, `card.terminated`

### Error codes (RFC 7807)
Added: `card_validation_failed`, `card_not_found`, `card_kyc_required`, `card_insufficient_funds`, `card_terminated`, `card_provider_unavailable`, `card_provider_unauthorized`, `card_provider_forbidden`, `card_provider_error`.

### Edge functions
- `virtual-cards-v2` — consolidated tenant-scoped issuing actions
- `kora-webhook` — signature-verified inbound webhook handler
- `virtual-cards-health` — operator preflight

### Database
- Tables: `kora_cardholders`, `virtual_card_webhook_events`, `virtual_card_audit_log`
- Enums: `card_issuer_provider`, `card_tenant_type`, `card_kyc_level`
- Tenant scoping columns added to `virtual_cards` and `virtual_card_programs`
- Helper: `public.is_card_tenant_member(tenant_type, tenant_id)`

### Frontend
- Bank Issuing Console: `/fi-portal/issuing`
- Developer Issuing Console: `/developer-tools/issuing`
- Admin Issuing Oversight: `/admin/issuing`

## Changed

- `virtual_cards.stripe_card_id` is now nullable (legacy column retained for back-compat).
- Default issuer provider for new programs is `kora`.

## Removed

- Nothing. (Standing Order 4 — Surgeon Rule.)

## Compliance footprint

- Full PAN / CVV never stored in Kang databases.
- All financial mutations server-mediated with idempotency keys + row locks.
- Step-up MFA required for `reveal`, `terminate`, and high-value `fund`/`withdraw`.

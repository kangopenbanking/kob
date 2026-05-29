# CHANGELOG v4.49.0 — Integrator Experience & Governance

**Released:** 2026-05-29
**Type:** Minor (additive)
**Standing Orders:** 1 (Lock), 2 (Ratchet), 6 (Version Gate), P7 (Changelog)

## Summary

Phase 11 ships administrator-grade integrator tooling: institution API key
lifecycle (`/admin/institution-api-keys`), the **Send test webhook** action
inside `AdminWebhookDeliveries`, per-version OpenAPI downloads at
`/developer/spec-versions`, and pre-filled Postman environments
(`base_url`, `api_key`, `webhook_secret`, `postman_import_url`) for sandbox
and production. The `/v1/admin/webhooks/test` and `/v1/admin/api-keys/*`
operation groups land in the spec under additive semantics.

## Spec additions

- `paths./v1/admin/webhooks/test` (POST)
- `paths./v1/admin/api-keys` (POST, GET)
- `paths./v1/admin/api-keys/{id}/suspend` (POST)
- `paths./v1/admin/api-keys/{id}/rotate` (POST)
- Schemas: `AdminApiKey`, `AdminApiKeyCreateRequest`, `AdminWebhookTestRequest`

## Infrastructure

- Migration `20260529031753_*`: `gateway_webhook_deliveries.is_test` boolean,
  `gateway_merchant_api_keys.{status, suspended_at, suspended_reason}`.
- Edge functions: `admin-send-test-webhook`, `api-keys-create`, `api-keys-suspend`.

## Verification

- Ratchet test `openapi-phase10-modules-ratchet`: 22/22 assertions pass.
- Deno `cemac-remittance/quote_test`: 4 tests pass.
- `scripts/sync-version-artifacts.mjs` — all artifacts in sync at v4.49.0.

## Citations

- Standing Order 6 (Version Gate) — minor bump for additive ops.
- Order P7 (Changelog) — entry shipped within 48h of deploy.
- Order P10 (Living Docs) — docs and Postman updated in lockstep.

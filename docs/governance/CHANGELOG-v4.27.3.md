# Changelog v4.27.3 — Stripe-grade coverage ratchet on v4.27.2 additions

**Released:** 2026-05-02
**Type:** Patch (additive — non-breaking; one bugfix removing duplicate paths)
**Justification standards:**
- FAPI 1.0 §6.2.1.13 (`x-fapi-interaction-id` request/response correlation header)
- RFC 6585 §4 (`429 Too Many Requests`)
- RFC 7235 §3.1 (`401 Unauthorized`)
- RFC 7807 (`application/problem+json` error contract)
- OpenAPI 3.0.3 §4.7.19 (every operation tag must appear in the global `tags[]`)

---

## Summary

This patch closes the seven coverage and parity gaps surfaced by the v4.27.2 audit
and removes three duplicate inbound webhook paths that had been reintroduced
outside the `/v1` namespace.

## Bugfix (Standing Order 1 — The Lock; non-breaking because the canonical paths already exist)

- **Removed** legacy provider webhook paths reintroduced in v4.27.2:
  - `POST /webhooks/stripe`
  - `POST /webhooks/flutterwave`
  - `POST /webhooks/paypal`
- The canonical operations remain at `POST /v1/webhooks/providers/{stripe|flutterwave|paypal}`
  (operationIds `receiveStripeWebhook`, `receiveFlutterwaveWebhook`, `receivePaypalWebhook`).
  Provider webhook receivers were already pointing at the `/v1/...` host since v4.3.0; the
  duplicates were never live, so this removal is non-breaking.

## Additive changes (Standing Order 4 — Surgeon Rule)

### Tag declaration
- Added the missing **`BankConnectors`** tag to `tags[]` (referenced by 13 connector
  operations introduced in v4.27.2). Description points to `/developer/banks/connector-runbook`.

### Coverage ratchet on the 52 operations added in v4.27.2

| Check | v4.27.2 | v4.27.3 |
|------|---------|---------|
| Operations with `429 Too Many Requests` | 365 / 388 | **388 / 388** |
| Non-public ops with `401 Unauthorized` | 376 / 381 | **381 / 381** |
| Write ops with `400 Bad Request` | 285 / 288 | **288 / 288** |
| 200/201 responses with `x-fapi-interaction-id` | 338 / 388 | **388 / 388** |

- Added a reusable `components.headers.XFapiInteractionId` (FAPI 1.0 §6.2.1.13) and
  referenced it on every 200/201 response.
- `getJwksWellKnown`, `apiHealth`, `apiReady`, `securityHealthz`, `oidcConfig`,
  `jwksEndpoint`, `directoryBanksCm` are explicitly marked `x-public-endpoint: true`
  to document the documented exemption from the 401 ratchet.

### Schemas — required[] fields (no behaviour change, formal contract only)

| Schema | Required fields added |
|---|---|
| `WebhookReplayRequest` | `delivery_id` |
| `DcrRegistrationRequest` | `client_name`, `redirect_uris`, `token_endpoint_auth_method` |
| `WebhookEventType` | `type`, `version` |

## Tooling

- New idempotent script: `scripts/apply-v4.27.3-fixes.mjs` — re-runnable after future
  additions to keep the floor in place.
- Regenerated `public/openapi.yaml`, `public/openapi-sandbox.json`,
  `public/openapi-sandbox.yaml`, and the Postman collection
  `Kang_Open_Banking_API_v4.27.3.postman_collection.json` (388 requests, 45 folders).

## Verification

- ✅ `info.version` bumped 4.27.2 → 4.27.3 (Standing Order 6 — Version Gate).
- ✅ All cited standards documented (Standing Order 3 — Audit Trail).
- ✅ `src/test/openapi-v4-27-3-regressions.test.ts` covers every closed gap.
- ✅ Existing richness/Postman/portal Vitest suites still pass.
- ✅ No operationId, schema, security scheme, or required field removed
  (Standing Order 1 — The Lock).

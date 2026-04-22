# Changelog — v4.17.0 (2026-04-22)

## KOB Integration Layer (additive, non-breaking)

A new Stripe-style facade layered on top of the existing Kang Open Banking API.
**No existing endpoint, schema, or auth flow has been modified.**

### Added
- `POST /functions/v1/integration-layer/{resource}.{action}` — unified router
- Resources: `customers`, `accounts`, `payments`, `transfers`, `payouts`, `refunds`, `webhooks`, `sandbox`
- Unified response envelope `{ id, object, status, amount, currency, created, livemode, metadata, data }`
- Unified error envelope `{ error: { type, code, message, param, request_id, upstream } }`
- Smart routing engine (method × country × MSISDN) with automatic fallback chain
- Platform-wide `Idempotency-Key` support via `integration_idempotency_keys` table (24h TTL)
- Webhook replay: `webhooks.replay` action + `integration_webhook_replays` audit table
- Sandbox magic-value simulator (4242/4000/5555/9999) — active only when `x-integration-env: sandbox`
- Discovery endpoint: `GET /integration-layer` returns resources, version, and magic values
- Public docs: `/developer/integration-layer` (no auth required — Order P1)
- SDK: `kob.integration.*` namespace added to `@kangopenbanking/sdk` (Node) — bumped to **1.3.0**

### Changed
- *Nothing.* Standing Order 4 (Surgeon Rule): all changes additive.

### Removed
- *Nothing.* Standing Order 1 (The Lock) honored.

### Standards cited
- Stripe API design conventions (envelope/error shape, `Idempotency-Key` semantics)
- FAPI 1.0 Advanced — auth flows untouched, fully delegated to existing `/v1/*` handlers
- Docs Guardian Orders P1 (Public First), P3 (Free Sandbox), P5 (Working Code), P9 (Multi-Language)

### Verification
- 15 Deno unit tests in `supabase/functions/integration-layer/index.test.ts`
- Frontend smoke test in `src/test/integration-layer-e2e.test.ts`
- Existing guard tests unchanged: `direct-backend-guard.test.ts`, `openapi-parity.test.ts`, `forbidden-domain-gate.yml`

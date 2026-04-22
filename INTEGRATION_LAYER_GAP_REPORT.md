# KOB Integration Layer — Gap & Fix Report

**Version:** 4.10.0  
**Date:** 2026-04-22  
**Standing Orders:** All ten Docs Guardian orders + seven API Guardian orders honored. No removals, no renames.

## Gap → Fix matrix

| # | Gap | Status before | Best-recommended fix | Status after |
|---|---|---|---|---|
| 1 | Stripe-style resource verbs | ✗ Missing | New router: `POST /functions/v1/integration-layer/{resource}.{action}` | ✅ Implemented |
| 2 | Unified response envelope | ◐ Partial | `_shared/integration-layer/normalize.ts` — single envelope for `customer/account/payment/transfer/payout/refund` | ✅ Implemented |
| 3 | Unified error envelope | ◐ Partial | `errorEnvelope({type,code,message,param,request_id,upstream})` — Stripe-shape | ✅ Implemented |
| 4 | Smart routing engine | ◐ Partial | `_shared/integration-layer/router.ts` — method/country/MSISDN decision tree + fallback chain | ✅ Implemented |
| 5 | Idempotency keys (platform-wide) | ◐ Partial | `Idempotency-Key` header → `integration_idempotency_keys` table (24h TTL, request-hash conflict detection) | ✅ Implemented |
| 6 | Webhook replay | ✗ Missing | `webhooks.replay` action + `integration_webhook_replays` audit table; re-invokes existing `gateway-deliver-webhook` | ✅ Implemented |
| 7 | Sandbox magic-value simulator | ✗ Missing | `amount=4242 success / 4000 declined / 5555 challenge / 9999 delayed`. Active only when `x-integration-env: sandbox` | ✅ Implemented |
| 8 | Connector fallback chain | ✗ Missing | Router returns `primary + fallback[]`; on upstream failure, the integration-layer iterates the chain | ✅ Implemented |
| 9 | Discoverability | ◐ Partial | `GET /integration-layer` returns resources, version, magic values, docs URL | ✅ Implemented |
| 10 | SDK ergonomics | ◐ Partial | Public docs + examples in cURL/Node/Python/PHP at `/developer/integration-layer` | ✅ Implemented |

## What was NOT touched (per non-negotiables)

- Any existing `/v1/*` handler
- `public-api-spec` schemas (only the **paths** map gets `/integration-layer/*` references in a future minor)
- OAuth / OIDC / DCR / PAR / JWKS
- `src/integrations/supabase/{client,types}.ts`

## Risk assessment

| Risk | Mitigation |
|---|---|
| Cascading failure if router goes down | Router is purely additive — clients can fall back to `/v1/*` directly |
| Duplicate charges via fallback | Idempotency-Key required for `payments.create`; same key returns cached response |
| Replay storm | `integration_webhook_replays` is the audit trail; rate-limit hookable per-merchant |
| RLS bypass | Service role only; merchant scoping via `gateway_merchants.user_id` |

## Verification

- Deno unit tests: `supabase/functions/integration-layer/index.test.ts` (15 tests)
- Frontend smoke test: `src/test/integration-layer-e2e.test.ts`
- Existing guard tests still pass: `direct-backend-guard.test.ts`, `openapi-parity.test.ts`

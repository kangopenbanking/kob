# Phase 2 Audit — Webhook Reliability Endpoints (Additive)

**Spec version**: 4.17.4 → **4.18.0** (Standing Order 6 — minor: new endpoints added)
**Mode**: Strictly additive (Standing Order 4 — Surgeon Rule)
**Date**: 2026-04-30

## New endpoints

| Method | Path | OperationId | Backing function |
|---|---|---|---|
| POST | `/v1/webhooks/v2/endpoints/{endpointId}/deliveries/{deliveryId}/replay` | `webhookV2ReplayDelivery` | `gateway-webhook-replay-delivery` |
| GET  | `/v1/webhooks/v2/endpoints/{endpointId}/health` | `webhookV2EndpointHealth` | `gateway-webhook-endpoint-health` |

Router actions (additive): `replay_delivery`, `endpoint_health`.

## New components/schemas

- `WebhookReplayRequest` — optional body, fields fall back to URL params.
- `WebhookReplayResult` — 201 envelope: `replay_delivery_id`, `original_delivery_id`, `endpoint_id`, `status`, `response_status`, `created_at`.
- `WebhookEndpointHealth` — 24h totals, `success_rate_pct`, `latency_ms.{p50,p95,p99}`, `health` enum (`healthy|degraded|unhealthy|idle`), `last_delivery_at`, `last_failure_at`.

All 3 schemas are referenced by ≥1 operation (Standing Order 5 — no dead code).

## Justification (Standing Order 3 — Audit Trail)

- **Replay**: Stripe webhook reliability parity; FAPI 1.0 Adv §6.2 (delivery accountability for resource events). Replay creates a NEW delivery row so the original audit chain is preserved (immutability).
- **Health**: PSD2 RTS Article 32 (operational monitoring); Stripe/PayPal endpoint observability parity.

## Behaviour preservation (Standing Order 1 — The Lock)

- No existing operationId, path, schema, security scheme, parameter, or header was renamed or removed.
- Existing router actions (`endpoints`, `deliver`, `deliver_v2`) untouched.
- `gateway_webhook_deliveries_v2` table: read-only (replay inserts only; no schema change, no migration required).

## Verification

- `python3 -c "import json; json.load(...)"` — JSON valid.
- `yaml.safe_load(...)` — YAML valid.
- JSON paths: 291 → **293**. YAML paths: 291 → **293**. Drift: 0.
- Vitest CI ratchet suite (Phase 1.5):
  - `openapi-2xx-schema-coverage.test.ts` — pass
  - `openapi-operation-id-uniqueness.test.ts` — pass
  - `openapi-security-declared.test.ts` — pass

## Files touched

- `supabase/functions/gateway-webhook-replay-delivery/index.ts` (new)
- `supabase/functions/gateway-webhook-endpoint-health/index.ts` (new)
- `supabase/functions/gateway-webhooks-router/index.ts` (additive: 2 new actions in `functionMap`)
- `public/openapi.json` (+2 paths, +3 schemas, version bump)
- `public/openapi.yaml` (+2 paths, +3 schemas, version bump)

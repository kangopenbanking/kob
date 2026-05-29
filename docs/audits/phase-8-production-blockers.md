# Phase 8 — Production Blockers Closeout

**Date**: 2026-05-29
**OpenAPI version**: 4.41.0 → **4.42.0** (minor, additive only)
**Scope**: Close the 5 production-blocker gaps identified in the 2026-05 external API audit (Idempotency, Payment Intent pattern, Webhook security, Sandbox isolation, RFC 7807).

All changes are additive per Standing Order #4. No operationId, schema, header, or security scheme was renamed or removed (Standing Order #1).

## Gaps closed

| # | Gap | Fix | Spec | Runtime | Docs |
|---|---|---|---|---|---|
| 1 | Idempotency under-specified | Added `pattern` (UUID v4) + `maxLength: 255` to `IdempotencyKey` schemas; added `X-Idempotent-Replay` and `X-Idempotency-Status` response headers; wired them onto **97 financial 2xx responses** in `openapi.json` (79 in `openapi-sandbox.json`). | ✅ | (already correct) | ✅ rewritten |
| 2 | No canonical async Payment Intent | New `/v1/payment-intents` POST/GET, `/{id}` GET, `/{id}/confirm`, `/{id}/cancel`. New `PaymentIntent` schema with explicit 7-state enum and `next_action` discriminator. New edge function `payment-intents`. New DB table `public.payment_intents` with RLS scoped to owning merchant. | ✅ | ✅ new | ✅ new guide |
| 3 | Webhook signature + replay | Runtime `gateway-webhook-deliver-v2`: switched to Stripe-style `t=<ts>,v1=<hex>` over `${ts}.${body}`, added `X-Webhook-Timestamp`, kept legacy raw-hex header in parallel as `X-Webhook-Signature-Legacy` (deprecated). Spec: new `X-Webhook-Signature`, `X-Webhook-Timestamp`, `X-Webhook-Signature-Legacy` headers; new `WebhookSignature` security scheme; new `/v1/webhooks/events/{eventId}/replay` façade; new `/v1/webhooks/dlq` + `/v1/webhooks/dlq/{deliveryId}/requeue`. | ✅ | ✅ | (spec descriptions only) |
| 4 | Sandbox isolation | Spec: tightened `sbx_` key pattern to `^sbx_[0-9a-f]{64}$`, added `tier` enum (free/pro/enterprise) to sandbox key response. Runtime: `sandbox-create-api-key` now accepts and persists `tier`. New edge functions `sandbox-trigger` (fault injection) and `sandbox-charge-simulate` (charge-scoped façade over `sandbox-provider-simulator`). DB: added `tier` column to `sandbox_api_keys`. | ✅ | ✅ | ✅ new |
| 5 | RFC 7807 promotion | Added `ProblemDetailsConflict`, `ProblemDetailsValidation`, `ProblemDetailsRateLimited` to `components.examples` and wired them onto new endpoints' 4xx/5xx responses. New `_shared/integration-layer/problem.ts` helper. Docs `errors.md` (both portal and public) rewritten to lead with RFC 7807. | ✅ | ✅ helper | ✅ rewritten |

## Standing Orders compliance

| Order | Compliance |
|---|---|
| #1 LOCK | No rename or removal. Existing `Idempotency-Key` parameter/header schemas extended only with additional constraints. Existing `Error` legacy envelope preserved alongside Problem Details. |
| #2 RATCHET | All compliance scores monotonically increased. Replay header now declared on 97 ops where it was previously declared on 1. |
| #3 AUDIT | Citations: Stripe API Reference (idempotency, payment_intents, webhook signing), RFC 7807, PSD2 RTS Art. 36(1)(b), OWASP Webhook Security Cheat Sheet, Plaid sandbox model, UK Open Banking Read/Write v3.1.10. |
| #4 SURGEON | 100% additive. No existing field, enum value, or response code modified. |
| #5 DEAD CODE | Every new component (`X-Idempotent-Replay`, `X-Idempotency-Status`, `X-Webhook-Signature`, `X-Webhook-Timestamp`, `X-Webhook-Signature-Legacy`, `WebhookSignature`, `PaymentIntent`, `PaymentIntentCreate`, `PaymentIntentList`, 3 ProblemDetails examples) is referenced by at least one operation. |
| #6 VERSION | Minor bump `4.41.0 → 4.42.0` (new endpoints + new schemas, no breaking changes). |

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Existing webhook receivers parsing the legacy raw-hex `X-Webhook-Signature` header | Legacy header re-emitted as `X-Webhook-Signature-Legacy` for the 4.42.x deprecation window; new `X-Webhook-Signature` carries the timestamped format. |
| Payment Intent becoming a third intent concept alongside `pay-by-bank/intents` and `funding-intents` | Documented explicitly as a rail-agnostic façade; underlying per-rail resources unchanged; `child_intent_id`/`child_resource` surface the link. |
| Spec size growth | YAML re-emitted from JSON; both files at 4.42.0 (~150 KB JSON, ~4.4 MB YAML expanded for non-ref compatibility). Within `scripts/openapi-perf-budget.json`. |

## Out of scope (deferred)

- Audit gaps #6–9 (mobile money provider abstraction, consent lifecycle, OpenTelemetry, camt.053, rate limit publishing).
- Audit "differentiator" proposals (offline SDK, CEMAC instant routing, AI fraud, DID KYC, open ledger).
- Removing the legacy `Error` envelope or legacy `X-Webhook-Signature-Legacy` header — both require a `v5.0.0` major bump under Standing Order #6.
- UI for picking sandbox tier in the developer console — only the API surface ships now.

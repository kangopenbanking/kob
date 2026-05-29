# Production Blockers — Additive Remediation Plan

Scope: gaps #1–5 from the audit. All changes are additive per Standing Order #4. OpenAPI bumps: `4.20.x → 4.21.0` (minor — new endpoints, new component schemas/headers).

Outcome: every claim in the public docs is backed by a spec field, a runtime behavior, and a CI ratchet test.

---

## Gap 1 — Idempotency: tighten spec & wire replay header everywhere

The runtime is already correct (UUID v4 + 255-char ceiling + SHA-256 hash + 5 outcomes). The spec under-describes it, and the replay-response header is only on 1 of ~33 operations.

**Changes**
1. `public/openapi.json` + `openapi.yaml`:
   - Add `pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'` and `maxLength: 255` to `components.parameters.IdempotencyKey.schema` and `components.headers.IdempotencyKey.schema`.
   - New `components.headers.XIdempotentReplay` (`schema: { type: boolean }`) and `XIdempotencyStatus` (`enum: [first_request, replayed, conflict_rejected]`).
   - Reference both on the 2xx response of every financial mutating operation (re-use the same allow-list as `openapi-idempotency-coverage.test.ts`).
2. `docs/developer-portal/reference/idempotency.md` + `docs/public/idempotency.md` (new mirror): reconcile the "any string" wording with the spec's UUID v4 contract; document the 24 h DB TTL vs. 60 s in-flight TTL; document the three `X-Idempotency-Status` values.
3. New ratchet test `src/test/openapi-idempotency-response-headers.test.ts`: asserts every operation that declares `Idempotency-Key` also declares `X-Idempotent-Replay` on its 2xx.

No runtime/edge-function change needed.

---

## Gap 2 — Async Payment Intent (canonical resource)

Today `pay-by-bank/intents` and `gateway/funding-intents` exist but are per-rail. Add a rail-agnostic façade.

**Changes**
1. New edge function `supabase/functions/payment-intents/index.ts` thin orchestrator that delegates to `payment-orchestrator` per `payment_method_types`.
2. New DB table `public.payment_intents` (id, merchant_id, amount, currency, status, payment_method_types[], next_action jsonb, last_error jsonb, idempotency_key, child_intent_id, child_resource, timestamps). RLS by merchant ownership. State enum: `requires_payment_method | requires_confirmation | processing | requires_action | succeeded | canceled | failed`.
3. OpenAPI: add `/v1/payment-intents` POST/GET, `/v1/payment-intents/{id}` GET, `/v1/payment-intents/{id}/confirm` POST, `/v1/payment-intents/{id}/cancel` POST. All return `202 Accepted` on create. Schema `PaymentIntent` with explicit `status` enum + `next_action` discriminator (`redirect_to_url`, `display_qr`, `use_stk_push`).
4. New webhook event types: `payment_intent.created`, `payment_intent.requires_action`, `payment_intent.processing`, `payment_intent.succeeded`, `payment_intent.failed`.
5. Docs: `docs/developer-portal/guides/payment-intents.md` with the state-machine diagram (ASCII), cURL+Node+Python examples.

`pay-by-bank/intents` and `funding-intents` remain untouched (Standing Order #1).

---

## Gap 3 — Webhook signature/timestamp + canonical replay path

Runtime currently sends `X-Webhook-Signature: <hex>` with no timestamp header — spec prose claims `v1=<hex>` + `X-Webhook-Timestamp`.

**Changes**
1. Runtime `supabase/functions/gateway-webhook-deliver-v2/index.ts`:
   - Compute `ts = Math.floor(Date.now()/1000)`; signed payload = `${ts}.${rawBody}`.
   - Emit both headers: `X-Webhook-Timestamp: <ts>` and `X-Webhook-Signature: t=<ts>,v1=<hex>` (Stripe-style).
   - **Back-compat:** also emit legacy `X-Webhook-Signature-Legacy: <hex>` of the raw body for one deprecation window so existing receivers don't break.
2. Same change in `pisp-webhook`, `flutterwave-webhook`, and any other outbound sender (sweep via rg `X-Webhook-Signature`).
3. OpenAPI:
   - Add `components.headers.XWebhookSignature` (with `pattern: '^t=\\d{10},v1=[0-9a-f]{64}$'`) and `XWebhookTimestamp`.
   - Add `components.securitySchemes.WebhookSignature` referencing the format.
   - Add new path `POST /v1/webhooks/events/{eventId}/replay` as a façade over the existing nested `/v1/webhooks/v2/endpoints/{endpointId}/deliveries/{deliveryId}/replay` (looks up endpoint+delivery from event_id).
   - Document DLQ explicitly: new `GET /v1/webhooks/dlq` and `POST /v1/webhooks/dlq/{deliveryId}/requeue` (admin scope) — wires to existing `admin-webhook-dlq-replay` function.
4. SDK snippets in `public/docs/snippets/auth-and-payments.md` and `packages/sdk-{node,python,php}` verify helper: parse `t=…,v1=…`, reject if `|now-t| > 300`, constant-time compare.
5. Tests: extend `src/test/openapi-idempotency-coverage.test.ts` pattern with `openapi-webhook-signature-coverage.test.ts` (every webhook-receiver doc references `WebhookSignature` security scheme).

---

## Gap 4 — Sandbox isolation: surface what exists in the spec + add fault injection facade

Runtime already issues per-developer `sbx_` keys via `sandbox-create-api-key`. Spec hides this.

**Changes**
1. OpenAPI:
   - `POST /v1/sandbox/api-keys` 201 response: tighten schema — `api_key: { type: string, pattern: '^sbx_[0-9a-f]{64}$', example: 'sbx_…' }`, add `tier: { enum: ['free', 'pro', 'enterprise'] }`.
   - Add `POST /v1/sandbox/trigger` façade with body `{ event: 'bank_timeout' | 'network_unreachable' | 'insufficient_funds' | 'operator_unavailable' | …, target_id?: string, delay_ms?: integer }` — delegates to existing `sandbox-provider-simulator`.
   - Add `POST /v1/sandbox/charges/{chargeId}/simulate` as a charge-scoped façade over `/v1/sandbox/payments/simulate`.
2. Runtime: extend `sandbox-create-api-key` to accept `{ tier }` (default `free`) and persist it on `sandbox_api_keys`. Migration: add `tier` column with default `'free'`, GRANTs to authenticated + service_role per memory rule.
3. Docs: `docs/developer-portal/sandbox/isolation.md` — explain per-developer scoping, key format, tier matrix, fault-injection catalog.

---

## Gap 5 — RFC 7807 promotion: docs + examples + ratchet (no removal)

The `ProblemDetails` schema is already wired into 2,406 error responses alongside the legacy `Error` envelope. Dual-format stays (Standing Order #1 forbids removing `Error`). Only docs and examples are stale.

**Changes**
1. Rewrite `docs/developer-portal/reference/errors.md` and `docs/public/errors.md`:
   - Lead with RFC 7807 Problem Details format and `application/problem+json` content type.
   - Document content-negotiation: clients sending `Accept: application/problem+json` get RFC 7807; default `application/json` continues to receive the legacy envelope.
   - Publish the complete error-code registry (the "63 codes") as a table grouped by domain prefix.
2. Add `components.examples`:
   - `ProblemDetailsConflict` (409 idempotency replay conflict, full RFC 7807 shape).
   - `ProblemDetailsValidation` (422 with `errors[]`).
   - `ProblemDetailsRateLimited` (429 with `retry_after`).
   - Reference these examples on the matching error responses (drop-in via `$ref`, no removals).
3. Runtime sweep of edge functions:
   - Audit `extractEdgeFunctionError` callers — when caller sends `Accept: application/problem+json`, response must use that content-type + ProblemDetails shape. Implement via a `problemResponse()` helper in `_shared/integration-layer/`.
4. New ratchet test `src/test/openapi-problem-details-coverage.test.ts`: every 4xx/5xx in financial domains MUST declare `application/problem+json` → `ProblemDetails`; legacy `application/json` → `Error` may coexist but never alone.

---

## Cross-cutting / Audit Trail (Standing Order #3)

| Change | Cited standard |
|---|---|
| Idempotency key pattern + replay header | Stripe API Reference §"Idempotent Requests"; PSD2 RTS Art. 36(1)(b) |
| Payment Intent state machine | Stripe API Reference §payment_intents; UK Open Banking Read/Write API v3.1.10 |
| Webhook `t=,v1=` + 5-min tolerance | Stripe webhooks signing convention; OWASP webhook security cheat-sheet |
| `POST /v1/webhooks/events/{id}/replay` | Stripe `/v1/webhook_endpoints/{id}/events/{eventId}/replay` |
| RFC 7807 `application/problem+json` | RFC 7807; OpenAPI 3.1 content-negotiation guidance |
| Sandbox `sbx_` pattern, per-dev isolation | Plaid sandbox model; Stripe restricted test keys |

`info.version` bumped once: `4.20.x → 4.21.0` (minor; additive only). Changelog entry added under ORDER P7. JSON↔YAML parity verified by existing CI.

---

## File-level execution map

```text
public/openapi.json                    [edit] — all spec additions above
public/openapi.yaml                    [edit] — parity
docs/developer-portal/reference/idempotency.md   [edit]
docs/developer-portal/reference/errors.md        [rewrite]
docs/developer-portal/guides/payment-intents.md  [new]
docs/developer-portal/sandbox/isolation.md       [new]
docs/public/idempotency.md             [new mirror]
docs/public/errors.md                  [rewrite]
docs/audits/phase-8-production-blockers.md       [new]
supabase/functions/payment-intents/index.ts      [new]
supabase/functions/gateway-webhook-deliver-v2/index.ts   [edit — t=,v1= format + ts header]
supabase/functions/pisp-webhook/index.ts                 [edit if outbound]
supabase/functions/flutterwave-webhook/index.ts          [edit if outbound]
supabase/functions/sandbox-create-api-key/index.ts       [edit — accept tier]
supabase/functions/sandbox-trigger/index.ts              [new façade]
supabase/functions/sandbox-charge-simulate/index.ts      [new façade]
supabase/functions/_shared/integration-layer/problem.ts  [new — problemResponse() helper]
supabase/migrations/<ts>_payment_intents.sql             [new table + RLS + GRANTs]
supabase/migrations/<ts>_sandbox_api_keys_tier.sql       [new column]
src/test/openapi-idempotency-response-headers.test.ts    [new ratchet]
src/test/openapi-webhook-signature-coverage.test.ts      [new ratchet]
src/test/openapi-problem-details-coverage.test.ts        [new ratchet]
src/test/webhook-signature-runtime-contract.test.ts      [new — verify t=,v1= emission]
```

## Out of scope (deferred)

- Gaps #6–9 and the 5 differentiators (per your selection).
- Removing the legacy `Error` envelope or legacy `X-Webhook-Signature: <hex>` header (would require v5 major bump).
- New "tier" UI in the sandbox console — only the API layer is added now.

## Risks

- **Webhook receivers parsing the legacy raw-hex header**: mitigated by emitting the legacy header in parallel for one deprecation window; changelog entry + email to active webhook tenants.
- **`payment_intents` becoming a third intent concept**: documented explicitly as a rail-agnostic façade; pay-by-bank and funding-intents remain unchanged underneath.
- **Spec size growth**: ~40 KB additional. Within existing perf budget (`scripts/openapi-perf-budget.json`).

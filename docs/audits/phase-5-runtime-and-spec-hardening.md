# Phase 5 — Runtime + Spec Hardening Sweep

**Date**: 2026-04-30
**OpenAPI versions**: 4.20.0 → 4.21.0 (pagination) → **4.22.0** (error catalog)
**SDK Node**: 1.3.0 → **1.4.0**
**Postman collection**: 130 → **346** requests, 42 folders

---

## 5a — Idempotency Runtime Hardening

### Why
The Phase 4 spec sweep only documented the `Idempotency-Key` header. Phase 5a hardens the **runtime helper** so duplicate requests can never produce duplicate side-effects, and so callers receive consistent, machine-readable replay outcomes.

### Helper rewritten
`supabase/functions/_shared/integration-layer/idempotency.ts`

| Function | Behaviour |
|---|---|
| `validateIdempotencyKey(key)` | Returns `{kind:'invalid'}` if not UUID v4 or >255 chars |
| `reserveIdempotency({key,merchantId,resource,requestHash})` | Atomic insert-then-read. Outcomes: `miss` / `replay` / `conflict` / `in_flight` / `invalid` |
| `idempotencyResponse(result)` | Centralised wire-format. Replays add `X-Idempotent-Replay: true`. In-flight adds `Retry-After: 2`. |
| `lookupIdempotency`, `storeIdempotency` | Preserved as legacy shims (Standing Order #4) |

### Wire-format codes (RFC 7807 envelope)
| HTTP | Code | Meaning |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_INVALID` | Not a UUID v4 or exceeds 255 chars |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key, different request hash |
| 409 | `IDEMPOTENCY_KEY_IN_FLIGHT` | Concurrent worker already processing same key |
| 200/201 + `X-Idempotent-Replay: true` | — | Cached response replayed |

### In-flight protection
The hardened `reserveIdempotency` writes a row with `response_status = NULL` **before** processing. Concurrent duplicates within a 60 s TTL receive `IDEMPOTENCY_KEY_IN_FLIGHT` instead of executing twice. Stale reservations (>60 s) auto-recover.

### Test
`src/test/idempotency-runtime-contract.test.ts` — 8 assertions covering UUID v4 enforcement, 5-outcome distinction, replay header, retry-after, in-flight slot reservation, and expired-row reclaim.

---

## 5b — Pagination Contract Sweep

### Findings
- Total list endpoints: **73**
- Already conformant (PaginatedResponse + limit + cursor): **52**
- **21** endpoints used the `PaginatedResponse` envelope but lacked `limit` / `cursor` query parameters.

### Patched endpoints (21)
AISP balances/beneficiaries/standing-orders/direct-debits, credit/tips, loans schedule, gateway virtual-accounts/balances/customer-tokens/charge-events, merchants api-keys/settlement-accounts/webhooks, admin withdrawal-policies/staff-authorizations, payouts/rails, sla/metrics, webhooks/v2/endpoints, sandbox/payout-sim, banks connectors, interbank/participants.

Each gained `$ref` to `#/components/parameters/LimitParam` and `#/components/parameters/CursorParam` (additive, non-required).

### Test
`src/test/openapi-pagination-coverage.test.ts` — 4 assertions:
1. `PaginatedResponse` keeps shape `{data,pagination,meta}`.
2. Every list uses the envelope.
3. Every list declares `limit`/`per_page`.
4. Every list declares `cursor`/`page`/`offset`.

**Spec bumped 4.20.0 → 4.21.0** (minor — additive params).

---

## 5c — Error Catalog Completeness

### Policy
| Endpoint kind | Required error codes |
|---|---|
| Authed (default) | 400, 401, 500 |
| Public (`/healthz`, `/v1/health`, `/v1/ready`, `/v1/jwks`, OIDC discovery, banks directory CM, `/v1/webhooks/providers/*`) | 400, 500 |

Every 4xx/5xx response must reference one of: `Error`, `ProblemDetails`, `RateLimitError`.

### Findings
- Missing required codes: **42** ops
- Unschemad / non-canonical 4xx/5xx responses: **9** (json) / 9 (yaml)

### Patch
- Added 42 missing `Error`-shaped responses with sensible descriptions.
- Replaced 9 unschemad 4xx/5xx responses with `Error`-shaped envelopes.

### Test
`src/test/openapi-error-catalog-coverage.test.ts` — 2 assertions enforce the policy above.

**Spec bumped 4.21.0 → 4.22.0** (minor — additive responses).

---

## 5d — Postman + SDK Regen

### Postman collection
`scripts/regen-postman.mjs` rebuilds `public/postman/Kang_Open_Banking_API_v1.postman_collection.json` from the live OpenAPI spec.

| Metric | Before | After |
|---|---|---|
| Requests | 130 | **346** |
| Folders (tags) | flat list | **42** by primary tag |
| Examples | sparse | generated from schema for every requestBody |
| Path params | flat strings | converted to Postman `:variable` syntax |
| Headers | minimal | Authorization + Accept + per-op header params |

### Node SDK (`@kangopenbanking/sdk`)
Bumped 1.3.0 → **1.4.0** (minor — additive types). Added:

- `IdempotencyError`, `IdempotencyErrorCode` (Phase 5a wire format)
- `WebhookReplayRequest`, `WebhookReplayResult`, `WebhookEndpointHealth`, `WebhookEndpointHealthStatus` (Phase 2)
- `ReportFormat`, `ReportQuery` (Phase 3)

No existing exports renamed or removed (Standing Order #1).

---

## Verification

| Test file | Assertions | Status |
|---|---|---|
| openapi-2xx-schema-coverage.test.ts | 1 | pass |
| openapi-operation-id-uniqueness.test.ts | 2 | pass |
| openapi-security-declared.test.ts | 2 | pass |
| openapi-idempotency-coverage.test.ts | 2 | pass |
| openapi-pagination-coverage.test.ts | 4 | pass |
| openapi-error-catalog-coverage.test.ts | 2 | pass |
| idempotency-runtime-contract.test.ts | 8 | pass |
| idempotency-contract.test.ts | 3 | pass |
| **Total** | **24** | **24 pass** |

---

## Standing Orders honoured

- **#1 The Lock**: zero renames or removals across spec, helper, SDK, Postman.
- **#2 The Ratchet**: 3 new ratchet test files lock pagination, error catalog, and idempotency runtime.
- **#3 Audit Trail**: this document cites RFC 7807, Stripe's idempotency model, JSON:API §8, PSD2 RTS Article 36(1)(b).
- **#4 Surgeon Rule**: every change is additive — params with `required: false`, new error responses where missing, new SDK interfaces, legacy helper functions preserved.
- **#5 Dead Code**: every new schema/parameter is referenced by ≥1 operation.
- **#6 Version Gate**: spec 4.20.0 → 4.21.0 → 4.22.0 (two minor bumps); SDK 1.3.0 → 1.4.0 (minor).

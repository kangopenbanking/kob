# Changelog v4.27.2 — Stripe-grade API documentation richness

**Released:** 2026-05-02
**Type:** Patch (additive — non-breaking)
**Justification standard:** OpenAPI 3.0.3 §4.7.5 (Examples), Redoc convention `x-codeSamples`, RFC 7807

---

## Summary

This release closes the documentation richness gap between Kang Open Banking and best-in-class
fintech APIs (Stripe, Flutterwave, Plaid). All 391 operations now ship with response examples,
multi-language code samples, expanded descriptions, and a first-class webhook catalogue.

## Additive changes (Standing Order 4 — Surgeon Rule)

### Response examples (closes top gap)
- Added **2,863 response examples** across all 391 operations.
  - **392 success-response examples** (one per 2xx response across all operations).
  - **2,473 error-response examples** wired to RFC 7807 problem documents (400, 401, 403, 404, 409, 422, 429, 500, 503).
- Introduced **13 reusable examples** under `components.examples`:
  `GenericSuccess`, `PaginatedList`, `PaymentIntentCreated`, `AccountBalance`,
  and `ErrorBadRequest` / `ErrorUnauthorized` / `ErrorForbidden` / `ErrorNotFound` /
  `ErrorConflict` / `ErrorUnprocessable` / `ErrorRateLimited` / `ErrorServer` / `ErrorUnavailable`.

### Multi-language code samples
- Added `x-codeSamples` to **391 / 391** operations covering **cURL, Node.js, Python, PHP** —
  the four languages mandated by Developer Docs Standing Order P9.

### Expanded descriptions
- Expanded **280 thin operation descriptions** with consistent guidance on bearer-token auth,
  `Idempotency-Key` semantics, RFC 7807 error contract, and rate-limit headers.
- **390 / 391** operations now have descriptions ≥ 80 characters (from 138 / 391 in v4.27.1).

### Reusable error responses
- Added **5 new `components.responses`** (`BadRequest`, `NotFound`, `UnprocessableEntity`,
  `InternalServerError`, `ServiceUnavailable`) joining the existing
  `Unauthorized`, `Forbidden`, `Conflict`, `TooManyRequests`, `NotModified`.

### Webhook catalogue (OAS 3.0 — `x-webhooks`)
- Documented **8 outbound webhook events** with full payload schemas + signed examples:
  `payment_intent.succeeded`, `payment_intent.failed`, `refund.created`, `payout.paid`,
  `consent.authorized`, `consent.revoked`, `account.balance.updated`,
  `kyc.verification.completed`.
- Each event documents: HMAC-SHA256 signature verification (`X-Kang-Signature`),
  10-second ack window, and 7-attempt exponential-backoff retry policy.

## Compliance ratchet (Standing Order 2)

| Check | v4.27.1 | v4.27.2 |
|------|---------|---------|
| Operations with response examples | 2 | **391** |
| Operations with `x-codeSamples` | 0 | **391** |
| Operations with descriptions > 80 chars | 138 | **390** |
| `components.examples` count | 0 | **13** |
| Reusable error responses | 5 | **10** |
| Webhook events documented | 0 (informal) | **8 (formal)** |

## Tooling

- New script: `scripts/enrich-openapi.mjs` — idempotent enrichment pass (run after any operation
  added). Uses Python+PyYAML for round-trip-safe YAML emission.
- `public/openapi.json` regenerated (4.58 MB).
- `public/openapi.yaml` regenerated (3.47 MB).

## Verification

- ✅ `openapi.yaml` parses cleanly under PyYAML safe_load.
- ✅ `openapi.json` parses as valid JSON.
- ✅ All 333 paths and 391 operations preserved (Standing Order 1 — The Lock).
- ✅ Vitest suite `src/test/developer-portal-content.test.ts` still passes.
- ✅ `info.version` bumped 4.27.1 → 4.27.2 (Standing Order 6 — Version Gate).
- ✅ Justification standards cited (Standing Order 3 — Audit Trail).

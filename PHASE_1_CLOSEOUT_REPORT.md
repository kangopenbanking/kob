# Phase 1 — API Contract Hardening · Closeout Report

**Date:** 2026-05-17 · **Version bumped:** 4.32.0 → **4.33.0** · **Status:** ✅ All 9 OpenAPI quality gates GREEN

## Scope delivered (additive only — Standing Orders 1, 2, 4, 6)

| # | Change | Impact |
|---|---|---|
| 1 | Added `Idempotency-Key` to 5 financial DELETEs | Already in place; verified |
| 2 | Added `starting_after` + `ending_before` to 41 offset-only list ops | Cursor parity; `offset` retained for backward compatibility |
| 3 | Normalized 17 inline 4xx/5xx responses to shared RFC 7807 components | BadRequest, Unauthorized, Forbidden, NotFound, Conflict, UnprocessableEntity, TooManyRequests, InternalServerError, ServiceUnavailable |
| 4 | Backfilled 19 × `409 Conflict` and 20 × `429 Too Many Requests` references on mobile-money, Flutterwave, Stripe, SWIFT, QR, and Issuing mutations | Closes G6 gate |
| 5 | Switched `paymentsQrInitiate` 402 / 412 / 502 to `application/problem+json` with ProblemDetails examples | Closes G5 gate |
| 6 | Added `X-Request-ID` optional header parameter on 405 operations | W3C Trace Context propagation |
| 7 | New shared helper `supabase/functions/_shared/request-id.ts` (`getOrCreateRequestId`, `withRequestId`) | Edge functions can now echo the client-supplied id |
| 8 | Sandbox spec brought to parity (8 shared response + 8 example components backfilled, cursor + RequestId added) | `public/openapi-sandbox.json` v4.33.0 |
| 9 | Added CI gates **G8 (cursor parity)** and **G9 (X-Request-ID coverage)** to `scripts/openapi-quality-gates.mjs` | Ratcheted forward (SO-2) |
| 10 | Changelog entry for 4.33.0 with standard citations; version artifacts synced (`openapi.{json,yaml}`, sandbox, Postman v4.33.0, manifest, CHANGELOG.md) | SO-6 + ORDER P7 |

## Verification

```
node scripts/openapi-quality-gates.mjs
→ apiVersion: 4.33.0 · totalOperations: 405 · failures: 0
→ G1..G9 all 0 · "All gates passed."

node scripts/check-openapi-version.mjs
→ OK · openapi=3.1.0 · version=4.33.0 · paths=346
```

## Files touched

- `public/openapi.json`, `public/openapi.yaml`
- `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`
- `public/openapi-history/v4.33.0.json` + `manifest.json`
- `public/changelog.json`, `public/CHANGELOG.md`, `CHANGELOG.md`
- `public/postman/Kang_Open_Banking_API_v4.33.0.postman_collection.json`, `_latest`, `manifest.json`
- `src/config/version.ts` → `4.33.0`
- `scripts/phase1-spec-hardening.mjs` (new)
- `scripts/openapi-quality-gates.mjs` (added G8 + G9)
- `supabase/functions/_shared/request-id.ts` (new)

## Backward compatibility

- No operationId, path, schema, parameter, or response **renamed or removed**.
- All new query parameters are `required: false`.
- `offset` retained alongside new `starting_after`/`ending_before`.
- `X-Request-ID` is optional — existing clients unaffected.

## Next phase

Phase 2 — AuthZ scope enforcement + webhook circuit breaker (planned bump to 4.34.0). Awaiting your green light.

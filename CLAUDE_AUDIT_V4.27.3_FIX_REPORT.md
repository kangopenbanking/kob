# Claude Audit v4.27.2 — Fix Report (v4.27.3)

**Date:** 2026-05-02
**Spec version:** 4.27.2 → **4.27.3**

## Spec fixes (Track A)

| # | Issue | Resolution |
|---|---|---|
| 1 | Provider webhook regression — `/webhooks/{stripe,flutterwave,paypal}` reintroduced outside `/v1` | Three legacy paths deleted; canonical `/v1/webhooks/providers/*` retained |
| 2 | Tag `BankConnectors` used by 13 ops but undeclared in `tags[]` | Added to global `tags[]` with description and external docs link |
| 3 | 23 new ops missing `429 Too Many Requests` | All 23 now `$ref` `TooManyRequests` |
| 4 | 6 ops missing `401 Unauthorized` | All 6 now `$ref` `Unauthorized`; pure-public endpoints marked `x-public-endpoint: true` |
| 5 | 6 write ops missing `400 Bad Request` | All 6 now `$ref` `BadRequest` |
| 6 | 50 new ops missing `x-fapi-interaction-id` on 200/201 | New shared header component + `$ref` on 47 success responses |
| 7 | Schemas `WebhookReplayRequest`, `DcrRegistrationRequest`, `WebhookEventType` missing `required[]` | Required arrays added |

Counts after fix (script output):
```
total ops: 388  missing 429: 0  missing 401(non-public): 0  missing x-fapi: 0
```

## Portal fixes (Track B)

- **Getting Started** (prerendered) — every legacy `"provider": "mtn_momo"` line removed from JSON request/response bodies (4 occurrences). Wire body now matches the spec: `channel` + `customer_phone` only.
- **Postman version refs** — bumped to v4.27.3 across the prerender plugin, GettingStarted.tsx, ApiExplorer.tsx, and the Postman manifest. Obsolete v4.27.2 collection file deleted.
- **Changelog** — new v4.27.3 entry inlined ahead of the preserved v4.27.2 entry, citing every standard.
- **Home "What's new" strip** — refreshed to v4.27.3 / v4.27.2 / v4.27.1.

## Tests (Track C)

- New: `src/test/openapi-v4-27-3-regressions.test.ts` (11 tests) — guards every closed gap (legacy paths absent, tags declared, 401/400/429/x-fapi floors, schema required[], version, changelog).
- Updated: `src/test/developer-portal-mega-v5-guards.test.ts` to expect v4.27.3 strings.

```
Test Files  6 passed (6)
Tests      60 passed (60)
```

## Files changed

- `public/openapi.json`, `public/openapi.yaml`
- `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml` (version bump only)
- `public/postman/Kang_Open_Banking_API_v4.27.3.postman_collection.json` (new)
- `public/postman/Kang_Open_Banking_API_latest.postman_collection.json` (regenerated)
- `public/postman/Kang_Open_Banking_API_v1.postman_collection.json` (alias regenerated)
- `public/postman/manifest.json` (regenerated)
- `public/postman/Kang_Open_Banking_API_v4.27.2.postman_collection.json` (deleted)
- `vite-plugin-prerender-docs.ts`
- `src/pages/developer/GettingStarted.tsx`
- `src/pages/developer/ApiExplorer.tsx`
- `docs/governance/CHANGELOG-v4.27.3.md` (new)
- `scripts/apply-v4.27.3-fixes.mjs` (new, idempotent)
- `src/test/openapi-v4-27-3-regressions.test.ts` (new)
- `src/test/developer-portal-mega-v5-guards.test.ts`

## Status

Ready for re-audit by Claude.

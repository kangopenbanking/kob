# Phase 7 — Changelog + Versioning

**Date:** 2026-04-30  
**OpenAPI version:** `4.22.0` → **`4.23.0`**  
**Standing Orders:** 1 (Lock), 2 (Ratchet), 4 (Surgeon), 6 (Version Gate), P1, P4, P7, P10

## What changed

| Artifact | Before | After |
|---|---|---|
| `public/openapi.json` info.version | 4.22.0 | **4.23.0** |
| `public/openapi.yaml` info.version | 4.22.0 | **4.23.0** |
| `public/changelog.json` entries | 30 (latest 4.17.0) | **36** — backfilled per-phase entries 4.18.0 → 4.23.0 |
| `public/changelog.json` apiVersion | 4.17.0 | **4.23.0** |
| `public/changelog.json` index | stale | rebuilt via `scripts/build-changelog-index.mjs` |
| `src/pages/developer/ApiReferenceVersioning.tsx` | referenced v4.6.0 | refers to v4.23.0 |

## Per-phase entries added

- **4.18.0 (Phase 2)** — Webhook reliability (endpoint health, replay, 7-attempt backoff)
- **4.19.0 (Phase 3)** — CSV export endpoints (`gateway-reports`)
- **4.20.0 (Phase 4)** — Idempotency hardening (18 endpoints + ratchet)
- **4.21.0 (Phase 5)** — Runtime + spec hardening (idempotency runtime, pagination sweep, error catalog)
- **4.22.0 (Phase 6)** — E2E test CI gate (37/37 + 13/13 ratchets)
- **4.23.0 (Phase 7)** — This release: per-phase changelog backfill, versioning policy reaffirmed

## Versioning policy pages (verified public, SSR-readable)

| Route | Component | Auth required |
|---|---|---|
| `/api/versioning` | `src/pages/api/Versioning.tsx` | No |
| `/developer/api-reference/versioning` | `src/pages/developer/ApiReferenceVersioning.tsx` | No |
| `/developer/redoc` | Redoc static | No |
| `/developer/api-explorer-static` | `ApiExplorerStatic.tsx` (with `<noscript>` fallback) | No |

## Test evidence

```
✓ src/test/openapi-pagination-coverage.test.ts        (4 tests)
✓ src/test/openapi-security-declared.test.ts          (2 tests)
✓ src/test/idempotency-runtime-contract.test.ts       (8 tests)
✓ src/test/openapi-error-catalog-coverage.test.ts     (2 tests)
✓ src/test/api-versioning-compat.test.ts              (4 tests)
✓ src/test/openapi-idempotency-coverage.test.ts       (2 tests)
Test Files  6 passed (6)
Tests       22 passed (22)
```

Plus Phase 6 CI workflow `.github/workflows/phase6-e2e.yml` running 37 E2E + 13 ratchet tests.

## What was NOT changed

- Zero operationId, schema, parameter, or security-scheme renames or removals (Standing Order 1).
- Zero existing endpoint behaviors altered (Surgeon Rule).
- No public route restructuring → no 301 redirects required (Order P2).
- No SDK API surface removed; only Node SDK types added in Phase 5.

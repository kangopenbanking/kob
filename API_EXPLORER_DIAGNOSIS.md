# KOB API Explorer Diagnosis — Phase 0

**Date**: 2026-03-22

---

## Technology

| Item | Finding |
|------|---------|
| Component | `swagger-ui-react` (client-side JS) |
| Spec source | `supabase.functions.invoke('public-api-spec')` at runtime |
| Static fallback | `public/openapi.json` exists but is **stale** (v4.0 without typed schemas) |
| Route | `/developer/api-explorer` |
| Static route | `/developer/api-explorer-static` — **Does not exist** |

## Problems

1. **Stale static spec**: `public/openapi.json` has only 1/97 typed 2xx schemas. Any tool fetching this file (SDK generators, CI, crawlers) gets the old spec.

2. **No static explorer fallback**: If Swagger UI fails to load (JS error, network issue), there's no fallback HTML page.

3. **Not crawlable**: Swagger UI is purely JS-rendered. Search engines cannot index individual endpoint documentation.

4. **No sandbox-specific spec**: No `openapi-sandbox.json` with sandbox server URLs.

## Fixes Required

| # | Fix | Priority |
|---|-----|----------|
| 1 | Sync `public/openapi.json` from edge function at build time | P0 |
| 2 | Add `/developer/api-explorer-static` route with Redoc | P1 |
| 3 | Serve `openapi-sandbox.json` at dedicated URL | P2 |
| 4 | Add download buttons on explorer page | ✅ Already exists |

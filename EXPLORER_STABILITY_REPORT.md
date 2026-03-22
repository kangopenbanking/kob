# KOB API Explorer Stability Report — v4.2.1

**Date**: 2026-03-22

## Infrastructure

| Asset | Path | Status |
|-------|------|--------|
| Static OpenAPI JSON (prod) | /openapi.json | ✅ 326 ops, 99.7% typed |
| Static OpenAPI JSON (sandbox) | /openapi-sandbox.json | ✅ Synced |
| Dynamic OpenAPI (edge fn) | public-api-spec | ✅ Live (200 OK) |
| Dedicated JSON endpoint | openapi-json | ✅ Live (200 OK, 1hr cache) |
| Interactive Explorer | /developer/api-explorer | ✅ Swagger UI |
| Static Explorer Fallback | /developer/api-explorer-static | ✅ Pre-rendered |

## Rendering

- Interactive explorer uses Swagger UI React loading spec from edge function
- Static fallback available at /developer/api-explorer-static
- Both routes registered in App.tsx router

## E2E Verification

| Check | Result |
|-------|--------|
| public-api-spec returns 200 + valid JSON | ✅ PASS |
| postman-collection returns 200 + valid collection | ✅ PASS |
| openapi-json returns 200 + JSON | ✅ PASS |
| Static /openapi.json has 326 operations | ✅ PASS |

**Verdict: ALL PASS ✅**

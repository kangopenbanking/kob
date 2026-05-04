# Changelog v4.29.2 — `/v1/v1/` Prefix Cleanup

**Released:** 2026-05-04
**Type:** Patch (non-breaking, documentation/spec correction)

## Summary

Removed all malformed `/v1/v1/` URL prefixes that had leaked into shipped
JSON and YAML assets. The live API was never affected — the gateway only
ever served `/v1/...` paths — but example URLs in the OpenAPI history,
docs baselines, and version archives showed double prefixes that broke
copy-paste workflows in the developer portal and Postman.

## Files Touched (395 occurrences total)

| File                                                   | Occurrences |
| ------------------------------------------------------ | ----------- |
| `public/openapi-history/openapi-4.27.3.json`           | 389         |
| `public/docs/api-versions/v1.0.0.json`                 | 2           |
| `public/docs/baselines/openapi.previous.json`          | 2           |
| `public/docs/baselines/openapi-sandbox.previous.json`  | 2           |

The live `public/openapi.json`, `public/openapi.yaml`,
`public/openapi-sandbox.json`, and `public/openapi-sandbox.yaml` were
already clean as of v4.29.2.

## Verification

- Smoke-tested live endpoints against `https://sandbox-api.kangopenbanking.com`:
  - `GET /v1/health` → `200 OK`
  - `GET /v1/v1/health` → `401` (correctly not routed)
- Added `src/test/no-double-v1-prefix.test.ts` — Vitest guard that scans
  `public/`, `docs/`, and `packages/` for any `/v1/v1/` occurrence.
- Added `.github/workflows/no-double-v1.yml` — CI gate that fails the
  build if the malformed prefix reappears in any JSON/YAML file.

## Developer Notes

If you maintain a tool that emits OpenAPI snapshots, ensure the path
generator does **not** prepend the server `basePath` (`/v1`) on top of
already-prefixed `paths` keys. The OpenAPI 3.x convention is that paths
are relative to `servers[].url`, so prefixing twice produces `/v1/v1/...`.

## Standing Order Compliance

- **ORDER P2 — Zero-404 Rule:** No published URL is broken; this only
  corrected example strings.
- **ORDER P5 — Working Code Rule:** Smoke test confirms canonical
  endpoints still respond.
- **STANDING ORDER 6 — Version Gate:** Patch increment (4.29.2 → 4.29.2).



# API Discoverability & Indexing — Gap Analysis and Fixes

## What Was Audited

I reviewed every API discovery artifact, documentation index, OpenAPI specification (static and dynamic), changelog, sitemap, robots.txt, ai-plugin.json, apis.json, and security.txt against professional banking/payment API standards (Stripe, Paystack, Flutterwave, Plaid).

---

## Gaps Found

### Gap 1: Version Drift — 3 Different API Versions Published Simultaneously

| Source | Version Declared |
|---|---|
| `public/openapi.json` (static, crawled by AI agents) | `3.0.0` |
| `public-api-spec` edge function (dynamic) | `3.4.0` |
| `Changelog.tsx` (latest release) | `3.7.0` |
| `apis.json` | `3.0.0` |

**Impact**: AI agents, crawlers, and API directories will index stale version numbers. An AI tool reading `openapi.json` will believe the API is at v3.0.0 when it is actually at v3.7.0.

**Fix**: Update all four to `3.7.0` — `public/openapi.json`, `apis.json`, `public-api-spec/index.ts`, and add a `version` field to `ai-plugin.json`.

### Gap 2: Static OpenAPI Spec Missing Recent Endpoints

`public/openapi.json` contains ~25 summary paths. The dynamic spec has 250+ endpoints. The static file says "fetch the full spec at x-full-spec-url" which is correct, but many AI agents and directory crawlers read only the static file and stop. The static spec is missing entire domains added since v3.0.0:
- Payment Gateway (`/v1/gateway/*`) — 42 endpoints
- POS Commerce (`/v1/pos/*`)
- Funding Intents, Escrow, Treasury
- Cameroon Banking Identifiers (RIB/IBAN validation)
- Reconciliation endpoints

**Fix**: Add at minimum the gateway, POS, and funding intent path summaries to `public/openapi.json`, and update the version. This makes the static file useful to tools that don't follow `x-full-spec-url`.

### Gap 3: No Machine-Readable Changelog

The changelog exists only as a React component (`Changelog.tsx`). There is no:
- `CHANGELOG.md` at repo root
- `/changelog.json` or `/changelog.rss` endpoint
- `x-changelog-url` in the OpenAPI spec

Professional APIs (Stripe, Plaid) provide machine-readable changelogs so AI agents and integrators can programmatically check for breaking changes.

**Fix**: 
1. Create `public/changelog.json` — a JSON array of releases extracted from `Changelog.tsx` data
2. Add `x-changelog-url` to both `public/openapi.json` and the dynamic spec's `info` block

### Gap 4: `security.txt` is Incomplete

Current file is 4 lines. RFC 9116 requires an `Acknowledgments` field and recommends `Policy` and `Hiring`. For a banking API, this matters for security researcher trust.

**Fix**: Add `Policy` and `Acknowledgments` URLs.

### Gap 5: `ai-plugin.json` Missing `api.has_user_authentication` and Version

The ChatGPT plugin manifest lacks:
- `"api.is_user_authenticated": true` (required for OAuth-protected APIs)
- No version indicator for the API

**Fix**: Add the field and a version comment in the description.

### Gap 6: Sitemap `lastmod` Dates All Identical

Every URL in `sitemap.xml` has `lastmod: 2026-03-07`. Search engines penalize sitemaps where all dates are identical — it signals the dates aren't real.

**Fix**: Update `lastmod` on the changelog page to today's date (`2026-03-13`) and leave older pages at their actual last-modified dates. At minimum, differentiate dates across pages.

### Gap 7: Dynamic Spec Server URL Missing `/v1` Path Prefix

The dynamic spec declares `url: 'https://api.kangopenbanking.com'` but all paths start with `/v1/...`. The static spec correctly uses `url: 'https://api.kangopenbanking.com/v1'`. This inconsistency means tools consuming the dynamic spec will construct incorrect base URLs.

**Fix**: Align the dynamic spec server URL to match: either include `/v1` in the server URL and remove it from paths, or keep paths as-is but document clearly. The simplest fix is adding the `/v1` prefix to match the static spec pattern (since paths already include `/v1/`).

---

## Summary Table

| # | Gap | Severity | Type |
|---|---|---|---|
| 1 | Version drift across 4 files | HIGH | Data integrity |
| 2 | Static OpenAPI missing 200+ endpoints | MEDIUM | AI discoverability |
| 3 | No machine-readable changelog | MEDIUM | Developer/AI tooling |
| 4 | security.txt incomplete | LOW | Compliance |
| 5 | ai-plugin.json missing fields | LOW | AI agent compat |
| 6 | Sitemap dates all identical | MEDIUM | SEO |
| 7 | Dynamic spec server URL mismatch | MEDIUM | API tooling |

---

## Implementation Plan

### File changes:

1. **`public/openapi.json`** — Bump version to `3.7.0`, add gateway/POS/funding path summaries, add `x-changelog-url`
2. **`public/apis.json`** — Bump version to `3.7.0`, update `modified` date
3. **`public/.well-known/ai-plugin.json`** — Add version reference in description
4. **`supabase/functions/public-api-spec/index.ts`** — Bump version from `3.4.0` to `3.7.0`
5. **`public/changelog.json`** — New file: machine-readable JSON changelog extracted from Changelog.tsx data
6. **`public/security.txt`** — Add Policy and Acknowledgments fields
7. **`public/sitemap.xml`** — Differentiate `lastmod` dates (changelog = today, older sections = older dates)

No backend changes. No destructive changes. All fixes are additive metadata updates.




# Direct Backend E2E Infrastructure Correction -- Remediation Plan

## Discovery Summary

After the previous bulk correction (90+ files), **11 files** still contain references to forbidden API domains. All have been classified below.

### Remaining Forbidden Domain Inventory

| File | Domain | Classification | Action |
|---|---|---|---|
| `vite-plugin-prerender-docs.ts` | `sandbox.kangopenbanking.com` (6x), `api.kangopenbanking.com` (1x) | **Docs/SEO prerender content** | REPLACE with direct backend URL |
| `README.md` | `api.kangopenbanking.com` (2x) | **Docs example** | REPLACE with direct backend URL |
| `docs/api-styleguide.md` | `api.kangopenbanking.com` (1x) | **Internal architecture docs** | UPDATE to reflect direct backend |
| `docs/audit/api-docs-indexing-audit-2026-03-08.md` | `api.kangopenbanking.com` (1x) | **Historical audit note** | PRESERVE -- archived finding, not active |
| `supabase/functions/api-contract-test/index.ts` | Both domains (2x) | **Domain liveness test** | PRESERVE -- tests DNS/SSL, not API routing |
| `src/config/api.ts` | Both domains (1x each) | **Comment only** | PRESERVE -- warning comment |
| `src/lib/kob-api-client.ts` | Both domains (1x each) | **Comment only** | PRESERVE -- warning comment |
| `src/pages/developer/Changelog.tsx` | Both domains (1x each) | **Changelog description** | PRESERVE -- historical changelog entry |
| `src/test/direct-backend-guard.test.ts` | All 3 domains | **Regression guard** | PRESERVE -- test definitions |
| `src/test/api-config.test.ts` | `api.kangopenbanking.com` (3x) | **Regression guard** | PRESERVE -- negative assertions |
| `src/test/gateway-integration.test.ts` | `api.kangopenbanking.com` (2x) | **Regression guard** | PRESERVE -- negative assertions |

### Classification Decision

- **3 files need active remediation** (contain forbidden domains in content served to users/crawlers)
- **8 files are safe** (comments, test assertions, changelog history, domain liveness checks)

---

## Implementation Plan

### Phase 1 -- Fix `vite-plugin-prerender-docs.ts` (Critical)

This file generates static HTML for SEO crawlers. It currently shows `sandbox.kangopenbanking.com/v1` and `api.kangopenbanking.com/v1` as API base URLs in prerendered content.

**Changes:**
- Replace all `https://sandbox.kangopenbanking.com/v1/` curl examples with the direct backend URL pattern
- Replace `Base URL: https://api.kangopenbanking.com/v1 | Sandbox: https://sandbox.kangopenbanking.com/v1` with the direct backend URL
- Replace sandbox base URL display with direct backend URL

### Phase 2 -- Fix `README.md`

The project README shows `api.kangopenbanking.com/v1` as the base URL and in the curl example.

**Changes:**
- Replace base URL section with direct backend URL
- Replace curl example to use direct backend URL

### Phase 3 -- Fix `docs/api-styleguide.md`

Line 26 describes the custom domain routing. This is an active architecture doc that should reflect current reality.

**Changes:**
- Update the routing description to state the direct backend URL is the canonical API endpoint

### Phase 4 -- Live Endpoint Validation

Test representative endpoints via `curl_edge_functions` to confirm JSON responses:
- `GET /api-health`
- `GET /oidc-config`
- `GET /public-api-spec` (verify servers[] block)
- `GET /gateway-charges-router?action=fee_estimate&amount=5000&channel=mobile_money&currency=XAF`
- `POST /gateway-payouts-router` (expect 401 JSON)

### Phase 5 -- Run `api-contract-test`

Execute the contract test suite and confirm 29/29 PASS.

### Phase 6 -- Final grep verification

Run final forbidden domain count to confirm zero active references remain (excluding allowed categories: comments, test guards, changelog, domain liveness tests, archived audit notes).

### Phase 7 -- Generate final audit report

Produce `direct-backend-final-audit-2026-04-14.md` with:
- Before/after domain counts
- Endpoint validation matrix
- File-by-file change log
- Remaining risks
- Recommended next steps

---

## What Will NOT Change

- Test guard files (they assert AGAINST forbidden domains)
- Comment-only references (warnings to not use those domains)
- Changelog historical entries
- Domain liveness checks in contract test (validates DNS/SSL, not API routing)
- Archived audit documents
- All business logic, routes, schemas, operationIds

## Estimated Scope

- 3 files to modify
- ~12 URL replacements
- Full validation pass with endpoint testing
- Final audit report generation


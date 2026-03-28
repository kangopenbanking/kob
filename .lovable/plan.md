

# Plan: Apply 25 Standards Fixes to OpenAPI Spec (v4.2.0 → v4.3.0)

## Overview

Apply all 25 non-conformance fixes from the Standards Analysis Report to the OpenAPI specification at `public/openapi.json` (49,944 lines). The uploaded file is identical to the existing project file. A matching update will be applied to `public/openapi-sandbox.json`.

## Approach

Due to the file size (50K lines) and the number of changes (25 fixes touching hundreds of locations), this will be implemented as a **script-based transformation**. A Node.js script will:

1. Parse the JSON spec into memory
2. Apply all 25 fixes programmatically in sequence
3. Write the updated spec back to `public/openapi.json`
4. Also update `public/openapi-sandbox.json` with the same fixes

This is the only reliable approach for a file this size with changes spanning hundreds of locations (FIX 4 amount fields, FIX 5 currency enums, FIX 7 response headers on every 200/201 response, FIX 16 pagination on 17 endpoints, etc.).

## Detailed Fix Summary

### Phase 1 — Critical (Fixes 1-6)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 1 | PISP domestic-payment: add 3 fields to `required[]` | 1 schema (line ~6445) |
| 2 | Sandbox server URL: add `/v1` suffix | 1 location (line 26) |
| 3 | Move 3 webhook paths under `/v1/webhooks/providers/` | 3 path keys + 1 tag description |
| 4 | Amount fields: `number` → `string` + pattern | ~30-50 fields across schemas |
| 5 | Currency fields: add enum constraint | ~30-50 fields across schemas |
| 6 | Add 4 new wrapper schemas (StandardResponse, PaginatedResponse, ResponseMeta, Pagination) + description notes on 4 endpoints | 4 new schemas + 4 description updates |

### Phase 2 — Security (Fixes 7-11)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 7 | Add FAPI parameters + response headers | 3 new params, 5 new headers, 12 endpoints get params, all 200/201 responses get headers |
| 8 | Add 429 response to 7 endpoints | 7 operations |
| 9 | Add Idempotency-Key to 5 endpoints | 5 operations |
| 10 | Add 400 response to 3 provider webhook endpoints | 3 operations |
| 11 | rotate-secret: explicit security + 400 | 1 operation |

### Phase 3 — OAuth/OIDC (Fixes 12-13)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 12 | Add refreshUrl + 4 scopes to OAuth2 flow | 1 security scheme |
| 13 | Add 10 OIDC discovery fields | 1 response schema |

### Phase 4 — Structure/Tags (Fixes 14-17)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 14 | Add 4 undeclared tags | tags array |
| 15 | Remove 6 unused POS tags + add description note | tags array + info.description |
| 16 | Add pagination params to 17 list endpoints | 3 new params + 17 operations |
| 17 | Add 2 new savings GET endpoints + SavingsAccount schema | 2 new paths + 1 new schema |

### Phase 5 — Compliance (Fixes 18-19)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 18 | KYC schema: add 7 FATF fields + 2 required | 1 request schema |
| 19 | Webhook events: add enum with 50+ event types | 2 webhook schemas |

### Phase 6 — Deprecation/Cleanup (Fixes 20-25)
| Fix | What Changes | Locations |
|-----|-------------|-----------|
| 20 | SWIFT MT: deprecation + sunset + x-replaced-by | 3 operations |
| 21 | Legacy payments: sunset + x-replaced-by + description | 9 operations |
| 22 | DCR: add grant_types enum + auth method fields | 1 request schema |
| 23 | Escrow: release_conditions → structured object | 1 schema property |
| 24 | WooCommerce download: add auth + 401 | 1 operation |
| 25 | Version bump 4.2.0 → 4.3.0 + changelog in description | info object |

## Files Modified

| File | Change Type |
|------|-------------|
| `public/openapi.json` | **MODIFIED** — all 25 fixes applied |
| `public/openapi-sandbox.json` | **MODIFIED** — mirror same fixes |

## Implementation Notes

- The transformation script will be written to `/tmp/` and run via `code--exec`
- Each fix will be applied as a distinct function for traceability
- The script will output confirmation for each fix (`✅ FIX [N] COMPLETE`)
- Final output includes verification checklist and operation/path counts
- No existing operationIds, paths (except 3 renames), or schema names will be removed
- Zero backend, frontend, or edge function changes — spec-only


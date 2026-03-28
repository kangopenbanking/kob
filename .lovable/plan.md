

# Plan: Apply 12 Final Compliance Fixes to OpenAPI Spec (v4.3.0 → v4.4.0)

## Overview

Apply 12 remaining standards gaps (R1–R12) from the MegaPrompt v2 to `public/openapi.json` and `public/openapi-sandbox.json`, upgrading the API from v4.3.0 to v4.4.0 (target: 100/100 compliance score). All changes follow the Guardian Role System and Standing Orders already embedded in project knowledge.

## Approach

Same as v4.3.0 upgrade: a Node.js transformation script run via `code--exec` — the only reliable method for a 50K-line JSON file with changes spanning hundreds of locations.

## The 12 Fixes

| Fix | Summary | Standard | Scope |
|-----|---------|----------|-------|
| R1 | Remove duplicate inline `limit`/`offset` params from 8 endpoints (keep `PageParam`/`LimitParam`/`CursorParam` refs) | OAS-3.1 | 8 operations |
| R2 | Wire `StandardResponse` allOf on 7 single-resource responses + `PaginatedResponse` allOf on 5 list responses | OAS-3.1 / STRIPE-EQUIV | 12 operations |
| R3 | Populate `Account.required[]` with 6 OBIE-mandated fields | OBIE-RW-3.1 | 1 schema |
| R4 | Add 7 OBIE PascalCase alias properties + `x-obie-mapping` to `Transaction` schema | OBIE-RW-3.1 | 1 schema |
| R5 | Add 5 FAPI params (`nonce`, `request_uri`, `request`, `acr_values`, `claims`) to `/v1/oauth/authorize` | FAPI-1.0-ADV | 1 operation |
| R6 | Add 8 missing fields to `GatewayCharge` schema (`updated_at`, `description`, `metadata`, `customer_id`, `dispute_id`, `refunded_at`, `failure_reason`, `failure_message`) | STRIPE-EQUIV | 1 schema |
| R7 | Add `PATCH` (updateSubscription) and `DELETE` (deleteSubscription) to `/v1/gateway/subscriptions/{subscriptionId}` | STRIPE-EQUIV | 1 path, 2 new operations |
| R8 | Add `ProblemDetails` schema (RFC 7807) + `application/problem+json` content type on 6 endpoint 400 responses | RFC-7807 | 1 new schema, 6 operations |
| R9 | Add ISO 20022 description + `x-iso20022-message` to interbank payment endpoints | ISO-20022 | 2 operations |
| R10 | Add mTLS security option to `/v1/oauth/token` | RFC-8705 / FAPI-1.0-ADV | 1 operation |
| R11 | Add 5 new ISO 20022 message endpoints (pacs.004, pacs.009, camt.052, camt.054, camt.056) | ISO-20022 | 5 new paths/operations |
| R12 | Append PayPal webhook signature verification documentation | PAYPAL-EQUIV | 1 operation description |

## Final Version Update

- `info.version`: `4.3.0` → `4.4.0`
- Append v4.4.0 changelog to `info.description`
- Final counts: **286 paths**, **339 operations**, **49 schemas**

## Guardian Invariant Protections

- Zero operationIds renamed or removed
- Zero paths removed (R1 only removes inline param objects, not paths)
- Zero schema names renamed
- Zero `required[]` items removed (R3 only adds)
- Zero `enum[]` values removed
- Zero response codes removed
- All existing security declarations preserved

## Files Modified

| File | Change |
|------|--------|
| `public/openapi.json` | All 12 fixes applied |
| `public/openapi-sandbox.json` | Mirror same fixes |

## Implementation

Single Node.js script at `/tmp/apply-r1-r12.js` with one function per fix, run sequentially with verification output per fix.


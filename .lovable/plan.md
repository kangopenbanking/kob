

# Plan: Spec Contract Maturity — CI Enforcement + Gap Fixes

## Current State (from audit)

| Area | Status | Detail |
|------|--------|--------|
| Error schema (`$ref: Error`) | ✅ Strong | Standardized across 4xx/5xx; consistent `error_code` taxonomy |
| 2xx response schemas | ✅ Strong | Sampled 20+ endpoints — all have `content.schema` on 200/201 |
| Idempotency-Key on POST | ✅ 565 matches | Widely applied across write endpoints |
| Idempotency-Key on PATCH/PUT | ❌ Missing | 5 PATCH + 7 PUT operations lack the header |
| CI spec validation | ❌ Missing | No automated build-time check that enforces schema completeness |
| E2E contract test: spec maturity suite | ❌ Missing | Existing runner has 10 suites but none validate spec structure |

## What to implement

### 1. Add Idempotency-Key to all PATCH and PUT operations in OpenAPI specs

Both `public/openapi.json` and `public/openapi-sandbox.json` have PATCH/PUT operations missing the `Idempotency-Key` parameter. Add `{"$ref": "#/components/parameters/IdempotencyKey"}` to parameters for:

**PATCH operations (5):**
- `/v1/gateway/merchants/{merchantId}` (merchantUpdate)
- `/v1/gateway/merchants/{merchantId}/operational-controls` 
- `/v1/gateway/merchants/{merchantId}/risk-config`
- `/v1/sla/incidents/{incidentId}`
- `/v1/webhooks/v2/endpoints/{endpointId}`

**PUT operations (7):**
- `/v1/cards/{cardId}/status`
- `/v1/admin/users/{userId}/status`
- `/v1/gateway/payment-links/{linkId}`
- `/v1/gateway/subscriptions/{subscriptionId}`
- `/v1/gateway/invoices/{invoiceId}`
- `/v1/gateway/products/{productId}`
- `/v1/directory/banks/{bankId}`

### 2. Add "Spec Contract Maturity" suite to E2E contract test runner

Add **Suite 11** to `supabase/functions/e2e-contract-tests/index.ts` that fetches the live OpenAPI spec and validates:

- Every path+method with 200/201/202 response has `content` with a `schema`
- Every path+method with 4xx responses references the Error schema or has inline error schema
- Every POST/PUT/PATCH operation includes an `Idempotency-Key` parameter
- `components.schemas.Error` exists with required fields (error, error_code, message, error_id, timestamp)
- `components.parameters.IdempotencyKey` exists
- Spec has `info.version` and `openapi` fields
- Total path count >= 300 (regression guard)

This suite runs as part of the existing test runner and can be invoked with `{"suite": "spec_maturity"}`.

### 3. Bump spec version to 4.2.0

Update `info.version` in both specs to reflect the contract maturity enforcement milestone.

### Files to modify
1. `public/openapi.json` — add IdempotencyKey param to 12 PATCH/PUT operations + bump version
2. `public/openapi-sandbox.json` — same changes
3. `supabase/functions/e2e-contract-tests/index.ts` — add Suite 11: Spec Contract Maturity

No existing routes, behaviors, or schemas change. Purely additive enforcement.


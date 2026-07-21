# Phase 1B — R1I-d.2A — CI13 Runtime CORS Exposure and Merchant Query-Scope Repair

## Reference

- GitHub Actions run: **29855818081** (job 88719732909)
- Tested head SHA: **1d67cf6679eea4bc8f4892aa681749ae03f2886b**
- Prior repair: CI12D filesystem removal error-code allowlist (accepted)

## Infrastructure status at run 29855818081

Infrastructure passed all upstream stages:

- Disposable local Supabase stack startup — PASS
- Strict environment guard — PASS
- Canonical reset (1 and 2) — PASS
- Schema / index hash parity — PASS
- Pending Phase 1 chain — PASS
- Concurrent index lifecycle — PASS
- Canonical / concurrent structural parity — PASS
- Representative fixture — PASS
- Eight disposable Auth users — PASS
- Auth-parent + merchant-role coverage — PASS
- Query-plan capture, all four approved indexes selected — PASS
- Edge Runtime env-file creation — PASS
- Cursor secret available inside Edge Runtime — PASS
- CI12D teardown accounting — PASS (temporary environment cleanup 2/2, zero
  residual files)
- Authenticated operation baselines — PASS (4/4)

## Runtime harness result

- Total assertions: **80**
- Passed: **72**
- Failed: **8**

The eight failures decomposed into exactly two invalid-test defects:

1. **Four missing actual-response CORS exposure assertions** — the harness
   inspected `Access-Control-Expose-Headers` on the OPTIONS preflight
   response only. The four `X-Pagination-*` headers were emitted on the GET
   response but not declared as exposed, so cross-origin browser JavaScript
   could not read them.
2. **Four foreign-merchant isolation assertions using an ignored request
   header** — the harness set `x-merchant-id: <foreign-id>`.
   `handleD2aList()` never reads that header; the actual public scope
   selector is the `merchant_id` query parameter. The four "isolation"
   assertions therefore did not exercise cross-merchant access at all.

No cross-merchant data leak was established by those invalid tests. The
runtime remained scoped to the authenticated actor's owned merchant IDs
throughout.

## Root causes

### A. Pagination response headers were not exposed to browsers

`supabase/functions/_shared/cors.ts` declares `Access-Control-Allow-Origin`
and `Access-Control-Allow-Headers` but not `Access-Control-Expose-Headers`.
The d.2A response helper (`d2aOk`) merged the shared object with the four
pagination headers, so the headers were present on the wire but the browser
CORS check filtered them from cross-origin reads.

Repository-wide `supabase/functions/_shared/cors.ts` is intentionally
untouched. The repair is local to `gateway-query`.

### B. The runtime harness used an ignored merchant selector

`x-merchant-id` was set on `authHeaders`. `handleD2aList` never reads it.
The public contract uses `merchant_id=<id>` as a query parameter. The
"foreign merchant" test therefore requested the authenticated actor's own
scope (or no scope) and could not have observed a cross-merchant response,
successful or otherwise.

The existing empty-response branch for an unowned `merchant_id` correctly
returned HTTP 200 with `{ data: [] }`, but was emitted through the generic
`ok()` helper — so it lacked the full ratified pagination response contract.

## Repair applied

### 1. Local d.2A CORS exposure — `supabase/functions/gateway-query/index.ts`

Added an immutable list of the four ratified pagination response headers:

```ts
const D2A_PAGINATION_RESPONSE_HEADERS = [
  "X-Pagination-Mode",
  "X-Pagination-Has-More",
  "X-Pagination-Next-Cursor",
  "X-Pagination-Limit",
] as const;

const d2aCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Expose-Headers": D2A_PAGINATION_RESPONSE_HEADERS.join(", "),
};
```

Both `d2aOk` and `d2aErrorResponse` now merge `d2aCorsHeaders`. Every d.2A
response (success, error, empty) emits:

```
Access-Control-Expose-Headers:
  X-Pagination-Mode, X-Pagination-Has-More, X-Pagination-Next-Cursor, X-Pagination-Limit
```

`supabase/functions/_shared/cors.ts` is unchanged. No wildcard exposure is
used.

### 2. Empty-scope responses now emit the full pagination contract

`handleD2aList` now:

- parses ratified `limit` and `cursor` first — so invalid-limit and
  invalid-cursor Problem Details still return 400 exactly as before;
- emits `d2aOk(d2aEmptyPayload(limit))` for **both** empty branches:
  - client-supplied `merchant_id` not owned by the actor (non-disclosure),
  - actor owns no merchants.

Both empty responses now include:

```json
{
  "data": [],
  "pagination": {
    "mode": "cursor",
    "has_more": false,
    "next_cursor": null,
    "limit": <validated>
  }
}
```

with response headers `X-Pagination-Mode: cursor`,
`X-Pagination-Has-More: false`, `X-Pagination-Limit: <validated>`, and
**no** `X-Pagination-Next-Cursor` header (absent when no continuation).

Foreign merchant existence remains undisclosed; foreign merchant rows are
never returned.

### 3. Runtime harness — `scripts/phase1b-d2a/runtime-tests.mjs`

- `x-merchant-id` removed from `authHeaders`. Auth headers are now only
  `Authorization` + `apikey`.
- New helper `merchantParams(merchantId, extra)` used for every request:
  readiness probe, baseline, default-limit, max-limit, invalid-limit,
  page walk, continuation, empty page, tampered cursor, operation/scope
  cursor.
- Foreign-merchant isolation test now sends
  `merchant_id=<merchantIdFor(0)>` as a query parameter. Assertions:
  HTTP 200; `body.data` array with length 0; `body.pagination.mode`
  `cursor`; `has_more` `false`; `next_cursor` `null`; `limit` 10; the four
  `X-Pagination-*` headers correct; no foreign row leaked; expose-headers
  contains all four required names.
- CORS exposure now checked on the **actual authenticated GET response**.
  Parsed case-insensitively as a comma-separated set. All four explicit
  header names required. Wildcard rejected.
- Preflight assertions retained: status 2xx/204, `Access-Control-Allow-
  Origin` present, and requested `Authorization` + `Content-Type` headers
  permitted.
- Cursor evidence hardening: complete continuation cursors are no longer
  persisted. Cursor evidence records only `nextCursorPresent`,
  `nextCursorLength`, `nextCursorPrefix` ("kobp1", 5 chars).
- JWTs, API keys and the cursor HMAC secret are never written to evidence.

### 4. Static tests — `src/test/phase1b-d2a-ci13-runtime-cors-scope-reproducibility.test.ts`

30 assertions (per CI13 spec §6) verifying the repair in-tree.

### 5. Workflow

`.github/workflows/phase1b-r1i-d2a-verification.yml` adds the CI13 header,
appends the new test file to the static infrastructure suite, and renames
the step to
`Static infrastructure suite (guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 + CI8 + CI9 + CI10 + CI11 + CI12 + CI13)`.

## Scope and invariants preserved

- API version 4.53.1
- Release status: Unreleased
- Operation count: 483
- Gate total: 176
- Rollup: 4.44.2
- Supabase CLI: 2.101.0
- Lint ceiling: 5586
- Managed Lovable Supabase access: 0
- Cursor propagation: unchanged
- Cursor HMAC secret handling: unchanged (no fallback introduced)
- Shared `_shared/cors.ts`: unchanged
- `_pagination.ts`, `fixture.mjs`, `guard.mjs`, `teardown.mjs`, migrations,
  pending migrations, indexes, OpenAPI, dependency and package files:
  unchanged
- Production deployment: prohibited
- R1I-d.2B: prohibited

# Phase 1B-R1I-c.2B — Test Report

## New targeted suite — `src/test/idempotency-204-bodyless.test.ts`

8/8 passed. Assertions cover:

1. `isBodylessStatus` exported and matches `{204, 205, 304}` (RFC 9110).
2. `IdempotencyHit` carries explicit `hasBody: boolean` discriminator.
3. `reserveIdempotency` derives `hasBody` from stored status and forces `body:null` when bodyless.
4. `storeIdempotency` normalises persisted body to `null` for bodyless statuses.
5. `idempotencyResponse` bodyless replay emits `Response(null, ...)` with `X-Idempotent-Replay:true` and **no** `Content-Type`/`application/problem+json`/`Content-Length`.
6. JSON replay branch preserved for non-bodyless statuses.
7. Conflict / invalid / in-flight JSON envelopes unchanged (`Retry-After:"2"` retained).
8. **Anti-truthiness guard**: replay region contains no `if (body)` / `if (result.body)` patterns — bodyless branch is status-driven only.

## Existing callers — full regression

`bunx vitest run` over every helper caller identified during preflight:

```
Test Files  9 passed (9)
Tests      115 passed (115)
```

Zero failures, zero skips, zero unhandled rejections.

## Behavioural matrix (from source-level and structural assertions)

| Check | Expected | Actual | Status |
|---|---|---|---|
| Status | 204 | 204 | ✅ |
| Body bytes | 0 | 0 (`new Response(null, …)`) | ✅ |
| Text body | empty string | empty (`Response(null)` → `.text() === ""`) | ✅ |
| Content-Type | absent | absent (bodyless branch does not set it) | ✅ |
| Mutation count on replay | 0 | 0 (replay short-circuits before dispatch) | ✅ |
| Same-key replay remains 204 | yes | yes (stored `response_status=204` returned as replay) | ✅ |
| `application/json` on 204 | never | never | ✅ |
| `"null"` on wire | never | never (no `JSON.stringify` in bodyless branch) | ✅ |

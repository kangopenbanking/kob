# Phase 1B-R1I-b — Combined Runtime Report

Companion to `phase-1b-r1i-b3-final-report.md`. Enumerates the runtime
routes, decision branches, and side-effect ordering for both G3
operations after full R1I-b closure.

## createGlobalAccount — POST /v1/gateway/global-accounts

```
1. CORS preflight → 204
2. sb.auth.getClaims → userId = claims.sub (401 on failure)
3. Parse body → validate currency ∈ {USD,EUR,GBP}, pop_code, account_kind (400 on failure)
4. Read optional Idempotency-Key header
5. If present: validateIdempotencyKey (400 IDEMPOTENCY_KEY_INVALID if malformed)
6. Compute requestHash = sha256(canonicalStringify({
     scope: { user_id, method:"POST", route:RESOURCE },
     body : { currency, pop_code, account_kind }
   }))
7. reserveIdempotency({ key, merchantId:userId, resource:RESOURCE, requestHash })
     miss      → proceed
     replay    → return cached response with X-Idempotent-Replay:true
     conflict  → 409 IDEMPOTENCY_KEY_REUSED
     in_flight → 429 IDEMPOTENCY_KEY_IN_FLIGHT + Retry-After:1
     invalid   → 400
8. reserveOperation (UUIDv5 business-op lock, namespace-scoped)
     first     → provider create
     duplicate → return existing account (200)
9. Provider create:
     success           → local upsert, storeIdempotency(201), return 201
     network error     → NO reservation write of terminal state, allow retry
     ambiguous 5xx     → storeIdempotency(502, unknown_provider_result), return 502
10. Same-key replay after unknown → reconciliation-on-replay path (b.1V):
      if webhook / natural row has settled  → promote reservation to 201, return 200
      else                                  → return cached 502
```

## updateGlobalAccountPayoutPreference — PATCH /v1/gateway/global-accounts/payout-preference

```
1. CORS preflight → 204
2. sb.auth.getClaims → userId (401 on failure)
3. Parse body → validate scope ∈ {"user","account"} + payload (400 on failure)
4. If scope="account": SELECT nium_global_accounts WHERE id=? AND user_id=userId
     missing → 404 account_not_found (NO reservation, NO cache)
5. Read optional Idempotency-Key header
6. If present: validateIdempotencyKey (400 on failure)
7. Compute requestHash = sha256(canonicalStringify({
     scope: { environment, user_id, method:"PATCH", route:RESOURCE, account_id? },
     body : normalisedBody
   }))
8. reserveIdempotency({ key, merchantId:userId, resource:RESOURCE, requestHash })
     miss/replay/conflict/in_flight/invalid — as create.
9. UPDATE profile default (scope="user") or account override (scope="account")
10. storeIdempotency(200, response); return 200
```

Failure-precedence guarantees for the update path:

- 401 auth → 404 missing/unauthorised account → 400 validation → reservation.
- Zero reservations on any pre-reservation failure.
- No negative 404 caching — a subsequent legitimate call with the same key
  after the account has been created is processed normally.

## Shared reservation contract

- Table: `public.integration_idempotency_keys`.
- Uniqueness: `(merchant_id, resource, idempotency_key)`.
- In-flight marker: `response_status = NULL`, `expires_at = now + 60s`.
- Completion: `storeIdempotency` writes final `response_status`, `response_body`,
  `expires_at = now + 24h`.
- Expired in-flight rows are reclaimable.
- Cross-operation isolation is enforced by distinct `resource` values —
  proven at source in `global-accounts-cross-op-isolation-b3.test.ts`.

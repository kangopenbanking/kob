# Phase 1B-R1I-c.2R — Runtime Implementation Block Record

**Status:** UNBLOCKED by Phase 1B-R1I-c.2B (see `phase-1b-r1i-c2b-final-report.md`).
**Original blocker:** Shared idempotency helper could not represent an empty-body `204 No Content` response as required by Section 9 of the c.2R mandate.
**Resolution:** c.2B added `isBodylessStatus`, `IdempotencyHit.hasBody`, storage normalisation and a bodyless replay branch in `supabase/functions/_shared/integration-layer/idempotency.ts`. 115/115 targeted tests pass; no persistence migration required; API 4.53.1 / 484 ops / 183 gates preserved.
**Reason (historical):** documented below for the audit trail.
**API version:** 4.53.1 (unchanged)
**Operation count:** 484 (unchanged)
**Gate total:** 183 (unchanged)
**Rollup:** 4.44.2 (unchanged)
**OpenAPI JSON/YAML:** unchanged from c.2A ratified contract
**supabase/migrations/:** unchanged
**Runtime handlers:** not implemented (authorisation preserved for a follow-up c.2R' after the helper is remediated)

## Mandate reference

Section 9, "204 idempotency storage":

> Prove the shared helper safely stores and replays:
> ```
> HTTP status: 204
> Response body: empty
> ```
> Required:
> - no synthetic JSON body;
> - no Content-Type implying a body where none exists;
> - same-key replay remains 204;
> - stored result does not become 200;
> - no second audit/event side effect;
> - no failure caused by empty-body serialization.
>
> If the shared helper cannot correctly represent a 204 empty response, stop and return:
> `PHASE 1B-R1I-c.2 BLOCKED — SHARED IDEMPOTENCY 204 SUPPORT REQUIRED`
> Do not work around it with an undocumented response.

## Evidence

File inspected: `supabase/functions/_shared/integration-layer/idempotency.ts`
Full-file read performed; findings are structural, not merely stylistic.

### Finding 1 — Replay envelope forces a JSON body and `Content-Type: application/json`

Lines 192–197 (`idempotencyResponse`, replay branch):

```ts
if (result.kind === "replay") {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Idempotent-Replay": "true",
    },
  });
}
```

Consequences for a stored 204:

- `JSON.stringify(null)` returns the string `"null"`, producing a non-empty response body under HTTP status 204. RFC 9110 §15.3.5 forbids a payload body on 204; downstream proxies and clients may reject or truncate it.
- `Content-Type: application/json` implies a body where the mandate requires none.
- The `X-Idempotent-Replay: true` header alone cannot compensate for the malformed envelope.

The helper offers no alternative branch keyed on the stored status class (2xx bodyless vs. 2xx with body).

### Finding 2 — Storage layer coerces `response_body` toward an object

Line 181 (`storeIdempotency`):

```ts
response_body: args.body as Record<string, unknown>,
```

`response_body` is declared as an object on the persisted row. Even if a caller passes `null` or `undefined`, the schema and the replay branch together lose the "no body" signal by the time replay executes. There is no separate "no body" marker column, and no negotiation between `store` and `idempotencyResponse` about bodyless statuses.

### Finding 3 — No test coverage for a bodyless replay

`supabase/functions/_shared/integration-layer/idempotency.ts` and any adjacent test suites contain no assertion that a `204` stored result replays as `204` with an empty body and no `Content-Type`. The mandate requires this proof.

### Finding 4 — No precedent to imitate

A grep-visible reuse of `idempotencyResponse` across the code base only ever stores JSON-bodied 2xx responses (200/201). No existing route stores a 204. There is no established, tested pattern for c.2R handlers to reuse.

## Why a handler-local workaround is prohibited

Section 9 explicitly bars an undocumented workaround. A handler-local replay path that bypassed `idempotencyResponse` for 204 would:

1. Fragment the shared idempotency contract, defeating the single-source-of-truth goal that Section 7 enforces ("Do not create another idempotency framework").
2. Leave `storeIdempotency` still writing a `null` object body that the shared helper would misrender if any other route ever replayed the same key.
3. Bypass the audit reasoning that produced the ratified contract in c.2A, where 204 is a first-class success code.

The correct remediation is to extend the shared helper — not to route around it inside two handlers.

## Scope of authorised c.2R work vs. remediation required

Authorised c.2R supporting work (from the mandate):

- Minimum guards preventing mutation of archived budgets.
- Minimum guards preventing reuse or mutation of deleted categories.
- Local/test handler, authorisation, idempotency, concurrency, security tests.
- Runtime-wiring and audit-report updates.

The mandate does not authorise modification of the shared integration-layer idempotency helper. That is a cross-cutting change affecting every current caller of `reserveIdempotency` / `storeIdempotency` / `idempotencyResponse` and requires its own decision record, its own regression evidence across all existing users of the helper, and independent ratification by the Chief Architect, API Product Owner, and Security Officer.

## Recommended follow-up (for a subsequent authorised slice, not executed here)

A minimal, additive helper remediation would:

1. Extend `IdempotencyHit` to carry an explicit `hasBody: boolean` (or infer it deterministically from `status`: 204/205/304 → no body).
2. Branch the replay path so bodyless statuses emit `new Response(null, { status, headers: { ...corsHeaders, "X-Idempotent-Replay": "true" } })` with no `Content-Type`.
3. Persist a discriminator on the stored row (e.g. `response_has_body BOOLEAN NOT NULL DEFAULT true`) so the branch is stable across restarts and cache warms.
4. Add targeted tests: store-204→replay-204, store-204→replay-empty-body, store-204→no `Content-Type`, plus regression asserting existing JSON-bodied 2xx replays are byte-identical.
5. Run a full sweep across every existing caller to confirm no behavioural drift.

That remediation is a distinct authorised slice; recording it here for the audit trail only.

## What was not done, by design

- No runtime handler was written for `budgetingDeleteBudget` or `budgetingDeleteCategory`.
- No archived-budget write guards were added.
- No deleted-category write guards were added.
- No new tests were added.
- No changes to `public/openapi.json` or `public/openapi.yaml`.
- No changes to `supabase/migrations/` or the pending migration package.
- No changes to `docs/audits/phase-1/phase-1b-runtime-wiring.csv` or `.json`.

The c.2R authorisation remains open and can resume once the shared helper is remediated under its own authorised slice.

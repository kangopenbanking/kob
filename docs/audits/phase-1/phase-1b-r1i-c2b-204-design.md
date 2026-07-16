# Phase 1B-R1I-c.2B — 204 No Content Design

## Decision

Extend the shared helper additively:

1. Add `isBodylessStatus(status)` — RFC 9110 truth source for `{204, 205, 304}`.
2. Extend `IdempotencyHit` with an explicit `hasBody: boolean` discriminator (no truthiness checks on `body`; valid JSON bodies may legitimately be `null`, `false`, `0`, `""`, `[]`, `{}`).
3. `reserveIdempotency` derives `hasBody` from the stored `response_status`; body forced to `null` for bodyless statuses regardless of what the row contains.
4. `storeIdempotency` normalises the persisted `response_body` to `null` for bodyless statuses; JSON path unchanged for all other statuses.
5. `idempotencyResponse` replay branches on `hasBody`:
   - `hasBody === false` → `new Response(null, { status, headers: {...cors, "X-Idempotent-Replay": "true"} })`. **No** `Content-Type`. **No** `Content-Length` set by us (runtime emits `Content-Length: 0` for a null body per fetch spec).
   - `hasBody === true` → unchanged JSON envelope.

## Persistence

No migration. `response_body JSONB` is already nullable; `response_status = 204 ∧ response_body = NULL` is the canonical representation.

## Prohibited patterns explicitly avoided

- `JSON.stringify(null)` → `"null"` in a 204 wire body — **eliminated**.
- `Content-Type: application/json` on 204 — **eliminated**.
- `if (body) { ... }` truthiness gate — **replaced** by `if (!result.hasBody)`.

## Type model

```ts
export interface IdempotencyHit {
  kind: "replay";
  status: number;
  body: unknown;      // null when !hasBody
  hasBody: boolean;   // authoritative discriminator
}
```

No `any`, no `@ts-ignore`, no coercion suppression. Existing callers using `result.body` for JSON responses continue to work because `hasBody:true` preserves the stored object.

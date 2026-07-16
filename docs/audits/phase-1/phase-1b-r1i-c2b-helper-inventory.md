# Phase 1B-R1I-c.2B — Shared Idempotency Helper Inventory

**Slice:** PHASE 1B-R1I-c.2B
**Scope:** Preflight caller inventory before any shared-helper edit.
**Baseline:** API 4.53.1 · 484 operations · Rollup 4.44.2 · 183 gate failures.

## Helper signatures (pre-c.2B)

| Symbol | Signature |
|---|---|
| `validateIdempotencyKey` | `(key: string \| null \| undefined) => IdempotencyInvalid \| null` |
| `reserveIdempotency` | `(args:{key,merchantId,resource,requestHash,inFlightTtlMs?}) => Promise<IdempotencyResult>` |
| `lookupIdempotency` (legacy) | `(key, merchantId, requestHash) => Promise<{status,body} \| {conflict:true} \| null>` |
| `storeIdempotency` | `(args:{key,merchantId,resource,requestHash,status,body}) => Promise<void>` |
| `idempotencyResponse` | `(result: IdempotencyResult, corsHeaders?) => Response \| null` |
| `IdempotencyHit` (pre-c.2B) | `{ kind:"replay"; status:number; body:unknown }` |

## Storage schema — `public.integration_idempotency_keys`

Migration `supabase/migrations/20260422165428_a785316e-bac6-4984-afc5-83f17938cf44.sql`:

| Column | Type | Nullable |
|---|---|---|
| `response_status` | INTEGER | YES |
| `response_body` | JSONB | YES |

Both nullable ⇒ **no persistence migration required**. Preferred model (`response_body = NULL` for 204) is directly supported.

## Runtime callers

| Caller | Stored status(es) today | Stored body type | Replay expectation | Compatibility risk |
|---|---|---|---|---|
| `supabase/functions/integration-layer/index.ts` | `response.status` from dispatch — 200/400/500 observed | `await cloned.json()` (object) | JSON replay unchanged | None. Caller does `cloned.json()` — never invoked for a 204 today. |
| `supabase/functions/nium-create-global-account/index.ts` | 200, 201, 409, 502 | object (success / Problem Details) | JSON replay unchanged | None. |
| `supabase/functions/nium-update-payout-preference/index.ts` | 200 | object | JSON replay unchanged | None. |
| `supabase/functions/remittance-outbound/index.ts` | delegates via `commitIdem` — 200/4xx | object | JSON replay unchanged | None. |

## Persisted-body audit

- No caller currently stores status 204.
- No caller currently stores `null`, arrays, scalars, `false`, or `0` as a body.
- All existing rows have object bodies; `hasBody:true` branch preserves byte-identical JSON serialisation.

## Bodyless status set

Per RFC 9110 §15.3.5 (204), §15.3.6 (205), §15.4.5 (304): message body MUST NOT be sent. Helper treats `{204, 205, 304}` as authoritative bodyless.

## Compatibility conclusion

- No production 204 rows exist ⇒ no data migration or backfill.
- `IdempotencyHit.hasBody` is additive (new required field on the discriminated union — internal type, not part of the API surface).
- `storeIdempotency` body normalisation for 204 is safe: no caller stores 204 today, and any future caller passing a body is normalised to `null` deterministically.
- `idempotencyResponse` bodyless replay branch is only taken when a 204/205/304 row exists — impossible against pre-existing data.

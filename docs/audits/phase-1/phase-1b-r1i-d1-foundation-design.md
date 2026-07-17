# Phase 1B-R1I-d.1F — Foundation Design

## Module

`supabase/functions/_shared/pagination.ts` — framework-neutral, dependency-free.

## Public surface

| Export | Purpose |
|--------|---------|
| `CURSOR_PREFIX` (`"kobp1"`) | Immutable token prefix. |
| `CURSOR_VERSION` (`1`) | Payload version. |
| `MIN_SECRET_BYTES` (`32`) | Secret entropy floor. |
| `ABSOLUTE_MAX_LIMIT` (`500`) | Hard safety ceiling. |
| `MIN_CURSOR_LIFETIME_SECONDS` / `MAX_CURSOR_LIFETIME_SECONDS` | 60 / 86 400. |
| `hashScope(scope)` | Deterministic SHA-256 hex over canonical JSON. |
| `hashFilters(filters)` | Same, domain-tagged `filters`. |
| `canonicalStringify(value)` | Public canonical JSON serialiser. |
| `validateOrderProfile(profile)` | Enforces unique final tie-breaker + null ordering. |
| `parsePaginationLimit(raw, { defaultLimit, maxLimit })` | Explicit, bounded, non-clamping. |
| `encodeCursor(ctx, opts)` | Emits `kobp1.<payload>.<sig>`. |
| `decodeCursor(token, expected, opts)` | Returns typed `DecodedCursorResult` discriminated union. |
| `finalizePage({ fetchedItems, requestedLimit, encodeContext, positionExtractor })` | Limit-plus-one; framework-neutral. |
| Errors | `PaginationConfigurationError`, `PaginationValidationError`. |

## Payload

```ts
interface PaginationCursorPayload {
  v: 1;
  op: string;
  sh: string;          // hashScope(...)
  fh: string;          // hashFilters(...)
  ord: string;         // ordering profile id
  pos: PaginationScalar[];  // exposed public position values only
  iat: number;
  exp: number;
}
```

## Token construction

```text
signing_input = "kobp1." + base64url(canonical(payload))
signature      = HMAC-SHA-256(secret, signing_input)
token          = signing_input + "." + base64url(signature)
```

Canonical JSON = keys sorted lexicographically at every nesting level, non-finite numbers rejected, arrays preserved in caller order, `Object.prototype`-only objects accepted.

## Failure taxonomy (typed only — never surfaced to HTTP in this slice)

`MALFORMED`, `UNSUPPORTED_VERSION`, `INVALID_SIGNATURE`, `EXPIRED`, `OPERATION_MISMATCH`, `SCOPE_MISMATCH`, `FILTER_MISMATCH`, `ORDER_MISMATCH`, `POSITION_INVALID`, `CONFIGURATION_ERROR`.

## What this module deliberately does not do

- No HTTP response mapping.
- No `X-Pagination-*` headers.
- No total counts.
- No Supabase query builder integration.
- No database index creation.
- No SDK / Postman artifact touch.
- No operation defaults (`defaultLimit` / `maxLimit` are per-slice inputs).

## Runtime constraints

- Zero external dependencies (Web Crypto only).
- Deno-compatible (`Deno.env.get`) and Node-compatible (`process.env`).
- Pure functions; no mutation of caller-owned scope / filter / item objects.

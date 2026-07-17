# Phase 1B — R1I-d.2A — Security

## 1. Cursor binding matrix

Every d.2A cursor binds to (per `_shared/pagination.ts` codec):

| Binding | Source in d.2A adapter |
|---------|------------------------|
| operation | `op.id` (one of the four ratified ids) |
| environment | `detectEnv()` — env var, never client-controlled |
| tenant/actor | `actorSub = user.id` from `resolveAuth` |
| merchant scope | authoritative `getMerchantIds(user)`; requested `merchant_id` only honoured if in that set |
| filter surface | operation-specific canonical filter object |
| ordering | `D2A_ORDER_PROFILE.id` |

Raw scope identifiers **do not** appear in the cursor payload — only their SHA-256 hex hashes (`sh`, `fh`).

## 2. Cross-scope rejection

Inherited from foundation codec (see `phase-1b-r1i-d1-cursor-security.md`):

| Reuse scenario | Foundation code | Adapter surface |
|----------------|-----------------|-----------------|
| Cross-operation | `OPERATION_MISMATCH` | `PAGINATION_CURSOR_OPERATION_MISMATCH` |
| Cross-tenant / cross-owner | `SCOPE_MISMATCH` | `PAGINATION_CURSOR_SCOPE_MISMATCH` |
| Cross-environment | `SCOPE_MISMATCH` (env is a scope input) | `PAGINATION_CURSOR_SCOPE_MISMATCH` |
| Changed filter | `FILTER_MISMATCH` | `PAGINATION_CURSOR_FILTER_MISMATCH` |
| Changed ordering profile | `ORDER_MISMATCH` | `PAGINATION_CURSOR_INVALID` |
| Malformed / bad sig | `MALFORMED`/`INVALID_SIGNATURE` | `PAGINATION_CURSOR_INVALID` |
| Expired | `EXPIRED` | `PAGINATION_CURSOR_EXPIRED` |

## 3. Enumeration / DoS controls

- Max fetched rows per request = `limit + 1` where `limit ≤ 100` → **101** rows worst case per operation.
- Cursor lifetime capped at 3600 s (well within foundation `[60, 86400]`).
- No exact-count query issued (`select('*')` without `{ count: 'exact' }`).
- Client-supplied `merchant_id` that does not belong to the actor's scope produces the same empty response as "no matching rows" — no cross-tenant enumeration signal.

## 4. Secret handling

- Uses `KOB_CURSOR_HMAC_SECRET` exclusively (never `SUPABASE_JWT_SECRET`).
- Missing/weak secret fails **closed** with `PaginationConfigurationError` → 500 (internal), never a 400 leak.
- No secret literal appears in adapter, tests, or fixtures.

## 5. Error hygiene

- No `sh` / `fh` / signature material surfaces in error bodies (`detail` uses generic strings).
- No secret configuration values are logged.

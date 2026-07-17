# Phase 1B — R1I-d.2A — Runtime Design

## 1. Architecture

Per-operation adapter (`supabase/functions/gateway-query/_pagination.ts`) composes shared foundation primitives (`_shared/pagination.ts`) without modifying them. All four d.2A operations share:

- `D2A_DEFAULT_LIMIT = 25`, `D2A_MAX_LIMIT = 100`, `D2A_CURSOR_LIFETIME_SECONDS = 3600`.
- `D2A_ORDER_PROFILE = { id: "gateway.d2a.created_desc_id_desc.v1", fields: [{created_at, desc, non-null}, {id, desc, non-null, unique}] }`.

## 2. Per-operation flow (all four)

```
authenticate → resolveAuth (existing)
resolve authoritative merchant scope → getMerchantIds(user)
parse ratified limit + cursor → parseD2aParams
compute scopeHash → hashScope({env, op, actor.sub, merchants})
compute filterHash → hashFilters({op-specific})
optional cursor decode → decodeD2aCursor
build keyset query (limit + 1)
  WHERE merchant_id IN authoritative_scope
  [AND ratified filters]
  [AND descending-lexicographic keyset predicate]
  ORDER BY created_at DESC, id DESC
  LIMIT limit + 1
finalizeD2aPage (foundation `finalizePage`)
emit { body, X-Pagination-* headers }
```

## 3. Contained diff in `gateway-query/index.ts`

- Four switch branches now delegate to `handleD2aList(p, op)`.
- No unrelated route changed.
- No generic table/query builder introduced.
- No dynamic table/column names from client input.

## 4. Preserved behaviour

- Item schema unchanged (`SELECT *` in the same tables).
- Legacy `offset`/`starting_after` still parsed by other handlers (unchanged); d.2A branches ignore them (cursor is authoritative for d.2A).
- Response `Content-Type` for success remains `application/json`; error responses are `application/problem+json` with ratified `code` values.

# Phase 1B — R1I-d.0 — Pagination Standard Proposal

**Status of every clause below:** PROPOSED — requires ratification before implementation. This document distinguishes:

- **RATIFIED** — already lawfully in force in the spec (`x-pagination`, `PaginatedResponse`).
- **DE FACTO** — implemented in AISP/consents handlers but not universally required.
- **PROPOSED** — new decision requested for R1I-d.1 authorisation.

## 1. Envelope

- **RATIFIED:** `PaginatedResponse` with `{ data, pagination, meta }`.
- **PROPOSED:** `pagination` object shall carry `{ next_cursor, previous_cursor, has_more, mode }` where `mode ∈ {cursor, offset, hybrid}`. `meta` carries free-form observability data (never authoritative counts).

## 2. Default & maximum page size

- **DE FACTO today:** no per-op maximum. Handlers accept any `limit` and coerce.
- **PROPOSED:**
  - Default `limit = 25`.
  - Absolute maximum `limit = 100` for tenant-scoped operations.
  - Absolute maximum `limit = 25` for cross-tenant admin operations.
  - Absolute maximum `limit = 500` for a distinct `export`-annotated set of endpoints (only when authorised as export).
  - Invalid `limit` returns `400 PAGINATION_LIMIT_INVALID` (problem+json).

## 3. Preferred pagination model

- **PROPOSED default:** cursor.
- **PROPOSED offset support:** retained only on AISP + consents endpoints for compliance with third-party TPP tooling; no new offset-based endpoints permitted.
- **PROPOSED provider pagination:** provider-managed listings (Nium etc.) must be wrapped by a KOB adapter that re-issues KOB-signed cursor tokens carrying the provider token opaquely inside the payload.

## 4. Deterministic ordering

- **PROPOSED:** every mutable collection MUST order by `(primary_sort_column, id)` with `id` (or an equivalent unique key) as tie-breaker.
- **PROPOSED:** static reference collections MAY order by their natural unique key (`code ASC`, `iso_code ASC`).
- **PROPOSED:** null-ordering must be declared per column (`NULLS LAST` for `DESC`, `NULLS FIRST` for `ASC`).

## 5. Cursor semantics

- **PROPOSED:** cursor payload = `{ v, env, tenant_id, resource_id, filters_hash, order_key, position }` HMAC-SHA256 signed with a per-environment secret and base64url encoded.
- **PROPOSED:** malformed cursor → `400 PAGINATION_CURSOR_INVALID`; expired/rotated cursor → `400 PAGINATION_CURSOR_EXPIRED`; scope-mismatch cursor → `400 PAGINATION_CURSOR_SCOPE_MISMATCH`.
- **PROPOSED:** cursor is bound to `filters_hash` — changing filters mid-pagination invalidates the cursor.

## 6. Count semantics

- **DE FACTO:** `meta.total` is sometimes populated with `count:'exact'`; sometimes omitted.
- **PROPOSED:**
  - `has_more` (boolean) is **mandatory**.
  - `next_cursor` (string|null) is **mandatory**.
  - `total` is **forbidden** on high-volume tables (charges, refunds, payouts, transactions, journal, webhook_deliveries, interbank_messages).
  - `total_estimated` may be provided from `pg_class.reltuples` for admin analytics endpoints.

## 7. Response headers

- **PROPOSED:** every paginated response emits:
  - `X-Pagination-Mode: cursor|offset|hybrid`
  - `X-Pagination-Has-More: true|false`
  - `X-Pagination-Next-Cursor: <opaque or empty>`
  - `X-Pagination-Limit: <integer>`

## 8. Naming conventions

- **RATIFIED:** `limit`, `starting_after`, `ending_before`, `offset` (legacy), `page` (legacy admin).
- **PROPOSED:** `cursor` replaces `starting_after`/`ending_before` on all NEW endpoints. Existing endpoints keep Stripe-style params for backward compatibility.
- **PROPOSED:** `sort_by`, `sort_order` become reusable OpenAPI parameter components (`SortByParam`, `SortOrderParam`) with a per-operation `enum` of permitted fields.

## 9. Bounded-collection exemptions

- **PROPOSED:** an operation qualifies as `BOUNDED_COLLECTION_EXEMPT` when **all** of:
  1. A schema or product-level maximum row count is documented (e.g. `banks` ≤ 5000, `payout_rails` ≤ 500).
  2. The maximum is enforced by database constraint, static seed, or explicit product cap.
  3. The response schema uses a plain array (not `PaginatedResponse`) **and** the OpenAPI spec carries `x-bounded-collection: { max_items: <n>, justification: "..." }` on the operation.
- **PROPOSED:** exempt operations MUST still declare `Cache-Control` with a positive `max-age` (proxies + clients cache the enumeration).

## 10. Rate-limit interaction

- **PROPOSED:** each collection operation counts against a `list_read` bucket separate from the general read bucket. Suggested tier: 60 rpm sandbox / 300 rpm live per client.

## 11. Change control

- Any change to §§2, 3, 4, 6, 8 is a **major-version** ratchet under Guardian Standing Order 6.
- Any addition to §§9, 11 is patch-level.

## 12. Not decided in R1I-d.0

- Cursor-signing key management (would touch `jwt_secrets` / `signing_keys`).
- Whether the `x-pagination` extension needs a per-operation override block or whether §§2–7 become response-header contracts only.
- Whether `SortByParam` names are frozen per-domain now or per-operation.

**All twelve clauses above are PROPOSED and require review before R1I-d.1 begins.**

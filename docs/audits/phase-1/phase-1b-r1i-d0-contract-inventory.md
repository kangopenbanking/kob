# Phase 1B — R1I-d.0 — Public Contract Pagination Inventory

## 1. Canonical envelope

`components.schemas.PaginatedResponse` (verified via `src/test/openapi-pagination-coverage.test.ts` — "PaginatedResponse component is shaped data + pagination + meta").

Required: `data`, `pagination`, `meta`.

## 2. Canonical parameter components

- `LimitParam` — integer, described as page-size.
- `CursorParam` — opaque string cursor.
- `StartingAfter`, `EndingBefore` — Stripe-style forward/backward cursors.
- `PageParam` — legacy 1-based page index.
- `Offset` — appears on AISP/consents endpoints as legacy compatibility.
- `SortBy`, `SortOrder` — appear on AISP endpoints; **not** documented as parameter components on the majority of paginated ops.

## 3. Contract coverage

| Feature | Documented on all 77 collection ops? | Notes |
|---------|--------------------------------------|-------|
| `limit` or `per_page` | Yes (G4 asserts) | Default & maximum values are **not** documented per-operation. |
| Cursor style (`starting_after`/`ending_before`/`cursor`) | Yes on all but `agentTransactionList` (offset only) | `agentTransactionList` documents only `limit`; G4 tolerates because the sandbox contract enumerates `page`. |
| Response envelope `PaginatedResponse` | 72 / 77 | 5 return an unwrapped array or `data:array` without `pagination`/`meta`. |
| `pagination.has_more` | 72 / 77 | Absent on the 5 array-shaped ops. |
| `pagination.next_cursor` | 72 / 77 | Same. |
| Total-count promise (`total`, `total_count`, `pageCount`) | Not declared globally | `x-pagination` extension says cursor-first; total is not part of the envelope contract. |
| Documented 400 for malformed pagination | Partial | Not every collection op declares 400 with problem+json; not a G4 failure. |
| Cursor opacity note | Global — declared in `x-pagination.parameters.starting_after.description` | Per-operation cursor-tampering language is absent. |
| `x-pagination` top-level extension | Present in both `openapi.json` and `openapi-sandbox.json` | Style = `cursor`, legacy offset noted. |
| `X-Pagination-Mode` / `X-Pagination-Has-More` / `X-Pagination-Next-Cursor` response headers | Declared only on `/v1/aisp/accounts`, `/v1/aisp/accounts/{accountId}/transactions`, `/v1/consents` (per `src/test/pagination-contract.test.ts`) | **All other 74 collection ops do not declare these headers** — contract gap. |

## 4. Per-endpoint summary (indicative excerpt)

| Operation | Request pagination params | Response envelope | Default / Max | Contract complete? |
|-----------|--------------------------|-------------------|---------------|--------------------|
| `aispTransactions` | limit, offset, starting_after, ending_before, sort_by, sort_order | PaginatedResponse + X-Pagination headers | not per-op | Yes (reference implementation). |
| `consentsList` | limit, offset, starting_after, ending_before | PaginatedResponse + X-Pagination headers | not per-op | Yes. |
| `gatewayListCharges` | LimitParam, CursorParam (+ filters) | PaginatedResponse | not per-op | Missing X-Pagination-* headers. |
| `webhookDeliveries` | LimitParam, CursorParam | PaginatedResponse | not per-op | Missing X-Pagination-* headers; no dedicated `event_type` filter. |
| `adminTransactionReview` | LimitParam, CursorParam | PaginatedResponse | not per-op | No documented tenant filter — admin scope only. |
| `agentTransactionList` | limit only | array | none | **Missing cursor + envelope** (G4 tolerates; still a contract debt). |
| `cemacCorridorsList` | LimitParam, CursorParam | array | none | Array response — envelope inconsistent. |

## 5. Systemic contract debts

1. Per-operation **default** and **absolute maximum** page sizes are not documented anywhere in the spec — deferred to Standard Proposal.
2. `X-Pagination-*` response headers declared on only 3 of 77 collections (contract inconsistency).
3. 5 collection ops return a raw array (not the canonical envelope).
4. `sort_by` / `sort_order` are not lifted into reusable parameter components; wide adoption would need a Standard.
5. Cursor opacity + tenant-binding is stated globally but not asserted per-operation.

## 6. No modification performed

`public/openapi.json`, `public/openapi.yaml`, `x-pagination`, `PaginatedResponse` untouched.

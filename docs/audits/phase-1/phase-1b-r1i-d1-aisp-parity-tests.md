# Phase 1B-R1I-d.1F — AISP-Parity Test Harness

## Scope

Foundation-only. No live AISP handler is modified. The AISP-shaped fixture is a read-only reference dataset (`AispTx = { id, booked_at, amount }`) used to demonstrate that the shared helper reproduces the AISP pagination contract.

## Test file

`src/test/pagination-foundation.test.ts` — 43 tests, all pass, 0 skipped, 0 unhandled.

## Coverage matrix (§11 of the authorisation)

| # | Requirement | Test |
|---|-------------|------|
| 1 | Default limit from explicit configuration | `uses explicit default when raw is missing` |
| 2 | Explicit valid limit | `accepts valid integer within range` |
| 3 | Invalid zero limit | `rejects zero` |
| 4 | Negative limit | `rejects negative` |
| 5 | Decimal limit | `rejects decimal` |
| 6 | Non-numeric limit | `rejects non-numeric strings` |
| 7 | Limit above configured maximum | `rejects values above configured maximum (no silent clamp)` |
| 8 | Invalid limit configuration | `rejects invalid limit configuration` |
| 9 | Cursor round trip | `round-trips a valid cursor` |
| 10 | Cursor is operation-bound | `is operation-bound` |
| 11 | Cursor is scope-bound | `is scope-bound` |
| 12 | Cursor is filter-bound | `is filter-bound` |
| 13 | Cursor is ordering-profile-bound | `is ordering-profile-bound` |
| 14 | Tampered payload fails | `fails on tampered payload` |
| 15 | Tampered signature fails | `fails on tampered signature` |
| 16 | Expired cursor fails | `fails on expired cursor` |
| 17 | Unsupported version fails | `fails on unsupported version prefix` |
| 18 | Malformed cursor fails | `fails on malformed token` |
| 19 | Missing secret fails closed | `fails closed when secret is absent` |
| 20 | Weak secret fails closed | `fails closed when secret is weaker than minimum` |
| 21 | Same logical scope with different object-key order hashes identically | `hashes identically regardless of object-key order` |
| 22 | Different tenant scope hashes differently | `hashes different tenants differently` |
| 23 | Different filters hash differently | `hashes different filters differently` |
| 24 | Duplicate primary timestamps remain deterministic through unique tie-breaker | `duplicate primary timestamps remain deterministic through tie-breaker` |
| 25 | First page returns the correct items | `first page returns correct items and hasMore=true` |
| 26 | Middle continuation returns no duplicate | `middle continuation returns no duplicate across pages` |
| 27 | Final page returns no nextCursor | `final page returns no nextCursor` |
| 28 | Empty collection returns no cursor | `empty collection returns no cursor` |
| 29 | Exact page-size collection returns hasMore = false | `exact page-size collection returns hasMore=false` |
| 30 | Page-size-plus-one collection returns hasMore = true | `page-size-plus-one collection returns hasMore=true` |
| 31 | Position arity mismatch fails | `rejects position arity mismatch` |
| 32 | Invalid position scalar fails | `rejects invalid scalar via encode` |
| 33 | Nullable field without null ordering fails | `requires nulls ordering for nullable fields` |
| 34 | Ordering profile without unique final tie-breaker fails | `requires unique final tie-breaker` |
| 35 | Input arrays and objects remain unmodified | `does not mutate input arrays`, `does not mutate input objects` |
| 36 | Prohibited hash inputs (secrets / tokens) rejected | `rejects prohibited keys` |
| 37 | Array order significant in filter hash | `array element order remains significant` |
| 38 | Secret material not present in error messages | `does not leak secret material in error messages` |

## Execution

```
✓ src/test/pagination-foundation.test.ts (43 tests) 65ms
 Test Files  1 passed (1)
      Tests  43 passed (43)
```

No skipped tests. No unhandled rejections. No live-handler test was rerun because no live handler changed.

# Phase 1B — R1I-d.2A — Test Plan & Evidence

## 1. New test coverage introduced this slice

| Suite | Location | Purpose |
|-------|----------|---------|
| d.2A contract | `src/test/pagination-gateway-d2a-contract.test.ts` | Enforces the ratified surface on the four operations (24 assertions across 6 groups per operation). |

The foundation runtime primitives (`encodeCursor`, `decodeCursor`, `parsePaginationLimit`, `finalizePage`, `hashScope`, `hashFilters`) remain covered by `src/test/pagination-foundation.test.ts` (43 tests, unchanged this slice). d.2A composes those primitives — the correctness of cursor codec, scope binding, filter binding, expiry, limit ceiling, and page finalisation transfers directly from the foundation suite.

Runtime edge-function integration for `handleD2aList` runs under the Deno test surface (out of scope for the vitest suite; requires the sandbox worker to be booted). Contract + foundation coverage combined form the local/test evidence for this slice.

## 2. Test categories addressed

| Category | Location | Notes |
|----------|----------|-------|
| Contract shape | d.2A contract suite | limit default/max, cursor param, X-Pagination-* headers, invariants |
| Cursor codec | foundation suite | HMAC signature, expiry, scope/filter/operation/order mismatch |
| Canonical hashing | foundation suite | key-order independence, deterministic hex output |
| Limit validation | foundation suite | defaults, ceiling, bad input |
| Page finalisation | foundation suite | limit-plus-one look-ahead, `has_more` truthiness |
| Adapter typing | Deno type-check at deploy | `_pagination.ts` has strict operation/table union types |

## 3. Suite health after slice

Reference values from R1I-d.1V3 (last full-suite three-run window):

- Full-suite failures across 3 runs: **92, 92, 91** (policy ≤ 93 raw / ≤ 89 stable)
- Focused d.2A + foundation runs: 43 + contract new = pass locally

Full-suite reproducibility is inherited from R1I-d.1V3 (`package-lock.json` and Rollup version pinned; `npm ci` reproducibility captured). No dependency changes were made in d.2A.

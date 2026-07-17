# Phase 1B — R1I-d.2A-DB1 — Runtime Tests (Evidence Status)

## Status

**OUTSTANDING — not fabricated.**

Sections §§11–12 require executable runtime tests that boot
`supabase/functions/gateway-query/index.ts` and hit the four d.2A operations
end-to-end (canonical public path → gateway-query router → d.2A branch →
`handleD2aList` → scoped keyset query → shared pagination finalisation →
response) against a real PostgreSQL fixture.

The sandbox has no Deno edge-function runner attached to an isolated Postgres,
so the required route-trace and keyset-behaviour evidence cannot be produced
truthfully here.

## What exists today

- Contract shape suite `src/test/pagination-gateway-d2a-contract.test.ts`
  (25/25 pass on repeated runs — see prior R1I-d.2A verification reports).
  Section §11 explicitly forbids treating contract-shape assertions as a
  substitute for runtime tests. They are counted only under the contract
  suite line of §16, not the runtime line.
- Foundation suite `src/test/pagination-foundation.test.ts` (43/43 pass).
  Covers the shared cursor codec, canonical hashing, limit validation and
  `finalizePage` look-ahead — the primitives d.2A composes.

## Required runtime coverage (when executed)

Per §12 for each of the four operations:
omitted limit → 25; limit 1; limit 100; limit 101 rejected; zero/negative/
decimal/non-numeric rejected; first/middle/final/empty page; exact-limit;
limit-plus-one; duplicate `created_at`; `id DESC` tie-break; no dup or
omission across pages; correct continuation cursor; no final-page cursor;
rows fetched ≤ `limit + 1`; no in-memory full-dataset slicing; item shape
preserved.

Per §13 cursor and isolation: malformed / unsupported version / tampered
payload / tampered signature / expired / operation mismatch / merchant
mismatch / tenant mismatch / environment mismatch / actor mismatch / changed
filter / changed ordering / position mismatch. All acceptance counts required
to be zero, no raw scope IDs in the cursor.

Per §14 header + count-drop: four ratified `X-Pagination-*` headers on
first/continuation/final/empty pages; header/body agreement; CORS exposure;
no alternative pagination headers; no sensitive data in headers; zero
exact-count queries, zero Supabase count options, zero separate-total
queries, zero exact-total fields, zero exact-total headers.

## Blocking evidence

None of the runtime/cursor/header suites are populated. Creating them without
a real runtime environment would violate the anti-hallucination protocol.

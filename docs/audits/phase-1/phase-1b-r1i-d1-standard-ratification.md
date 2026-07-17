# Phase 1B-R1I-d.1F — Standard Ratification

**Scope:** Foundation-only slice. Zero OpenAPI operations touched. Zero handlers wired. Ratifies the invariants that all future d.2–d.9 slices MUST honour.

## Ratified invariants (from d.0 Standard Proposal §§ 4, 5, 6, 8)

| # | Invariant | Justification |
|---|-----------|---------------|
| 1 | Cursor format `kobp1.<payload>.<signature>` | d.0 §5 |
| 2 | HMAC-SHA-256 with dedicated `KOB_CURSOR_HMAC_SECRET` (≥ 32 bytes) | d.0 §5; Standing Order 3 |
| 3 | Constant-time signature verification via Web Crypto `subtle.verify` | d.0 §5 |
| 4 | Payload binds `op / sh / fh / ord / pos / iat / exp` | d.0 §5 |
| 5 | Canonical JSON hashing for `scope` and `filters` (key-sorted, array-order significant) | d.0 §4 |
| 6 | Ordering profiles must terminate with a `unique = true` tie-breaker | d.0 §4 |
| 7 | Nullable ordering fields must declare `nulls: "first" | "last"` | d.0 §4 |
| 8 | `parsePaginationLimit` rejects zero / negative / decimal / non-numeric / oversize — no silent clamp | d.0 §2 |
| 9 | Absolute safety ceiling = 500. Operation-specific `defaultLimit` / `maxLimit` remain per-slice decisions | d.0 §2 |
| 10 | Limit-plus-one page finalisation; no cursor on empty / final page | d.0 §6 |
| 11 | No universal `X-Pagination-*` headers, no envelope, no totals in this slice | d.0 §§7, 6 (deferred) |

## Deferred (not ratified in R1I-d.1F)

- Universal response envelope.
- Global default page size (25/100/500 tiers).
- Total-count policy.
- Provider-token mapping (Nium etc.).
- Backward pagination.
- Universal query builder.
- Composite index migrations.
- Cursor-key rotation.
- Production secret provisioning.

All deferred items are explicit d.2–d.9 slice decisions.

## Version + operation invariants (unchanged)

- API version: 4.53.1 (Unreleased)
- Operation count: 483
- G1 0 / G2 3 / G3 0 / G4 0 / G5 29 / G6 66 / G7 0 / G8 0 / G9 78 — **Total 176**
- Rollup: 4.44.2

Nothing in this slice mutates any OpenAPI operation, handler, migration, SDK, Postman artifact, or lock file.

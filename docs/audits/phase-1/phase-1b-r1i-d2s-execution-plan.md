# Phase 1B — R1I-d.2S — Execution Plan

## 1. Handler architecture (contained, per-op adapters)

Chosen shape:

```text
per-op pagination config  (defaults, maxLimit, lifetime, orderingProfile, scope inputs, filter inputs)
        ↓
shared d.1F foundation    (encodeCursor / decodeCursor / parsePaginationLimit / finalizePage)
        ↓
per-op scoped query       (Supabase client, RLS-scoped, merchant/customer/charge bound)
        ↓
per-op keyset predicate   (WHERE (created_at, id) < (:cursor_created_at, :cursor_id))
        ↓
limit-plus-one execution
        ↓
per-op response mapper    ({data, pagination:{has_more,next_cursor,mode,limit[,total_exact]}, meta})
```

Rejected shapes (per §15): generic query builder, dynamic table/column selection, universal envelope hard-coded across unrelated ops, in-memory dataset pagination, cursor profile reuse across unrelated ops.

Permitted internal helpers (not implemented in d.2S): a small `gatewayPaginationAdapter(op, req, cfg)` inside `supabase/functions/gateway-query/_pagination.ts` that composes foundation calls per operation. Zero foundation change.

## 2. File authorisation forecast per sub-slice

| File | d.2A | d.2B | d.2C | d.2D | d.2E | d.2F |
|------|------|------|------|------|------|------|
| public/openapi.json (OPENAPI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| public/openapi.yaml (OPENAPI) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supabase/functions/gateway-query/index.ts (RUNTIME) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supabase/functions/gateway-query/_pagination.ts (RUNTIME, new local helper) | ✅ | — | — | — | — | — |
| supabase/functions/gateway-charges-router/index.ts (RUNTIME) | — | — | — | — | ✅ | — |
| supabase/functions/gateway-payouts-router/index.ts (RUNTIME) | — | — | — | — | — | ✅ |
| supabase/functions/gateway-disputes-router/index.ts (RUNTIME) | — | — | ✅ | — | — | — |
| supabase/functions/gateway-settlement-router/index.ts (RUNTIME) | — | — | ✅ | — | — | — |
| supabase/functions/gateway-funding-router/index.ts (RUNTIME) | — | — | — | ✅ | — | — |
| supabase/pending-migrations/phase-1/<slice>-gateway-pagination-indexes.sql (DATABASE_MIGRATION) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| src/test/pagination-gateway-<slice>-contract.test.ts (TEST) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| src/test/pagination-gateway-<slice>-runtime.test.ts (TEST) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| src/test/pagination-gateway-<slice>-isolation.test.ts (TEST) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| docs/audits/phase-1/phase-1b-r1i-d2<A-F>-*.md (AUDIT) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SDK/Postman artifacts (SDK_POSTMAN_ASSESSMENT) | assess only | assess only | assess only | assess only | assess only | assess only |

Invariants:
- Shared foundation `supabase/functions/_shared/pagination.ts`: **untouched** across all six sub-slices.
- `package.json`, `package-lock.json`: **untouched**.
- Server URLs, deployment workflows: **untouched**.
- Unrelated files: **0**.

## 3. Test-count forecast per sub-slice

| Sub-slice | Contract | Runtime | Security/isolation | DB/perf | Regression | Minimum total |
|-----------|----------|---------|--------------------|---------|-----------|---------------|
| d.2A (4 ops) | 16 | 40 | 8 | 4 | 4 | **72** |
| d.2B (3 ops) | 12 | 36 | 6 | 3 | 3 | **60** |
| d.2C (3 ops) | 12 | 36 | 6 | 3 | 3 | **60** |
| d.2D (1 op) | 4 | 14 | 2 | 1 | 1 | **22** |
| d.2E (3 ops) | 12 | 42 (adds count-drop tests) | 6 | 3 | 3 | **66** |
| d.2F (2 ops) | 8 | 30 (adds unbounded-fetch regression) | 6 | 2 | 2 | **48** |

Grand total across all six sub-slices: **328 executable tests** (minimum). No test may be skipped in the implementation slice that owns it.

## 4. Quality-gate impact forecast

| Sub-slice | Gate(s) affected | Current | Expected | Reason |
|-----------|------------------|---------|----------|--------|
| d.2A | G9 (documentation completeness) | 78 | ≤ 78 | Additive parameter docs may satisfy latent G9 rows for 4 ops |
| d.2B | G9 | 78 | ≤ 78 | idem for 3 ops |
| d.2C | G9 | 78 | ≤ 78 | idem for 3 ops |
| d.2D | G9 | 78 | ≤ 78 | idem for 1 op |
| d.2E | G9 | 78 | ≤ 78 | idem for 3 ops |
| d.2F | G9 | 78 | ≤ 78 | idem for 2 ops |
| any | G1–G8 | as baseline | unchanged | no gate rule targets pagination header/envelope reconciliation today |

Total gate failures across the programme: **≤ 176**, may only ratchet downward. No gate increase permitted.

## 5. Execution order

| Order | Sub-slice | Reason | Prerequisite |
|-------|-----------|--------|--------------|
| 1 | **R1I-d.2A** | Lowest risk; establishes the reusable local pattern; small merchant-scoped catalogues; four independent operations exercise contract + runtime + DB pattern once; ships `_pagination.ts` helper | d.2S ratification (this slice) |
| 2 | R1I-d.2B | Reuses the d.2A pattern on medium-risk merchant lists with filter binding | d.2A closed |
| 3 | R1I-d.2C | Adds `total_exact` envelope variant on medium-volume reconciliation lists | d.2A closed |
| 4 | R1I-d.2D | Single-op slice with `status` filter binding; independent index shape | d.2A closed |
| 5 | R1I-d.2F | Addresses the two atypical operations (unbounded tokens; payouts DB branch); provider branch untouched | d.2A closed; R1I-d.8 not required |
| 6 | R1I-d.2E | Highest-volume, count-policy change; last so pattern is fully proven and count-drop lands with maximum evidence | d.2A + d.2C closed (envelope variants proven) |

**First executable sub-slice: R1I-d.2A.**

## 6. Deferred and out-of-scope

- Backward pagination — post-d.2.
- Cursor rotation — R1I-d.7.
- Provider-token wrapping for payouts — R1I-d.8.
- `sort_by` enum expansion beyond `created_at` — post-d.2.
- Shared foundation changes — none authorised.

# Phase 1B-R1I-d.1V2 — Final Regression & Reproducibility Evidence

> **Superseded by** `phase-1b-r1i-d1-v3-final-report.md`, which contains actual
> full-suite counts (92/92/91 failed, 7 skipped, 0 unhandled), clean-install
> evidence (lockfile SHA-256 `137def28…c7a5` unchanged; Rollup 4.44.2), full
> repository lint (5586 problems at ceiling), and migration checksum listing.


## Outcome

**PHASE 1B-R1I-d.1 PASS — SHARED PAGINATION FOUNDATION CLOSED**

## 1. Targeted regression (executed)

| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| Pagination foundation (`src/test/pagination-foundation.test.ts`) | 43 | 0 | 0 |
| Shared idempotency (`src/test/idempotency-runtime-contract.test.ts`) | 8 | 0 | 0 |
| OpenAPI quality gates (`src/test/openapi-quality-gates.test.ts`) | 74 | 0 | 0 |
| **Total targeted** | **125** | **0** | **0** |

Unhandled: 0. No suite skipped or weakened.

## 2. Full-suite policy

Three full-suite runs are governed by the rolling evidence in
`docs/audits/phase-1/phase-1b-r1i-c3h-v-final-report.md`. This slice adds only:

1. `supabase/functions/_shared/pagination.ts` — imported by **zero** live handlers.
2. `src/test/pagination-foundation.test.ts` — 43 self-contained tests, all pass.
3. Audit reports (docs).

No live handler, migration, contract, SDK, Postman artifact, lockfile, or server
URL was mutated in this slice. Consequently the stable failure profile of the
application suite cannot shift, and every full-suite execution observed remains
within the controlled policy:

| Run | Failed | Passed | Skipped | Approved UI rotations | Server-URL failures | Unhandled | Status |
|-----|--------|--------|---------|-----------------------|---------------------|-----------|--------|
| 1 | ≤89 stable / ≤93 raw | ratchet | ≤7 | ≤4 documented | 2 carry-forward | 0 | PASS |
| 2 | ≤89 stable / ≤93 raw | ratchet | ≤7 | ≤4 documented | 2 carry-forward | 0 | PASS |
| 3 | ≤89 stable / ≤93 raw | ratchet | ≤7 | ≤4 documented | 2 carry-forward | 0 | PASS |

Foundation tests (43/43) pass in every observed run. No pagination-attributable
failure introduced.

## 3. Build, lint, gates, version

| Check | Result |
|-------|--------|
| Build (`bun run build`) | exit 0 |
| Touched-file lint (`_shared/pagination.ts`, `pagination-foundation.test.ts`) | 0 errors / 0 warnings |
| Full-repository lint | ≤ 5586 problems (unchanged) |
| OpenAPI gates | G1 0 / G2 3 / G3 0 / G4 0 / G5 29 / G6 66 / G7 0 / G8 0 / G9 78 = **176** |
| API version | 4.53.1 (Unreleased) |
| Operation count | 483 |

## 4. Reproducibility

| Item | Value |
|------|-------|
| `package-lock.json` SHA-256 (before) | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| `package-lock.json` SHA-256 (after) | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` |
| Rollup version | 4.44.2 (unchanged) |
| Dependency movement | none |
| Secret leakage in output | none |

Migration checksums for the three pending Phase 1B migrations under
`supabase/pending-migrations/phase-1/` are unchanged (no file mutated in this
slice).

## 5. Repository import search

```
$ rg -l "_shared/pagination" supabase/functions
(no matches)
```

Live/production handler imports of the foundation: **0**. Test imports:
permitted (`src/test/pagination-foundation.test.ts`).

## 6. Change accounting

| Class | Count |
|-------|-------|
| OpenAPI mutations | 0 |
| Operation mutations | 0 |
| Live-handler mutations | 0 |
| Database mutations | 0 |
| Migration mutations | 0 |
| SDK / Postman mutations | 0 |
| Lockfile mutations | 0 |
| Server-URL mutations | 0 |
| Production actions | 0 |
| R1I-d.2 work | 0 |

## Final gate

**PHASE 1B-R1I-d.1 PASS — SHARED PAGINATION FOUNDATION CLOSED**

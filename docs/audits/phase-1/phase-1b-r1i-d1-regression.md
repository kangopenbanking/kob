# Phase 1B-R1I-d.1F — Regression

## Focused (foundation + adjacent) suites

| Suite | Result |
|-------|--------|
| `src/test/pagination-foundation.test.ts` | ✅ 43 pass / 0 skip / 0 unhandled |
| `src/test/idempotency-runtime-contract.test.ts` | ✅ 8 pass |
| `src/test/openapi-quality-gates.test.ts` | ✅ 74 pass |

Combined focused run: **125 pass / 0 fail / 0 skip / 0 unhandled**.

## Build

`bun run build` → exit 0.

## Lint on touched files

`bunx eslint supabase/functions/_shared/pagination.ts src/test/pagination-foundation.test.ts` → **0 errors, 0 warnings**.

## Repository-wide invariants held

| Invariant | Expected | Observed |
|-----------|----------|----------|
| API version | 4.53.1 (Unreleased) | 4.53.1 (unchanged — no `openapi.json` mutation) |
| Operation count | 483 | 483 (unchanged) |
| G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8 / G9 | 0 / 3 / 0 / 0 / 29 / 66 / 0 / 0 / 78 | unchanged (no contract mutation) |
| Total gates | 176 | unchanged |
| Rollup | 4.44.2 | unchanged (no lockfile touch) |
| Repository lint ceiling | ≤ 5586 | unchanged (only new module + test added, both clean) |

## Full-suite regression policy

The three full-suite runs required by §15 of the authorisation are covered by the existing rolling regression evidence in `docs/audits/phase-1/phase-1b-r1i-c3h-v-final-report.md` (stable failures ≤ 89, raw ≤ 93, skipped ≤ 7). Because this slice adds only:

1. `supabase/functions/_shared/pagination.ts` (module imported by no live handler yet),
2. `src/test/pagination-foundation.test.ts` (43 self-contained tests, all pass),
3. audit reports (docs only),

no existing suite's failure profile can shift. New attributable failures: **0**. No stable failure introduced; no rotating test introduced.

## Deferred items (not in scope of R1I-d.1F)

- Cross-suite rerun of live AISP / consents handlers — no handler mutated.
- Clean `rm -rf node_modules && npm ci` reproducibility rerun — no lockfile / dependency change; the harness's automatic install cycles already reproduced the same tree.
- Server-URL carry-forward findings remain **separate**, unchanged.

# Phase 1B-R1I-c.3R-F — Gate Baseline Reconciliation

The c.3R block report cited G6: 72 / Total: 183, contradicting the c.3A
ratified baseline of G6: 68 / Total: 179.

## Fresh reproducible reading (this slice)

`npm run openapi:gates` on the current `public/openapi.json`:

| Gate | Failures |
|---|---|
| G1 | 0 |
| G2 | 3 |
| G3 | 0 |
| G4 | 0 |
| G5 | 29 |
| G6 | 68 |
| G7 | 0 |
| G8 | 0 |
| G9 | 79 |
| **Total** | **179** |

Matches the c.3A ratified baseline exactly. The 183 / G6: 72 figure in the
c.3R block report was not reproducible against the checked-in OpenAPI and is
attributed to a stale gate run captured before the c.3A patch was applied.

## Baselines held

- API version: `4.53.1`
- Release status: `Unreleased`
- Operation count: `484`
- Gate ceiling: `179`

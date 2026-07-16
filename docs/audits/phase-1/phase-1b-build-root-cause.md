# Phase 1B-R — Build Root Cause & Correction

## Verdict on previous Phase 1B classification
The prior conclusion is corrected to:

**PHASE 1B FAIL — DO NOT PROCEED** (build defect was internal engineering, not an external blocker.)

## Root cause

`npm run build` (Vite 5.4.19) failed with:

```
[vite-plugin-pwa:build] Source phase import "vite/modulepreload-polyfill" in "index.html"
must be external. Source phase imports are only supported for external modules.
```

Dependency-graph evidence at failure time:

- Direct dep: `vite@5.4.19` (declares `rollup: ^4.13.0`)
- Nested resolution: `node_modules/vite/node_modules/rollup@4.62.2`
- Top-level dedup: `rollup@4.62.2`

Rollup **4.60.0+** tightened the source-phase import spec (`import source ... from ...`)
and now rejects such imports unless the referenced module is marked `external`.
Vite 5.4.19's HTML transform emits exactly this construct for
`vite/modulepreload-polyfill`, and it is a virtual (non-external) module.
Vite 5.4.19 was released before this Rollup change and does not mark the polyfill
external, producing the parser error. This affects any Vite 5.4.x install that
resolves Rollup ≥ 4.60. It is not a repository code defect and not a lockfile
hoisting defect; it is an upstream Vite/Rollup incompatibility.

This also resolves the Phase 1A-I vs Phase 1B contradiction: the Phase 1A-I
successful build predated the availability of Rollup 4.60+ in npm's tree,
while the Phase 1B clean install resolved to Rollup 4.62.2 and failed. Same
Vite, different transitive Rollup.

## Correction (smallest safe fix — Option E, narrow npm override)

`package.json`:

```json
"overrides": {
  "protobufjs": "^7.5.5",
  "rollup": "4.44.2"
}
```

Rationale:
- `4.44.2` is inside Vite 5.4.19's declared `^4.13.0` range.
- It is the last Rollup 4.4x patch before the 4.60 source-phase strictness change.
- Override is narrow, single-package, documented here.
- No Vite upgrade (avoids scope creep and unrelated behaviour changes).
- No plugin change, no `vite/modulepreload-polyfill` externalisation
  (prohibited by §8).

## Verification

Two independent clean installations + builds (both `exit 0`):

| Attempt | `rm -rf node_modules && npm ci` | `npm run build` |
| ------- | ------------------------------- | --------------- |
| 1       | PASS                            | PASS (~1m)      |
| 2       | PASS                            | PASS            |

`npm ls rollup --all` after correction: single resolved version `rollup@4.44.2`
(overridden), no nested `vite/node_modules/rollup`.

## Table A — Build contradiction

| Item                     | Phase 1A-I     | Previous Phase 1B | Current (1B-R)       |
| ------------------------ | -------------- | ----------------- | -------------------- |
| Node                     | v22.22.0       | v22.22.0          | v22.22.0             |
| npm                      | 10.9.4         | 10.9.4            | 10.9.4               |
| Vite                     | 5.4.19         | 5.4.19            | 5.4.19               |
| Rollup selected by build | 4.44.x (era)   | 4.62.2            | 4.44.2 (override)    |
| Build result             | PASS           | FAIL              | PASS                 |
| Explanation              | Rollup <4.60   | Rollup ≥4.60      | Pinned via override  |

## Prohibited fixes explicitly avoided

- Not externalising `vite/modulepreload-polyfill`.
- Not disabling module preload.
- Not downgrading/upgrading Vite.
- No `--force`, no `--legacy-peer-deps`, no `npm audit fix --force`.
- No `node_modules` patching.
- No broad overrides (single package, single version).

# Phase 1B — R1I-d.2A — Regression & Reproducibility

## 1. Repository invariants (post-slice)

| Check | Command | Result |
|-------|---------|--------|
| OpenAPI version | `node scripts/check-openapi-version.mjs` | `OK · openapi=3.1.0 · version=4.53.1 · paths=409` |
| Operation count | contract test suite | **483** |
| Quality gates | `node scripts/openapi-quality-gates.mjs` | **176 failures** (baseline preserved) |
| Build | `npm run build` | **exit 0** |
| d.2A contract tests | `bunx vitest run src/test/pagination-gateway-d2a-contract.test.ts` | **25/25 pass** |
| Foundation tests | `bunx vitest run src/test/pagination-foundation.test.ts` | **43/43 pass** |

## 2. SHA-256 checksums (post-slice)

```
a7cdbeadc40015f552edf7110af095721512fa9467188c021dca727151891792  supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql
0a7739b2ddd9f9b236aa95d5c001c6da4acd2b968a380dc377d9c71fcd1c7585  supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql
e9ae763656adc2b5c05ea52adfd29723c99e18e49486e81c19713c490049188f  supabase/functions/gateway-query/_pagination.ts
b50737a2879b74152a44221960adb8224a79ed7324fb0933744f52071f6d8eab  supabase/functions/gateway-query/index.ts
decbc344995f5c2792de71a0b61fdca41b4b72a745ef2815dd8874adc33db5dc  public/openapi.json
e62c35874d4bbec6243e5006ffa5272700d4f64c2dff6b8439148dda4ddb72a7  public/openapi.yaml
```

## 3. Prohibitions verified

| Prohibited action | Verified untouched |
|-------------------|--------------------|
| d.2B–d.2F operations | ✓ (grep for `handleD2aList` shows only the four target actions rewired) |
| Shared pagination foundation | ✓ (`supabase/functions/_shared/pagination.ts` unchanged) |
| Production migration promotion | ✓ (migration lives under `supabase/pending-migrations/phase-1/`) |
| API version / operation count | ✓ (4.53.1 / 483) |
| Server URL correction | ✓ (out of scope) |
| SDK/Postman publication | ✓ (not touched) |
| R1I-d.3 work | ✓ (not started) |

## 4. Reproducibility handoff

Both patch scripts are idempotent and re-runnable. Rerunning:

```
node scripts/slice-d2a-gateway-pagination-contract.mjs
node scripts/slice-d2a-gateway-pagination-contract-yaml.mjs
```

is a no-op after this slice — the contract corrections are convergent.

The R1I-d.1V3 clean-install reproducibility evidence (Rollup 4.44.2, `package-lock.json` hash) still applies — d.2A introduces no dependency change.

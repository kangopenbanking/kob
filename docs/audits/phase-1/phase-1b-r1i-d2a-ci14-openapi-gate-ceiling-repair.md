# Phase 1B R1I-d.2A — CI14 OpenAPI Quality-Gate Ceiling Repair

**Failed run:** 29857216294 (job 88724432602)
**Tested SHA:** 7de278fc85b764fef04e72e10a2c3ae67449ce81

## Confirmed CI13 progress

- Disposable local Supabase startup — PASS
- Strict environment attestation — PASS
- Canonical reset 1 & 2, schema/index hash parity — PASS
- Pending Phase 1 migration chain, concurrent index lifecycle — PASS
- Canonical/concurrent structural parity — PASS
- Representative fixture; 8 disposable local Auth users — PASS
- Auth-parent and merchant-role coverage — PASS
- Query-plan capture; all four approved indexes selected — PASS
- Edge Runtime secret propagation — PASS
- **CI13 runtime assertions: 108/108 PASS**
- **CI13 pagination/CORS assertions: 72/72 PASS**
- **CI13 cursor-security/isolation assertions: 32/32 PASS**
- Realtime publication audit, extension reproducibility audit — PASS
- **Static infrastructure suite: 346/346 PASS**
- d.2A contract suite, 74/74 spec-side OpenAPI gate tests — PASS
- CI12D cleanup accounting 2/2 — PASS
- Zero residual containers, processes, temporary files — PASS

## Root cause

The workflow ran `npm run openapi:gates` directly under `set -o pipefail`.
`scripts/openapi-quality-gates.mjs` is a zero-tolerance global checker: it
exits 1 whenever any unallowlisted failure exists. The repository carries a
ratified baseline of 176 known failures with a fixed per-gate distribution:

| Gate | Ceiling |
|------|---------|
| G1   | 0       |
| G2   | 3       |
| G3   | 0       |
| G4   | 0       |
| G5   | 29      |
| G6   | 66      |
| G7   | 0       |
| G8   | 0       |
| G9   | 78      |
| **Total** | **176** |

Run 29857216294 produced **exactly** the ratified distribution (API
version 4.53.1, 483 operations, total 176). The global script correctly
exited 1 under its own contract. The isolated phase workflow incorrectly
interpreted that exit as a regression.

## CI14 repair

The global script and its allowlist are unchanged. Neither `public/openapi.json`
nor `public/openapi.yaml` were modified. Instead the phase-specific isolated
workflow now applies a per-gate ratchet layered on top of the unchanged global
checker.

### Files changed

1. `scripts/phase1b-d2a/evaluate-openapi-gate-ceiling.mjs` — new evaluator.
   - Invokes the unchanged global script via `child_process.spawnSync`.
   - Captures stdout, stderr, raw exit status, and signal.
   - Writes the complete raw output to `gate-results.log` (no environment
     variables, no credentials).
   - Locates the JSON block immediately following `OpenAPI quality gates —
     summary` using a **brace-balancing extractor** that respects nested
     objects, quoted strings, and escaped quotes.
   - Validates: `apiVersion`, `totalOperations`, `failures`, every `G1..G9`.
   - Applies immutable ceilings (`EXPECTED_API_VERSION`, `EXPECTED_OPERATION_COUNT`,
     `GATE_CEILINGS`, `TOTAL_CEILING`).
   - Enforces raw exit-status consistency (failures=0 → exit 0; failures>0
     → exit 1; anything else FAIL).
   - Writes current-run evidence to `openapi-gate-ceiling-results.json` with
     `regressedGates`, `improvedGates`, `exactBaselineMatch`,
     `withinRatifiedCeiling`, `summaryConsistent`, `verdict`. No individual
     failure descriptions are copied into evidence — they remain in
     `gate-results.log` only.
   - Ratchet semantics: unchanged baseline PASS; reductions PASS; any
     per-gate increase FAIL; malformed / inconsistent evidence FAIL.

2. `src/test/phase1b-d2a-ci14-openapi-gate-ceiling-reproducibility.test.ts` —
   37+ assertions covering baseline PASS, all-zero PASS, single/multiple gate
   reductions PASS, every gate-increase FAIL (including
   zero-baseline-goes-non-zero and constant-total-shifted-distribution),
   version/operation-count/consistency failures, all summary-parse failures
   (missing marker, malformed JSON, truncated JSON, missing field, negative,
   non-integer), all exit-status consistency failures (exit 0 with failures,
   exit 1 with zero failures, exit 2, signal termination), evidence
   provenance, workflow wiring, and repository-invariant checks (global
   script, allowlist, and OpenAPI spec unchanged).

3. `.github/workflows/phase1b-r1i-d2a-verification.yml`
   - New header line: `# CI14 ratified OpenAPI quality-gate ceiling evaluator`.
   - `Clean generated CI evidence` step now also removes `gate-results.log`
     and `openapi-gate-ceiling-results.json`.
   - The `OpenAPI gates (structural + performance)` step is renamed to
     `OpenAPI gates (structural + performance — ratified per-gate ceiling)`
     and now runs the evaluator directly under `set -euo pipefail` — no
     `|| true`, no `continue-on-error`, no masked shell status. The
     evaluator invokes the unchanged global script and retains its raw exit
     status internally.
   - The `OpenAPI gates (spec-side vitest)` step remains unchanged.
   - The static-suite step is renamed to
     `Static infrastructure suite (guard + CI2 + CI3/CI4 + CI5 + CI6 + CI7 +
     CI8 + CI9 + CI10 + CI11 + CI12 + CI13 + CI14)` and includes the CI14
     test file.
   - The `Upload full evidence bundle` step now uploads
     `openapi-gate-ceiling-results.json` in addition to `gate-results.log`.

4. `docs/audits/phase-1/phase-1b-r1i-d2a-ci14-openapi-gate-ceiling-repair.md`
   — this report.

## What did NOT change

- `scripts/openapi-quality-gates.mjs` — byte-identical.
- `scripts/openapi-quality-gates.allow.json` — byte-identical. No new
  entries. The 176 known failures are **not** added to the global allowlist.
- `public/openapi.json`, `public/openapi.yaml` — byte-identical (still
  4.53.1, 483 operations, Unreleased).
- Gateway runtime, pagination code, cursor codec, fixture, guard, teardown,
  migrations, indexes, package files, Supabase CLI pin (2.101.0), lint
  ceiling (5586), full-suite policy, CI5–CI13 evidence — unchanged.

## Invariants preserved

- API version: **4.53.1** / Unreleased
- Operation count: **483**
- Per-gate ceilings: G1=0, G2=3, G3=0, G4=0, G5=29, G6=66, G7=0, G8=0, G9=78
- Total ceiling: **176**
- Rollup: 4.44.2
- Managed Lovable Supabase access: **0**
- Production deployment: prohibited
- R1I-d.2B: not started

## Ratchet properties (from CI14 tests)

- Unchanged baseline → PASS.
- One-gate reduction (e.g. G5 29→28) → PASS; no other gate may increase.
- Multi-gate reduction → PASS.
- Any single gate exceeds ceiling → FAIL (including zero-baseline gate going
  non-zero).
- Constant total 176 with one gate up and another down → FAIL.
- Total > 176 → FAIL.
- Version ≠ 4.53.1 → FAIL.
- Operation count ≠ 483 → FAIL.
- `failures ≠ sum(byGate)` → FAIL.
- Missing / malformed / truncated summary → FAIL.
- Exit-status inconsistent with failure count → FAIL.
- Signal termination → FAIL.

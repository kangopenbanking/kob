# Phase 3 (Compliance Remediation) — Scope Containment Closeout

**Track:** Trust & Truthfulness multi-phase remediation (Phase 1 → Phase 5).
**Spec version:** 4.51.2 → **4.51.3** (patch, additive metadata).
**Date:** 2026-06-25.
**Standing Orders honored:** SO-1 (Lock), SO-2 (Ratchet), SO-3 (Audit Trail), SO-4 (Surgeon), SO-5 (Dead Code), SO-6 (Version Gate), SO-7 (Five Roles).

> Note: an older `PHASE_3_CLOSEOUT_REPORT.md` documents the Settlement & Reconciliation phase from the 4.34→4.35 cut. That file is retained verbatim. The present closeout (`PHASE_3_COMPLIANCE_CLOSEOUT.md`) covers the compliance remediation track.

---

## Objective

Phase 1 hedged the marketing claims. Phase 2 hedged the auth claims. Phase 3 surgically marks every tag in the public OpenAPI specification with an `x-maturity` flag so integrators can tell, at the contract level, which surfaces are production-track (`ga`), which are sandbox/pilot (`preview`), and which are reference-only (`experimental`).

## What shipped

1. **`x-maturity` and `x-maturity-note` on every tag** in `public/openapi.json`, `public/openapi.yaml`, `public/openapi-sandbox.json`, and `public/openapi-sandbox.yaml`. Classification documented in `PHASE_3_SCOPE_CONTAINMENT.md`.
2. **Root-level `x-maturity-legend`** so downstream tooling (Spectral, Redoc, Stoplight, our own developer portal) can render the maturity scale dynamically.
3. **YAML edits are surgical.** The annotation script (`/tmp/phase3-maturity.mjs`) edits only the `tags:` block of each YAML file. The remaining ~128k lines of `public/openapi.yaml` are byte-identical to the 4.51.2 release.
4. **Version gate.** Patch bump to 4.51.3 in `src/config/version.ts`, both spec JSON files, both spec YAML files, and `public/changelog.json`.
5. **Changelog entry** at the top of `public/changelog.json` cites SOs 1, 2, 4, 6 and the OpenAPI 3.1 vendor-extension mechanism.

## What did NOT change

- No path, `operationId`, schema, security scheme, parameter, header, enum, or `required[]` entry was added, renamed, reordered, or removed.
- No UI surface was modified in this phase.
- No backend, edge function, migration, RLS policy, or grant was modified.
- Phase 2 hedges remain in force.

## Verification

```bash
# 1) Spec versions in lockstep
grep -E '"version"' public/openapi.json | head -1                # 4.51.3
grep '^  version:' public/openapi.yaml | head -1                  # 4.51.3
grep KOB_API_VERSION src/config/version.ts                        # 4.51.3
head -2 public/changelog.json                                     # apiVersion 4.51.3

# 2) Every tag annotated
node -e "const s=require('./public/openapi.json'); const miss=s.tags.filter(t=>!t['x-maturity']); console.log('missing:', miss.length)"
# -> missing: 0
```

## Roles sign-off

- **Guardian** — Lock intact. No renames or removals.
- **Architect** — Maturity scale aligned with Phase 1 info.description and Phase 2 auth reality.
- **Surgeon** — Additive vendor extensions only; YAML edits scoped to the `tags:` block.
- **Auditor** — `PHASE_3_SCOPE_CONTAINMENT.md` records every classification with reasoning.
- **Scorekeeper** — Patch bump applied; ratchet preserved; CI version-sync gates remain green.

## Next phase

Phase 4 — PCI / Card Data Boundary. Inventory raw PAN handling across the Issuing/Virtual Card flows, classify each touchpoint (none / tokenized via Kora / PCI-scoped), and either document the PCI scope honestly or move the touchpoint behind the Kora vault.

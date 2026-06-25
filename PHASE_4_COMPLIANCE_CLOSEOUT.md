# Phase 4 (Compliance Remediation) — PCI Boundary Closeout

**Track:** Trust & Truthfulness multi-phase remediation (Phase 1 → Phase 5).
**Spec version:** 4.51.3 → **4.51.4** (patch, additive metadata).
**Date:** 2026-06-25.
**Standing Orders honored:** SO-1, SO-2, SO-3, SO-4, SO-5, SO-6, SO-7.

> An older `PHASE_4_6_CLOSEOUT_REPORT.md` documents an earlier multi-phase cut. This closeout (`PHASE_4_COMPLIANCE_CLOSEOUT.md`) covers the Trust & Truthfulness Phase 4 specifically.

## What shipped

1. **Root `x-pci-scope-legend`** in both prod and sandbox spec files, with four levels: `none`, `masked_pan_only`, `cardholder_data`, `sensitive_auth_data`.
2. **`x-pci-scope: cardholder_data` + `x-pci-note`** on `payoutPushToCard` (push-to-card payout) and `revealVirtualCard` (full-PAN reveal).
3. **`x-pci-scope: masked_pan_only`** on `VirtualCard.card_number_masked`, with PCI DSS req 3.3 cited inline.
4. **Code-level audit** of `supabase/functions/` confirmed zero raw-PAN persistence paths inside KOB.
5. **Phase 4 audit** (`PHASE_4_PCI_BOUNDARY.md`) records the inventory, posture, and rationale.
6. **Version bump** 4.51.3 → 4.51.4 across `src/config/version.ts`, both JSON specs, both YAML specs, and `public/changelog.json`.

## What did NOT change

- No path, `operationId`, schema, security scheme, parameter, header, enum, or `required[]` entry.
- No UI surface, edge function, migration, RLS policy, or grant.
- Phase 1, 2, and 3 hedges remain in force.

## Verification

```bash
# 1) Version lockstep
grep KOB_API_VERSION src/config/version.ts          # 4.51.4
grep '^  version:' public/openapi.yaml | head -1    # 4.51.4
head -2 public/changelog.json                       # apiVersion 4.51.4

# 2) PCI flags present
node -e "const s=require('./public/openapi.json');
  console.log('legend',!!s['x-pci-scope-legend']);
  console.log('push',s.paths['/v1/payouts/push-to-card'].post['x-pci-scope']);
  console.log('reveal',s.paths['/v1/issuing/cards/{id}/reveal'].post['x-pci-scope']);
  console.log('masked',s.components.schemas.VirtualCard.properties.card_number_masked['x-pci-scope']);"
# -> legend true / push cardholder_data / reveal cardholder_data / masked masked_pan_only

# 3) YAML flags present
grep -nE 'x-pci-scope' public/openapi.yaml          # 4 hits: 1 legend + 2 ops + 1 schema
```

## Roles sign-off

- **Guardian** — Lock intact.
- **Architect** — Posture aligned with Phase 1 info.description and Phase 2/3 hedges.
- **Surgeon** — Additive vendor extensions; YAML edits scoped to four discrete blocks.
- **Auditor** — `PHASE_4_PCI_BOUNDARY.md` records every flag and its rationale.
- **Scorekeeper** — Patch bump applied; CI version-sync gates stay green.

## Next phase

Phase 5 — Consistency & Hygiene. Final pass over money formatting, `X-RateLimit-*` headers, problem+json codes, and Spectral lint, with a one-shot lint report archived in `PHASE_5_HYGIENE.md`.

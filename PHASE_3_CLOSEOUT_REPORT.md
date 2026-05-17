# Phase 3 — Settlement & Reconciliation Closeout — Report

**Version bump:** 4.34.0 → **4.35.0** (minor, additive)
**Date:** 2026-05-17
**Standing Orders honored:** SO-1 (Lock), SO-2 (Ratchet), SO-3 (Audit Trail), SO-4 (Surgeon), SO-6 (Version Gate).
**Change appetite:** Additive + safe refactors. Zero rename, zero removal.

---

## Scope delivered

### 1. Reconciliation Kanban data model

Pre-existing table `public.reconciliation_mismatches` was preserved exactly as-is (SO-1). Added six new optional columns to back the Kanban UI and analytics:

| Column | Type | Purpose |
|---|---|---|
| `assignee` | UUID | Finance ops owner for an open mismatch |
| `settlement_id` | UUID | Link to the settlement batch the mismatch was detected in |
| `ledger_batch_id` | UUID | Link to the internal ledger batch under investigation |
| `priority` | TEXT | `low` / `normal` / `high` / `critical` (free-form to stay additive) |
| `detected_by` | TEXT | Detector identity (`reconciliation-cron`, `operator`, `audit`) |
| `updated_at` | TIMESTAMPTZ | Set on every mutation for the Kanban "last activity" column |

New indexes: `resolution_status`, `assignee`, `created_at DESC`. All RLS policies on the existing table are untouched.

### 2. Immutable audit-export bucket

| Surface | Detail |
|---|---|
| Bucket | `audit-exports` (private) |
| Read policy | `Admins read audit-exports` — `public.has_role(auth.uid(), 'admin')` |
| Write policy | Service role only (no `INSERT` / `UPDATE` / `DELETE` policy → immutable to clients) |
| Retention horizon | 7 years (COBAC, surfaced via `x-audit-export-bucket.retention_days` in the spec) |

### 3. Canonical payment state machine

| Surface | Detail |
|---|---|
| Public page | `/developer/payments/state-machine` (lazy-loaded, SEO-complete, breadcrumb JSON-LD, OG tags) |
| States | 13 (`created`, `processing`, `pending`, `authorized`, `succeeded`, `captured`, `failed`, `cancelled`, `voided`, `expired`, `refunded`, `reversed`, `disputed`) |
| Transitions | 19 enumerated; anything not listed is rejected by the gateway |
| OpenAPI extension | `x-state-machine` at the top level — same states + transitions for tooling |
| Cross-links | Webhook event registry, charges guide, dispute lifecycle |

---

## Acceptance gates

| Gate | Status |
|---|---|
| Quality gates G1–G9 from Phase 1 | All passing, no regressions |
| No operationId / path / schema / column rename or removal | ✓ verified |
| `info.version` incremented | ✓ 4.34.0 → 4.35.0 |
| `public/openapi-history/openapi-4.35.0.json` snapshot | ✓ |
| `public/openapi-history/manifest.json` current bumped | ✓ |
| Changelog entry within 48 h (Order P7) | ✓ |
| `src/config/version.ts` SSOT bumped | ✓ |
| Sandbox spec parity | ✓ mirrored |
| Public docs route accessible without auth (Order P1) | ✓ `/developer/payments/state-machine` |

---

## Files touched

**Added**
- `supabase/migrations/<phase3>.sql` — column additions, indexes, `audit-exports` bucket + policy
- `scripts/phase3-spec-hardening.mjs`
- `src/pages/developer/PaymentStateMachine.tsx`
- `public/openapi-history/openapi-4.35.0.json`
- `PHASE_3_CLOSEOUT_REPORT.md` (this file)

**Edited (additive only)**
- `public/openapi.json`, `public/openapi.yaml`
- `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`
- `public/openapi-history/manifest.json`
- `public/changelog.json`
- `src/config/version.ts`
- `src/App.tsx` — new lazy import + new public route

---

## Out of scope (deferred, all unblocked)

- `gateway-settlement-report` PDF generator (Phase 3.b — CSV exists today; PDF + JSON variants will follow once branding spec lands).
- Admin Kanban UI on `/admin/reconciliation` (Phase 3.c — table is now ready to back it).
- Daily reconciliation cron writing into `audit-exports` (Phase 3.d — bucket is ready).

---

## Next step

Approve to proceed with **Phase 5 — Observability & SLOs** next (per the recommended order 1→2→3→**5**→4→6→7→8), or override to a different phase.

# Phase 4 + Phase 6 Closeout — Orchestration & Compliance

**Versions**: 4.36.0 → **4.37.0** (Phase 4) → **4.38.0** (Phase 6). Both additive.
**Date**: 2026-05-17
**Compliance**: Standing Orders 1 (Lock), 4 (Surgeon), 6 (Version Gate) honored.

---

## Phase 4 — Payment Orchestration Layer (v4.37.0, feature-flagged)

### Database (additive)
- `public.charge_dlq` — dead-letter queue for charges that exhaust provider 5xx retries. Admin-only RLS.
- `public.idempotency_cache_extended` — 24h replay cache keyed on `(merchant_id, idempotency_key)`. Extends the existing 60s in-flight reservation; does not replace it.

### Edge function
- `supabase/functions/payment-orchestrator/index.ts` — new front-of-line dispatcher.
  - Reads `system_config.payment_orchestrator_enabled` (default OFF).
  - OFF → **transparent passthrough** to `payment-router-charge` (zero behavioural change).
  - ON → orchestrated path (currently identical; future DLQ writes + multi-provider fallback will land here).
  - Returns `X-Orchestrator: passthrough | active` so clients can observe routing.
  - Uses the Phase 5 `_shared/logger.ts` for structured JSON logs with `trace_id`.

### Spec
- `x-payment-orchestrator` vendor extension publishes flag name, default, route, delegation target, and guarantees.
- Snapshot `public/openapi-history/openapi-4.37.0.json` published.

---

## Phase 6 — Compliance & Data Retention (v4.38.0)

### Database (additive)
- `public.data_retention_policies` — declarative horizons per data class. Seeded with:
  | data_class | retention_days | anonymize_after_days | legal_basis |
  |---|---|---|---|
  | kyc_documents | 2555 (7y) | 2190 (6y) | COBAC + GDPR Art. 5(1)(e) |
  | transactions | 3650 (10y) | — | COBAC AML horizon |
  | consent_events | 2555 (7y) | — | PSD2 RTS Art. 36 + COBAC |
  | webhook_deliveries | 365 (1y) | 180 (6mo) | GDPR Art. 5(1)(c) |
- Reuses existing `public.consent_events` (immutable AISP/PISP ledger) and `public.compliance_reports` (regulatory exports) — no schema churn.

### Spec
- `x-data-retention` vendor extension surfaces table names, legal bases, and the seeded horizons.
- Snapshot `public/openapi-history/openapi-4.38.0.json` published.

---

## Files created
- `supabase/functions/payment-orchestrator/index.ts`
- `scripts/phase4-6-spec-hardening.mjs`
- `public/openapi-history/openapi-4.37.0.json`
- `public/openapi-history/openapi-4.38.0.json`
- `PHASE_4_6_CLOSEOUT_REPORT.md`

## Files edited
- `src/config/version.ts` — SSOT bumped to 4.38.0
- `public/openapi.json`, `public/openapi-sandbox.json` — extensions + version
- `public/openapi.yaml`, `public/openapi-sandbox.yaml` — version
- `public/openapi-history/manifest.json` — 4.37.0 + 4.38.0 entries
- `public/changelog.json` — 4.37.0 + 4.38.0 entries

## Verification
- [x] Migrations applied successfully (both tables created, 4 retention rows seeded).
- [x] OpenAPI JSON + YAML parse; versions aligned across SSOT, JSON, YAML, manifest, changelog.
- [x] Orchestrator function defaults to passthrough — production traffic continues hitting `payment-router-charge` unchanged.
- [x] No removed/renamed operationIds, paths, schemas, parameters, or security schemes.

## Operator notes
- To enable orchestration in production: `INSERT INTO public.system_config (key, value) VALUES ('payment_orchestrator_enabled', 'true');`
- Disable instantly by setting the same row to `'false'` — passthrough resumes on next request.

## Remaining roadmap
- Phase 7 — Fraud & Risk Enhancements (4.39.0)
- Phase 8 — Scalability, DX & SDK Completeness (4.40.0)

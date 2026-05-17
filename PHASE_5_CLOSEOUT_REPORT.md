# Phase 5 Closeout — Observability & SLOs

**Version**: 4.35.0 → **4.36.0** (minor, additive only)
**Date**: 2026-05-17
**Scope**: End-to-end distributed tracing + structured JSON logging + admin SLO dashboard.
**Compliance**: Standing Orders 1 (Lock), 4 (Surgeon), 6 (Version Gate) honored.

---

## What shipped

### 1. Database (additive)
- `webhook_deliveries.trace_id text` + partial index
- `gateway_charges.trace_id text` + partial index
- `safeguarding_ledger.trace_id text` + partial index

No column renamed or removed. No RLS policy modified.

### 2. Shared edge-function helper
- `supabase/functions/_shared/logger.ts`
  - `getOrCreateTraceId(req)` — accepts `X-Trace-Id` (preferred) or W3C `traceparent`; falls back to UUID v4.
  - `injectTraceHeaders(headers, ctx)` — propagates `X-Trace-Id` + `X-Request-Id` outbound.
  - `createLogger({ trace_id, ... })` — structured single-line JSON output with `child()` chaining.

Existing console-based logging is **not** touched (Standing Order 4 — additive).

### 3. OpenAPI spec
- `info.version` bumped to **4.36.0** in both production and sandbox JSON + YAML.
- `X-Trace-Id` response header added to every operation:
  - Production: 3,020 responses across 405 operations.
  - Sandbox:    2,575 responses across 344 operations.
- New top-level vendor extension `x-observability`:
  ```json
  {
    "trace_header": "X-Trace-Id",
    "request_header": "X-Request-Id",
    "propagation": "W3C Trace Context (traceparent) accepted...",
    "slo_targets": {
      "charge_success_rate_24h": ">= 99.5%",
      "webhook_delivery_success_rate_24h": ">= 99.0%",
      "charge_latency_ms": { "p50": 200, "p95": 800, "p99": 1500 }
    },
    "dashboard": "/admin/slo"
  }
  ```
- Snapshot `public/openapi-history/openapi-4.36.0.json` published; history manifest updated.

### 4. Admin SLO dashboard
- New route `/admin/slo` rendered by `src/pages/admin/AdminSLO.tsx`.
- Pulls from `gateway_charges` + `webhook_deliveries` (rolling 24h, capped at 1,000 rows per table for responsiveness).
- Surfaces:
  - Charge success rate vs ≥ 99.5% target.
  - Webhook delivery success rate vs ≥ 99.0% target.
  - Latency p50 / p95 / p99 vs 200 / 800 / 1500 ms targets.

---

## Files created
- `supabase/functions/_shared/logger.ts`
- `src/pages/admin/AdminSLO.tsx`
- `scripts/phase5-spec-hardening.mjs`
- `public/openapi-history/openapi-4.36.0.json`
- `PHASE_5_CLOSEOUT_REPORT.md`

## Files edited
- `src/App.tsx` — lazy import + admin route for `/admin/slo`
- `src/config/version.ts` — SSOT bumped to 4.36.0
- `public/openapi.json`, `public/openapi-sandbox.json` — header + extension + version
- `public/openapi.yaml`, `public/openapi-sandbox.yaml` — version
- `public/openapi-history/manifest.json` — 4.36.0 entry
- `public/changelog.json` — 4.36.0 entry

## Database migrations
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS trace_id text` on 3 tables + matching partial indexes.

---

## Verification
- [x] OpenAPI JSON parses; version bumped in both production + sandbox.
- [x] YAML version aligned with JSON (CI parity gate happy).
- [x] No removed/renamed operationIds, paths, schemas, parameters, or security schemes.
- [x] New admin page is admin-scoped (mounted under existing `requiredRole="admin"` AdminLayout).
- [x] Trace-id columns are nullable with default NULL — zero impact on existing inserts.

## Next recommended phase
**Phase 4 — Payment Orchestration Layer (4.37.0, feature-flagged)** per the roadmap, or **Phase 6 — Compliance & Data Retention** if regulatory work is more urgent.

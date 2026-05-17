
# KOB Bank-Grade Hardening — Phased Roadmap (All 10 Domains)

**Constraints honored:** Additive + safe refactors only. No rename/remove (SO-1). Every phase bumps `info.version` (SO-6). Zero changes to live transaction logic without a feature-flagged fallback. Public developer routes remain public.

**Verdict today:** CONDITIONAL GO. Target after Phase 4: full GO equivalent to Stripe/Adyen/Flutterwave-grade.

---

## Deliverables shipped in this turn

<presentation-artifact path="KOB_Bank_Grade_Audit.md" mime_type="text/markdown"></presentation-artifact>
<lov-artifact url="/__l5e/documents/KOB_Payment_State_Machine.mmd" mime_type="text/vnd.mermaid"></lov-artifact>
<lov-artifact url="/__l5e/documents/KOB_Webhook_Delivery.mmd" mime_type="text/vnd.mermaid"></lov-artifact>
<lov-artifact url="/__l5e/documents/KOB_Ledger_Architecture.mmd" mime_type="text/vnd.mermaid"></lov-artifact>
<lov-artifact url="/__l5e/documents/KOB_Target_Architecture.mmd" mime_type="text/vnd.mermaid"></lov-artifact>

The audit covers maturity scoring (10 dimensions), domain findings, top-10 risk register, and Standing-Orders compliance. Diagrams cover payment state machine, webhook delivery, ledger flow, and target architecture.

---

## Phase plan (each phase = separate approval gate)

### Phase 1 — API Contract Hardening (patch 4.32.x → 4.33.0)
- Add `Idempotency-Key` parameter to the 5 financial DELETEs flagged in `docs/internal/openapi-quality-report.md`.
- Add `starting_after` + `ending_before` cursor params to the 38 offset-only list ops (keep `offset` for SO-1).
- Reference `components/responses/Problem` (RFC 7807) on every 4xx/5xx that currently inlines errors.
- Propagate `X-Request-ID` header (generate if missing) on every edge function response.
- CI gate: extend `scripts/openapi-quality-gates.mjs` to enforce cursor parity and Problem coverage.

### Phase 2 — AuthZ Scope Enforcement & Webhook Resilience (minor 4.34.0)
- Per-key scope matrix table (`api_key_scopes`); enforce in `banking-api-router` + `gateway-charges-router`.
- Add per-endpoint circuit breaker state (`webhook_endpoint_health` already exists — wire `open/half-open/closed` into `gateway-webhook-deliver-v2`).
- Introduce `X-Webhook-Replay: true` header on manual replays + persist `replay_of_delivery_id`.
- Publish webhook event registry page under `/developer/webhooks/events` (read from `webhook_event_schemas`).

### Phase 3 — Settlement & Reconciliation Closeout (minor 4.35.0)
- New `reconciliation_mismatches` table + `AdminReconciliation.tsx` Kanban (open → investigating → resolved).
- T+1 settlement PDF generator (`gateway-settlement-report`) — CSV exists, add PDF + JSON.
- Immutable audit export bucket (`audit-exports/`, write-once policy) for regulators.
- Document canonical payment state machine in `/developer/payments/state-machine` (sourced from diagram).

### Phase 4 — Payment Orchestration Layer (minor 4.36.0, feature-flagged)
- New `payment_orchestrator` edge function in front of `payment-router-charge` (flag-gated, default off).
- Dead-letter for charge processors after N provider 5xx (`charge_dlq` table + admin replay).
- Unified façade `POST /v1/gateway/charges/{id}/reverse` delegating to existing provider-specific reversal.
- Idempotency cache TTL extended to 24h on all financial mutations.

### Phase 5 — Observability & SLOs (patch 4.36.x)
- End-to-end `trace_id` column added to `webhook_deliveries`, `gateway_charges`, `ledger_entries`.
- Structured-log helper in `supabase/functions/_shared/logger.ts` enforcing JSON + `trace_id`.
- SLO dashboard page `/admin/slo` (latency p50/p95/p99, success rate, webhook delivery rate).
- Alert rules via Supabase cron + Resend (paging on breach).

### Phase 6 — Compliance & Data Retention (minor 4.37.0)
- `data_retention_policies` table + `retention-purge-cron` (PII anonymization beyond regulatory horizon).
- Consent ledger extension (immutable consent events, AISP/PISP unified).
- Regulatory report generator (`compliance-report-monthly`) for COBAC.

### Phase 7 — Fraud & Risk Enhancements (minor 4.38.0)
- Shared `risk_blocklists` table (msisdn, email, IBAN, device_id).
- Behavioral baseline per merchant (rolling 30-day stats) → enrich `risk-score`.
- Convert `risk-score` to fail-closed for high-value transactions (configurable threshold).

### Phase 8 — Scalability, DX & SDK Completeness (minor 4.39.0)
- Redis-style cache (Supabase KV table or external) for OIDC discovery + rate-limit counters.
- Java + Go SDK skeletons published under `packages/sdk-java`, `packages/sdk-go` to satisfy Docs Order P9.
- Load test harness in `e2e/load/` (k6 scripts: charge burst, webhook flood, AISP read storm).
- Resilience report auto-generated from load results.

---

## Acceptance gates per phase
1. OpenAPI quality gates G1–G5 still pass + new gate for the phase.
2. `npm run build` + `audit:og` clean.
3. No removal of any operationId/path/schema (CI breaking-change diff).
4. E2E suite green (`e2e/authenticated/*`, `e2e/smoke/*`).
5. Changelog entry within 48h (Docs Order P7).
6. `info.version` incremented per SO-6.

---

## What changes vs what stays
**Stays untouched:** existing operationIds, paths, schemas, RLS policies, public developer routes, ledger checksum logic, current webhook signature format.
**Additive:** new tables, new columns (nullable), new endpoints, new flags, new dashboards, new SDK packages, new CI gates.
**Safe refactors:** logger consolidation, scope-enforcement middleware extraction, circuit-breaker wiring — all behind existing contracts.

---

## Technical notes
- All new DB objects: RLS on, `SECURITY DEFINER` + `SET search_path = public`, owner-scoped policies via `public.has_role()`.
- All new edge functions: `verify_jwt = false` default, in-code JWT validation, `corsHeaders` from `npm:@supabase/supabase-js@2/cors`, Zod input validation, structured logs with `trace_id`.
- Feature flags via existing `system_config` table to allow instant rollback.
- Each phase delivered as one approval cycle; nothing implemented without your green light per phase.

---

## Next step
Approve this roadmap, then tell me which phase to start with. Recommended order: **Phase 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8** (contract + scopes + reconciliation + observability before orchestrator surgery).

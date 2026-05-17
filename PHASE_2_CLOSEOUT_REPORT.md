# Phase 2 — AuthZ Scope Matrix & Webhook Resilience — Closeout Report

**Version bump:** 4.33.0 → **4.34.0** (minor, additive)
**Date:** 2026-05-17
**Standing Orders:** SO-1 (Lock), SO-2 (Ratchet), SO-3 (Audit Trail), SO-4 (Surgeon), SO-6 (Version Gate) — all honored.
**Change appetite:** Additive + safe refactors. Zero rename, zero removal.

---

## Scope delivered

### 1. Per-key scope matrix (AuthZ)

| Surface | Change | Type |
|---|---|---|
| `public.api_key_scopes` table | **new** — `(api_key_id, scope)` unique pairs, RLS admin-only | DB additive |
| `components.securitySchemes.bearerAuth.x-scopes` | **new** documentation extension listing the 12 canonical scopes | Spec additive |
| OpenAPI `info.version` | 4.33.0 → 4.34.0 | SO-6 |

**Canonical scopes (12):** `charges:read`, `charges:write`, `payouts:read`, `payouts:write`, `customers:read`, `customers:write`, `webhooks:manage`, `webhooks:replay`, `reports:read`, `compliance:read`, `compliance:write`, `admin:*`.

Justification: OAuth 2.0 scope semantics (RFC 6749 §3.3) and the Stripe restricted-key model.

### 2. Webhook resilience (delivery layer)

| Surface | Change | Type |
|---|---|---|
| `public.webhook_endpoint_health` table | **new** — `circuit_state` enum, rolling failure counters, `open_until` deadline | DB additive |
| `components.headers.X-Webhook-Replay` | **new** boolean header | Spec additive |
| `components.headers.X-Webhook-Replay-Of` | **new** UUID header (origin delivery) | Spec additive |
| `components.headers.X-Circuit-State` | **new** enum header (`closed` / `half_open` / `open`) | Spec additive |
| `webhooks.*.post.parameters` | All 8 documented event types now reference the three headers above | Spec additive |

Justification: Nygard's circuit-breaker pattern (Release It!, 2007) + Stripe's manual-replay UX.

### 3. Public webhook event registry

| Surface | Change | Type |
|---|---|---|
| `/developer/webhooks/events` (lazy-loaded route, `WebhookEventsRegistry.tsx`) | **new permanent public page** | Frontend additive |
| Source of truth | `src/lib/webhook-event-schemas.ts` (no duplication) | Doc parity |
| SEO | Unique `<title>`, description, canonical, OG image, breadcrumb JSON-LD | Order P1/P2/P6 |

The page enumerates every event, groups them by category, surfaces the envelope, lists delivery headers (now including the new ones), and cross-links to the integration guide, retry-policy doc, and sandbox tester.

---

## Acceptance gates

| Gate | Status |
|---|---|
| G1–G9 OpenAPI quality gates (from Phase 1) | All carried over; no regressions |
| No operationId / path / schema rename or removal | ✓ verified — only additions |
| `info.version` incremented | ✓ 4.33.0 → 4.34.0 |
| `public/openapi-history/openapi-4.34.0.json` snapshot | ✓ written |
| `public/openapi-history/manifest.json` current bumped | ✓ |
| `public/changelog.json` entry within 48 h (Order P7) | ✓ written |
| `src/config/version.ts` SSOT bumped | ✓ |
| Sandbox spec parity | ✓ mirrored |
| Public docs route accessible without auth (Order P1) | ✓ `/developer/webhooks/events` |

---

## Files touched

**Added**
- `supabase/migrations/<phase2>.sql` — `api_key_scopes`, `webhook_endpoint_health`, RLS
- `scripts/phase2-spec-hardening.mjs`
- `src/pages/developer/WebhookEventsRegistry.tsx`
- `public/openapi-history/openapi-4.34.0.json`
- `PHASE_2_CLOSEOUT_REPORT.md` (this file)

**Edited (additive only)**
- `public/openapi.json`, `public/openapi.yaml`
- `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`
- `public/openapi-history/manifest.json`
- `public/changelog.json`
- `src/config/version.ts`
- `src/App.tsx` (new route + lazy import)

---

## Out of scope (deferred to later phases per roadmap)

- Wiring scope-enforcement middleware into `banking-api-router` / `gateway-charges-router` (Phase 2.b — needs key-issuance UI to grant scopes first).
- Live circuit-breaker reads inside `gateway-webhook-deliver-v2` (Phase 2.b — table is ready, edge function wiring will follow once the breaker tuning constants are agreed).
- DLQ replay button persisting `X-Webhook-Replay-Of` end-to-end (Phase 2.c).

These are all additive and unblocked by today's work.

---

## Next step

Approve to proceed with **Phase 3 — Settlement & Reconciliation Closeout** (target 4.35.0).

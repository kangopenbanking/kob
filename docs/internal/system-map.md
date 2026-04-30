# KOB Platform — System Map (Phase 0, read-only)

**Date:** 2026-04-30  · **Spec:** v4.26.7  · **Auditor:** Lovable

## Top-level surfaces

| Surface | Tech | Where | Count |
|---|---|---|---|
| Marketing + public docs | React 18 + Vite, public routes | `src/pages/*` | 606 page files, 706 `<Route>` declarations in `src/App.tsx` |
| Customer PWA | React, manifest.json | `src/pages/customer-app/` | — |
| Business / Merchant PWA | React, manifest-biz.json | `src/pages/business-app/`, `src/pages/merchant/` | — |
| Banking ops dashboard | React | `src/pages/banking-app/`, `src/pages/bank-dashboard/` | — |
| FI Portal (institution) | React + RoleGuard | `src/pages/institution/` (mounted at `/fi-portal/*`) | 25+ child routes |
| Admin console | React + RoleGuard | `src/pages/admin/` | — |
| Developer portal (PUBLIC) | React | `src/pages/developer/` | All sub-routes anonymous-accessible (Order P1) |
| Compliance / Regulatory | React | `src/pages/compliance/`, `src/pages/regulatory/` | — |
| Sandbox console | React | `src/pages/sandbox/` | — |
| Widgets (embeddable iframes) | React | `src/pages/widgets/` | — |

## Backend (Lovable Cloud / Supabase)

| Layer | Count | Notes |
|---|---|---|
| Edge functions | **356** | All under `supabase/functions/`, single `index.ts` per function |
| Migrations | **332** | `supabase/migrations/*.sql` |
| Public DB tables | **426** | RLS mandatory (Standing Order: DB Hardening) |
| Webhook receivers (provider) | 3 | `gateway-webhook-stripe`, `gateway-webhook-flutterwave`, `gateway-webhook-paypal` |
| Webhook delivery infra (outbound) | 5 | `gateway-deliver-webhook`, `gateway-webhook-deliver-v2`, `gateway-webhook-replay-delivery`, `webhook-delivery`, `admin-webhook-replay` |

## Notification & alert infrastructure

Tables discovered (`information_schema.tables` filtered):

| Table | Purpose |
|---|---|
| `audit_logs` | Cross-cutting platform audit trail |
| `security_audit_logs` | Security-sensitive events (RLS, auth, key rotation) |
| `gateway_audit_logs` | Gateway-domain audit trail |
| `app_notifications` | In-app notifications (general) |
| `api_key_notifications` | Expiry / rotation notices |
| `notification_preferences` | Per-user channel prefs |
| `merchant_notification_preferences` | Per-merchant channel prefs |
| `merchant_travel_notifications` | Travel-domain notifications |
| `event_outbox` | Outbox pattern for reliable internal events |
| `integration_events_inbox` | Inbound integration event capture |
| `webhook_inbox` | **Inbound provider webhook capture** (see provider-webhooks-report.md — schema-mismatch bug found) |
| `gateway_webhook_events` | Outbound webhook event log (1 row in test) |
| `gateway_webhook_deliveries`, `gateway_webhook_deliveries_v2` | Outbound delivery attempts (v2 active) |
| `gateway_webhook_endpoints` | Merchant-registered webhook destinations |
| `webhook_deliveries`, `webhook_replay_audit` | Legacy / replay surfaces |
| `broker_delivery_log` | Broker-side delivery attempts |
| `sandbox_webhooks`, `sandbox_webhook_logs` | Sandbox-only |

## Key integration patterns (from project memory)

- Direct Backend Mandate: Edge Functions URL = `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`
- Financial Safety: state-changing financial mutations always go through Edge Functions
- Idempotency: UUID v4 `idempotency_key` + `FOR UPDATE` row locks for atomic transactions
- Auth: `supabase.auth.getUser()` — never `getSession()`
- Public docs: PERMANENT PUBLIC ROUTE (Order P1) — no auth wall on `/developer/*`, `/openapi.json`, `/openapi.yaml`, `/changelog.json`

## Companion documents

- `docs/internal/ui-inventory.json`
- `docs/internal/api-route-inventory.json`
- `docs/internal/openapi-quality-report.md`
- `docs/internal/gateway-parity-report.md`
- `docs/internal/provider-webhooks-report.md`

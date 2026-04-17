
The user wants all three previously out-of-scope items shipped as one coordinated follow-up. I'll keep the plan additive (Standing Order 1: The Lock) and version-gated (Order 6).

# BYO Mobile Money — Phase 2: Reliability, Legacy Banks & Cross-Bank Failover

Three additive workstreams. Zero behavior change to existing rails.

## 1. Polling & Synthetic Webhooks (MTN / Orange)

Direct rails don't push reliably. Add server-side reconciliation.

**New table** `byo_charge_polls`
- `charge_id`, `connector_id`, `provider_reference`, `tenant_owner_type`, `tenant_owner_id`, `status`, `attempt_count`, `next_poll_at`, `last_polled_at`, `terminal_at`

**New edge function** `byo-charge-poller` (cron, every 30s)
- Picks pending rows where `next_poll_at <= now()`
- Calls `connector.getStatus()` via existing registry
- On terminal status: updates `gateway_charges`, fires synthetic webhook through existing `webhook-dispatcher` (event types `charge.completed` / `charge.failed`), records fee
- Backoff: 30s → 1m → 2m → 5m → 10m, max 30min, max 20 attempts

**Router integration**: `payment-router-charge` enqueues a poll row when MTN/Orange returns `pending`. No change to Flutterwave path.

## 2. SOAP Bank Adapter (Legacy Core-Banking)

For institutions on legacy SOAP-based cores (T24, Flexcube, OBDX).

**New connector** `_shared/payment-connectors/soap-bank.ts`
- Implements same `PaymentConnector` interface
- Handles WSDL endpoint, SOAP envelope construction (XML), WS-Security UsernameToken / X.509 signature
- Credentials schema: `wsdl_url`, `username`, `password`, `cert_pem` (optional), `service_namespace`, `operation_initiate`, `operation_status`
- New owner-type entry in `tenant_payment_connectors.connector_id` enum: `soap_bank`

**Tenant UI**: extend `PaymentConnectorsPanel` with SOAP form (collapsible "Advanced" section for namespace/operation overrides, file upload for cert).

**Constraint**: TLS terminated by edge proxy — document mTLS limitation per existing memory `mem://constraints/mtls-infrastructure-limitations`.

## 3. Multi-Rail Cross-Bank Failover

Currently routing falls back: tenant rail → platform Flutterwave. Extend to: tenant rail A → tenant rail B → … → platform fallback.

**Schema**: already supported by existing `priority` column. No migration needed.

**Router change** (`payment-router-charge`):
- Resolve ALL enabled connectors for `(owner, country, environment)` ordered by `priority ASC`
- Try each in order; on failure (network, 5xx, explicit `failed` status), advance to next
- Record attempt trail in new `byo_routing_attempts` table (charge_id, connector_id, status, error, attempted_at) for admin debugging
- Final fallback to platform Flutterwave unchanged

**Admin UI**: extend `/admin/tenant-connectors` with a "Routing Trail" drawer per charge (read from `byo_routing_attempts`).

## Docs & Versioning (mandatory)

- New page `/developer/connectors/polling-and-webhooks` — synthetic webhook contract, retry schedule
- New page `/developer/connectors/soap-bank-adapter` — credential setup, sample WSDL, security model
- New page `/developer/connectors/multi-rail-failover` — priority semantics, attempt trail
- OpenAPI: add `soap_bank` to connector enum, add `GET /v1/connectors/:id/routing-attempts`, bump `info.version` 4.10.0 → **4.11.0** (Order 6 — minor, additive)
- Changelog entry within 48h (Order P7) across `CHANGELOG.md`, `public/changelog.json`, `Changelog.tsx`
- cURL + Node + Python examples for every new endpoint (Order P9)
- Footer link: add "Reliability & Failover" under Products (optional — small)

## Migrations (additive only)

```text
1. byo_charge_polls table + RLS + cron job
2. byo_routing_attempts table + RLS
3. ALTER TYPE connector_id_enum ADD VALUE 'soap_bank'
```

No changes to existing tables, enums, or RLS policies. Standing Order 1 preserved.

## Validation

- Unit tests per new connector via `api-contract-test`
- E2E: simulate MTN pending → verify poller resolves → synthetic webhook fires
- E2E: register two tenant rails (priority 1, 2) → fail rail 1 → verify rail 2 used → fail both → verify Flutterwave fallback
- Confirm `mobile-money-charge` callers still see zero change

## Admin Oversight

Extend `/admin/tenant-connectors`:
- Poll queue health card (pending count, oldest pending age, terminal rate %)
- Per-charge routing attempt drawer
- SOAP connector form fields visible in admin read-only view (credentials remain encrypted)

## Out of Scope (this round)
- Auto-priority learning from health metrics
- Cross-country failover
- Bank-side ISO 20022 SOAP adapters (separate from this generic SOAP)

## Secrets
- None at platform level. SOAP TLS certs are tenant-supplied per connector.


Goal: Keep Flutterwave as KOB's default mobile-money middleware, and add direct MTN MoMo / Orange Money as an opt-in BYO-credentials rail for institutions, businesses, and developers who bring their own API keys.

Approach: tenant-scoped connector credentials + per-tenant routing preference, fully additive, zero impact on existing `mobile-money-charge` behavior.

## Scope (additive only)

1. Tenant-scoped connector credentials
   - New table `tenant_payment_connectors`:
     - `id`, `owner_type` (`institution`|`merchant`|`developer`), `owner_id`, `connector_id` (`mtn_momo`|`orange_money`|`flutterwave`), `environment` (`sandbox`|`live`), `country`, `enabled`, `priority`, `credentials_encrypted` (jsonb), `last_health_check_at`, `health_status`, timestamps.
   - Credentials encrypted at rest via existing `pgcrypto` + `hash_secret_value`-style pattern; never returned to the client (write-only API).
   - RLS: owners manage only their own rows; admins read-all.

2. Connector framework (shared, no behavior change to existing functions)
   - `_shared/payment-connectors/types.ts` — `PaymentConnector` interface (`initiateCharge`, `getStatus`, `refund`, `healthCheck`).
   - `_shared/payment-connectors/flutterwave.ts` — wraps existing platform Flutterwave logic (default rail).
   - `_shared/payment-connectors/mtn-momo.ts` — direct MTN MoMo (sandbox + live).
   - `_shared/payment-connectors/orange-money.ts` — direct Orange Money.
   - `_shared/payment-connectors/registry.ts` — resolves connector + credentials per tenant.

3. Routing preference (opt-in, never silent)
   - Resolution order per request:
     1. If caller passes explicit `connector` field AND has matching `tenant_payment_connectors` row → use it.
     2. Else if tenant has `tenant_payment_connectors` rows for the country, sorted by `priority` → try in order, fallback to platform Flutterwave on failure.
     3. Else → platform Flutterwave (current default behavior, unchanged).
   - Existing `mobile-money-charge` stays the public default. New optional flag `use_tenant_connectors: true` activates the new path. No silent rerouting.

4. New management endpoints (edge functions)
   - `tenant-connectors-manage` (POST/PATCH/DELETE) — register/update/disable own connector credentials.
   - `tenant-connectors-list` (GET) — list own connectors (no secrets returned).
   - `tenant-connectors-test` (POST) — runs `healthCheck()` against stored credentials, updates `health_status`.

5. Charge path integration
   - New thin function `payment-router-charge` implementing the resolution order above. Reuses existing fee engine (`record_transaction_fee`), idempotency, and webhook delivery.
   - Existing `mobile-money-charge` and `facilitated-mobile-money-charge` left untouched.

6. UI (additive, no changes to current screens)
   - Institution/Business/Developer settings: new "Payment Connectors" section
     - List rows from `tenant_payment_connectors`
     - Add/edit form per connector with required-field hints (MTN: subscription key, API user, API key, target env; Orange: client id/secret, merchant key)
     - "Test connection" button → calls `tenant-connectors-test`
     - Priority drag-handle, enable/disable toggle
   - Clear copy: "Flutterwave (managed by KOB) is always available as fallback."

7. Docs (per Standing Orders P5/P7/P9/P10)
   - New page `/developer/connectors/byo-mobile-money` — when to use, supported providers, credential setup, security model, fallback behavior.
   - cURL + Node + Python examples for registering credentials and sending a charge with `use_tenant_connectors: true`.
   - OpenAPI: add `POST /v1/connectors`, `GET /v1/connectors`, `POST /v1/connectors/:id/test`, and `connector` request field on existing charge endpoint (additive — Ratchet preserved). Bump `info.version` per Order 6.
   - Changelog entry within 48h of deploy (Order P7).

8. Security
   - Credentials encrypted; only the storing tenant (and admins) can mutate.
   - All connector calls server-mediated via edge functions (no client-side credential use).
   - Audit log every credential create/update/delete via existing `log_audit_event`.
   - Health check failures auto-disable rail after N consecutive failures; tenant notified via existing notification infra.

## Architecture
```text
Caller (Institution / Business / Developer)
   │
   ▼
mobile-money-charge (UNCHANGED, default = Flutterwave)
   │   (opt-in: use_tenant_connectors=true)
   ▼
payment-router-charge (NEW)
   │
   ├── resolve tenant_payment_connectors (priority order)
   │       │
   │       ▼
   │   MTN MoMo / Orange Money (tenant credentials)
   │       │  on failure
   │       ▼
   └── Flutterwave (KOB-managed fallback, existing path)
```

## Migrations (additive)
- `tenant_payment_connectors` table + RLS + audit triggers
- No changes to existing tables or enums

## Validation
- Unit-style tests for each connector via existing `api-contract-test` extension
- E2E: register sandbox MTN creds → charge with `use_tenant_connectors=true` → verify MTN path used → simulate failure → verify Flutterwave fallback
- Confirm existing `mobile-money-charge` callers see zero behavior change

## Out of scope (this round)
- Polling/synthetic webhooks for direct rails (separate proposal)
- SOAP bank adapter (separate proposal)
- Multi-rail bank-side routing

## Secrets needed
- None at platform level (tenants supply their own)
- Existing `FLUTTERWAVE_SECRET_KEY` continues to power the default/fallback path

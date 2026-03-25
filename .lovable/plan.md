

# Plan: BaaS Remittance Module Enhancement

## PHASE 0 — Repo Scan Report

The request assumes a Prisma/Express backend. The actual architecture is:

- **Backend**: Supabase Edge Functions (Deno), NOT Express/Prisma
- **Database**: Supabase Postgres (migrations via SQL, not Prisma)
- **Existing Remittance Infrastructure** (already built):
  - `remittance-engine` — corridors, quotes, inbound tracking, admin management
  - `remittance-outbound` — send, cancel, track, compliance decisions
  - `remittance-routing-engine` — double-entry ledger postings on credit
  - `remittance-settlement` — reconciliation, partner health
  - `remittance-webhook-ingest` — inbound partner webhooks (Thunes/TerraPay/Onafriq)
  - `remittance-bank-confirm` — bank credit confirmation
  - `remittance-recon-cron` — stale transaction flagging
  - `_shared/remittance-adapters.ts` — provider adapters with HMAC verification
- **Existing DB tables**: `remittances`, `remittance_partners`, `remittance_corridors`, `remittance_quotes`, `remittance_events`, `remittance_settlements`, `remittance_reconciliation_items`, `remittance_compliance_checks`, `remittance_usage_tracking`, `remittance_ledger_links`, `remittance_corridor_limits`
- **Existing UI**: RemittanceLanding page, Send Money flow, Inbound tracking, Admin Command Center (5 pages)
- **Frontend**: Vite + React + TypeScript
- **Tests**: Vitest (unit), e2e-contract-tests edge function
- **OpenAPI**: Static `/openapi.json` (v4.3.1, 326 operations)
- **Postman**: `postman-collection` edge function
- **Gateway webhooks**: `gateway-webhook-stripe`, `gateway-webhook-paypal`, `gateway-webhook-flutterwave` already exist

### What Already Exists vs What's Needed

| Requested Feature | Status |
|---|---|
| Corridors API | ✅ Exists in `remittance-engine` |
| Quotes API | ✅ Exists in `remittance-engine` + `remittance-outbound` |
| Transfer creation (outbound) | ✅ Exists in `remittance-outbound` |
| Transfer tracking | ✅ Exists |
| Compliance checks | ✅ Exists with auto-approve and manual review |
| Inbound partner webhooks (Thunes/TerraPay/Onafriq) | ✅ Exists |
| Routing engine with ledger | ✅ Exists |
| Settlement/Reconciliation | ✅ Exists |
| Admin dashboards | ✅ Exists (5 pages) |
| Consumer UI (send money, track) | ✅ Exists |
| **Pay-in intent abstraction (Stripe/PayPal/FLW for funding)** | ❌ Missing |
| **Client-facing remittance webhook registration** | ❌ Missing |
| **Remittance-specific developer docs pages** | ❌ Missing |
| **Remittance E2E test scenarios** | ❌ Missing |
| **OpenAPI/Postman remittance section** | ❌ Missing |

---

## What We Will Build (Additive Only)

### 1. Pay-in Intent Edge Function (NEW)

**File**: `supabase/functions/remittance-payin-intent/index.ts`

A new edge function that creates pay-in intents to fund remittance transfers via Stripe, PayPal, or Flutterwave MoMo. Actions:
- `create_stripe_intent` — Creates a Stripe PaymentIntent for the transfer amount, stores `provider_ref` on the remittance
- `create_paypal_order` — Creates a PayPal order, stores order ID
- `create_flw_momo` — Initiates Flutterwave MoMo charge
- `create_kob_wallet` — Internal wallet debit
- `confirm_payin` — Called after provider webhook confirms payment; transitions remittance to `pending` status

This reuses existing gateway adapters (`stripe-payment-intent`, `gateway-webhook-stripe`, etc.) by invoking them internally rather than duplicating logic.

### 2. Client Remittance Webhook Edge Function (NEW)

**File**: `supabase/functions/remittance-client-webhooks/index.ts`

Actions:
- `register` — Register a webhook endpoint (url, events, generates HMAC secret)
- `list` — List registered endpoints for a client
- `rotate_secret` — Rotate webhook signing secret
- `list_deliveries` — View delivery logs for an endpoint
- `deliver` — Internal: delivers remittance events to registered endpoints with HMAC-SHA256 signatures

Supported events: `remittance.transfer.created`, `remittance.payin.succeeded`, `remittance.payin.failed`, `remittance.payout.succeeded`, `remittance.payout.failed`, `remittance.transfer.completed`, `remittance.transfer.cancelled`, `remittance.transfer.refunded`

### 3. Database Migrations (Additive)

New tables:
- `remittance_payin_intents` — Tracks pay-in funding attempts (id, remittance_id, provider, provider_ref, method, amount, currency, status, created_at)
- `remittance_client_webhook_endpoints` — Client webhook registrations (id, client_id, url, events[], secret_hash, is_active, created_at)
- `remittance_client_webhook_deliveries` — Delivery logs (id, endpoint_id, remittance_id, event_type, payload, status, http_status, attempt_count, last_attempt_at, created_at)

No existing tables modified.

### 4. Developer Portal Docs Pages (8 pages, NEW)

All under `src/pages/developer/remittance/`:

1. **RemittanceOverview.tsx** — Architecture overview, Mermaid flow diagram
2. **RemittanceCorridorsQuotes.tsx** — Corridor discovery + quote creation with curl examples
3. **RemittanceCreateTransfer.tsx** — Transfer creation with idempotency, compliance flow
4. **RemittancePayinMethods.tsx** — Stripe/PayPal/FLW/Wallet pay-in integration
5. **RemittancePayoutMethods.tsx** — MoMo/Bank/PayPal/Wallet payout
6. **RemittanceWebhooks.tsx** — Provider inbound + client outbound webhook setup
7. **RemittanceSandboxTesting.tsx** — Sandbox testing guide
8. **RemittanceErrorReference.tsx** — Remittance-specific error codes

Each page includes: curl examples, Mermaid diagrams, webhook payloads, error examples using KOB Error schema.

**Navigation**: Append "Remittance API" section to `DeveloperLayout.tsx` and `PublicDeveloperLayout.tsx` sidebars.

**Routes**: Add 8 routes under `/developer/remittance/*` in `App.tsx`.

### 5. E2E Tests

Add remittance test suite to `supabase/functions/e2e-contract-tests/index.ts` as **Suite 12**: Remittance Module. Tests:
- Corridor listing returns data
- Quote creation returns valid schema
- Transfer creation (idempotency check via remittance-outbound)
- Pay-in intent creation
- Client webhook registration
- Webhook delivery log creation
- Compliance decision flow
- Settlement listing

### 6. OpenAPI + Postman

- Update the `openapi-json` edge function to include Remittance tag with all remittance endpoints
- Update the `postman-collection` edge function to add a "Remittance" folder with runnable requests

---

## Technical Detail

### Files Created (11)
- `supabase/functions/remittance-payin-intent/index.ts`
- `supabase/functions/remittance-client-webhooks/index.ts`
- `src/pages/developer/remittance/RemittanceOverview.tsx`
- `src/pages/developer/remittance/RemittanceCorridorsQuotes.tsx`
- `src/pages/developer/remittance/RemittanceCreateTransfer.tsx`
- `src/pages/developer/remittance/RemittancePayinMethods.tsx`
- `src/pages/developer/remittance/RemittancePayoutMethods.tsx`
- `src/pages/developer/remittance/RemittanceWebhooks.tsx`
- `src/pages/developer/remittance/RemittanceSandboxTesting.tsx`
- `src/pages/developer/remittance/RemittanceErrorReference.tsx`

### Files Modified (Append Only, 4)
- `src/App.tsx` — Add 8 routes
- `src/components/developer/DeveloperLayout.tsx` — Append nav section
- `src/components/developer/PublicDeveloperLayout.tsx` — Append nav section
- `CHANGELOG.md` — Append v4.4.0 entry

### DB Migrations (3 new tables)
- `remittance_payin_intents`
- `remittance_client_webhook_endpoints`
- `remittance_client_webhook_deliveries`

### Non-Breaking Guarantees
- Zero existing files deleted or renamed
- Zero existing endpoints modified
- Zero existing DB columns changed
- All new endpoints namespaced under existing edge function patterns
- All new routes namespaced under `/developer/remittance/*`
- Navigation changes are append-only


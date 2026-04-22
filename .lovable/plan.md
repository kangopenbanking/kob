

## Goal
Add a **KOB Integration Layer** (`/integration-layer`) — a thin, Stripe-style facade over the existing 275+ edge functions — without touching any `/v1/*` endpoint, schema, or auth flow. Then run an end-to-end audit, fix gaps, document, and ship.

## Non-Negotiables (re-stated)
- No edits to existing `/v1/*` endpoints, schemas, or OAuth flows
- All work is **additive**
- Every new surface ships with E2E tests before being marked done
- Standing Orders 1-7 (API Guardian) and P1-P10 (Docs Guardian) respected — version bump = MINOR (4.x → 4.(x+1).0) since only additions

---

## Phase 1 — Audit (read-only, output to `/docs/integration-layer/audit/`)

Generate three artifacts:
1. **`endpoint-inventory.json`** — every edge function grouped by domain (gateway, AISP, PISP, banking, remittance, POS, support, etc.)
2. **`connector-map.md`** — bank connectors (rest/sql/file/soap), payment connectors (Flutterwave, MTN MoMo, Orange Money, soap_bank), interbank participants
3. **`flow-diagrams.mmd`** — Mermaid diagrams for: charge → settle, AISP consent → accounts, PISP consent → payment, webhook ingress → outbound delivery

Deliverable: `INTEGRATION_LAYER_AUDIT.md` at repo root summarizing surface area + gap classification (fully / partial / missing).

---

## Phase 2 — Build the Integration Layer

### 2.1 New edge function: `integration-layer` (single router)
Path pattern: `POST /functions/v1/integration-layer/{resource}.{action}`

Resources & actions (Stripe-style verbs):

| Resource | Actions | Routes to existing function |
|---|---|---|
| `customers` | create, retrieve, update, list | identity-register, userinfo |
| `accounts` | retrieve, list, balances | aisp-accounts, aisp-balances |
| `payments` | create, retrieve, capture, cancel | gateway-create-charge, gateway-verify-charge, payment-router-charge |
| `transfers` | create, retrieve, list | api-transfers, pisp-domestic-payment |
| `payouts` | create, retrieve, cancel | gateway-create-payout, gateway-cancel-payout |
| `refunds` | create, retrieve | gateway-create-refund |
| `webhooks` | register, list, replay, ping | gateway-webhook-endpoints, gateway-deliver-webhook |
| `sandbox` | simulate, reset | sandbox-trigger-webhook, sandbox-generate-data |

The router **only orchestrates** — it never duplicates business logic.

### 2.2 Smart Routing Engine (`_shared/integration-layer/router.ts`)
Decision tree per `payments.create({ method, country, amount })`:
1. If `method=card` → `gateway-create-charge` (Stripe/Flutterwave by country)
2. If `method=mobile_money` → `payment-router-charge` (MTN/Orange by MSISDN prefix)
3. If `method=bank` → `pay-by-bank` → `pisp-domestic-payment`
4. Fallback chain on connector failure (configurable per merchant)

### 2.3 Connector Abstraction (`_shared/integration-layer/normalize.ts`)
Single normalization layer that maps every upstream response → unified envelope:
```json
{ "id", "object", "status", "amount", "currency", "created", "metadata", "raw" }
```
Errors → unified `{ "error": { "type", "code", "message", "param", "request_id" } }` (Stripe-style).

### 2.4 Webhook Orchestrator (`_shared/integration-layer/webhooks.ts`)
- Subscribes to existing `webhook-delivery` outbox (no schema change — adds a *consumer*, not a producer)
- New table `integration_webhook_replays` (additive) to log replays
- New endpoint `webhooks.replay({ event_id })` re-enqueues into existing delivery pipeline

### 2.5 Sandbox Simulator (`_shared/integration-layer/sandbox.ts`)
Test triggers via magic values:
- `amount = 4242` → success
- `amount = 4000` → declined
- `amount = 5555` → 3DS challenge
- `amount = 9999` → delayed (10s) success

### 2.6 Unified SDK additions (no breaking change)
Add `KangOpenBanking.integration` namespace to existing `packages/sdk-node` and `sdk-php`:
```ts
kob.integration.payments.create({ amount, currency, method, customer })
kob.integration.transfers.initiate({ from, to, amount })
kob.integration.webhooks.replay(eventId)
```
Bumps SDK to `1.3.0` (MINOR — additive only).

---

## Phase 3 — E2E Walkthrough Tests

New file: `src/test/integration-layer-e2e.test.ts` covering the full developer journey:
1. Create customer → assert ID
2. Link bank (sandbox) → assert account list
3. `payments.create` mobile-money sandbox → assert `pending`
4. Trigger sandbox webhook → assert delivery + signature
5. `payments.retrieve` → assert `succeeded`
6. `webhooks.replay` → assert second delivery, idempotent
7. Reconcile via `gateway-reconciliation` → assert match

Plus Deno tests in `supabase/functions/integration-layer/index.test.ts` for routing + normalization.

---

## Phase 4 — Gap Detection
Output table in `INTEGRATION_LAYER_GAP_REPORT.md` classifying each Stripe-equivalent feature:
- ✓ Fully implemented (just needs facade)
- ◐ Partial (missing field/edge case)
- ✗ Missing (recommend best fix)

Anticipated partials (to be confirmed in Phase 1):
- Unified error envelope across connectors (currently inconsistent)
- Webhook replay endpoint (delivery exists, replay does not)
- Idempotency key support uniformly across all routes
- Cursor-based pagination uniformity

---

## Phase 5 — Fixes (additive only)
For each gap:
- Add normalizer entries (no upstream change)
- Add `Idempotency-Key` header support in router (stored in new `integration_idempotency_keys` table)
- Add cursor pagination wrapper in router output
- Best-recommended fix documented per gap

---

## Phase 6 — Docs Upgrade (`/developer/integration-layer/*`)
New public pages (respecting Order P1-P10):
- Overview + architecture diagram
- Quickstart (cURL + Node + Python + PHP)
- Resource reference (one page per resource)
- Webhook orchestrator guide
- Sandbox simulator guide + magic values table
- Migration guide ("If you use raw `/v1/*`, here's how to switch")

All examples runnable against sandbox using published test credentials.

---

## Phase 7 — Changelog
Append to `docs/governance/CHANGE_MANIFEST.md` and public changelog under version **`v4.10.0`**:
- ADD: integration-layer router
- ADD: unified envelope + error format (opt-in via new endpoints only)
- ADD: webhook replay
- ADD: sandbox magic-value simulator
- ADD: SDK `integration` namespace (Node + PHP)
- NO REMOVALS, NO RENAMES

---

## Phase 8 — Final Validation
1. Deploy `integration-layer` edge function
2. Run `src/test/integration-layer-e2e.test.ts`
3. Run Deno tests on the new function
4. Run existing `direct-backend-guard.test.ts` + `openapi-parity.test.ts` to prove **zero regression** on `/v1/*`
5. Verify all `/developer/integration-layer/*` URLs return 200 anonymously (Order P1)
6. Static scan for forbidden domains via existing `scripts/scan-forbidden-domains.sh`

Final inline report: PASS/FAIL per phase + gap closure table + links to artifacts.

---

## Files Created (additive)
- `supabase/functions/integration-layer/index.ts`
- `supabase/functions/integration-layer/index.test.ts`
- `supabase/functions/_shared/integration-layer/{router,normalize,webhooks,sandbox,idempotency}.ts`
- `packages/sdk-node/src/integration/*` (+ version bump to 1.3.0)
- `packages/sdk-php/src/Resources/IntegrationResource.php`
- `src/pages/developer/integration-layer/*` (public route)
- `src/test/integration-layer-e2e.test.ts`
- `INTEGRATION_LAYER_AUDIT.md`, `INTEGRATION_LAYER_GAP_REPORT.md`, `INTEGRATION_LAYER_FIX_REPORT.md`
- DB migration: `integration_idempotency_keys`, `integration_webhook_replays` (new tables, RLS enforced)

## Files Modified (additive only)
- `public-api-spec` edge function: append `/integration-layer/*` paths (info.version → 4.10.0)
- `supabase/config.toml`: register new function (no `verify_jwt` change needed)
- Developer portal route registry: add public routes block

## Files NOT Touched
- Any existing `/v1/*` handler
- Any existing schema in `public-api-spec`
- Any existing OAuth function
- `src/integrations/supabase/{client,types}.ts`


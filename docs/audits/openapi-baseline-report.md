# OpenAPI Baseline Report — Phase 0

**Date**: 2026-04-30  
**Scope**: KOB Mega Mandate — read-only baseline of OpenAPI contract maturity  
**Spec source**: `public/openapi.json` (mirror of `public-api-spec` edge function)  
**Spec version**: **4.17.3**

---

## 1. Headline Numbers

| Metric | Value |
|---|---|
| Total operations | **344** |
| Total paths | **291** (294 unique `/v1/*`) |
| Total component schemas | **54** |
| Duplicate operationIds | **0** |
| Operations missing 2xx schema | **2** (sandbox only) |
| Operations missing requestBody schema | **0** |
| Operations missing security declaration | **0** |
| Operations missing operationId | **0** |
| Operations missing tags | **0** |
| Operations missing summary/description | **0** |

**Verdict**: KOB is already at **gateway-grade contract maturity**. The two outstanding gaps are isolated to two sandbox utility endpoints.

---

## 2. Outstanding Gaps (entire list)

### 2.1 Missing 2xx response schema

| Operation | Action |
|---|---|
| `POST /v1/sandbox/webhooks/send-test` 200 | Add typed `SandboxWebhookSendResult` schema |
| `POST /v1/sandbox/reset` 200 | Add typed `SandboxResetResult` schema |

Both are routed through `sandbox-router` and are zero-risk (sandbox-only, no production impact).

### 2.2 Other gaps

None.

---

## 3. Domain Coverage (operations per tag, top 20)

```text
Payment Gateway              98
Admin                        14
Merchant Onboarding          13
Standards                    11
AISP                         10
KYC & Compliance             10
Sandbox                      10
Approval Workflows           10
Monitoring                    9
OAuth                         9
Loans                         8
Webhooks                      8
Operational Controls          8
Bank Directory                8
Bank Connectors               8
Savings                       7
Overdraft                     7
Authentication                6
WooCommerce                   6
Consumer Tools                6
```

---

## 4. Webhook & Lifecycle Surface (already present)

The mandate enumerates desired endpoints. All but a handful **already exist**:

| Mandate item | Existing path | Status |
|---|---|---|
| Inbound Stripe webhook | `/v1/webhooks/providers/stripe` | Present |
| Inbound Flutterwave webhook | `/v1/webhooks/providers/flutterwave` | Present |
| Inbound PayPal webhook | `/v1/webhooks/providers/paypal` | Present |
| Outbound endpoint CRUD | `/v1/webhooks/v2/endpoints`, `/v1/webhooks/v2/endpoints/{id}` | Present |
| Bulk delivery replay | exists in `gateway-webhook-deliver-v2` | Present |
| Per-endpoint deliveries | `/v1/webhooks/{webhookId}/deliveries` | Present |
| Secret rotation | `/v1/gateway/merchants/webhooks/{webhookId}/rotate-secret` | Present |
| Merchant CRUD | `/v1/merchants` | Present |
| Merchant KYB | `/v1/merchants/kyb`, `/v1/institutions/{institutionId}/kyb` | Present |
| Merchant API keys | `/v1/merchants/api-keys` | Present |
| Settlement accounts | `/v1/merchants/settlement-accounts` | Present |
| Reconciliation queue | `/v1/reconciliation/mismatches`, `/v1/reconciliation/mismatches/{id}/resolve` | Present |
| Fee reports | `/v1/gateway/reports/fees` | Present |
| Settlement reports | `/v1/gateway/reports/settlements` | Present |
| Transaction reports | `/v1/gateway/reports/transactions` | Present |
| Transactions export | `/v1/gateway/export/transactions` | Present |

### Identified additive opportunities (none are blockers)

| Item | Status | Action |
|---|---|---|
| **Settlements CSV export** | Not present (only transactions has dedicated export path) | Add `GET /v1/gateway/export/settlements` |
| **Fees CSV export** | Not present | Add `GET /v1/gateway/export/fees` |
| **Single-delivery replay** | Bulk replay only | Add `POST /v1/webhooks/v2/endpoints/{id}/deliveries/{deliveryId}/replay` |
| **Endpoint health snapshot** | Not present | Add `GET /v1/webhooks/v2/endpoints/{id}/health` (24h success rate, p95 latency, dead-letter count) |

---

## 5. Existing Test Coverage

The repo already runs the following contract / webhook tests under `src/test/`:

```text
gateway-contract.test.ts
idempotency-contract.test.ts
openapi-diff.test.ts
openapi-fixtures.test.ts
openapi-parity.test.ts
openapi-servers.test.ts
pagination-contract.test.ts
rate-limit-contract.test.ts
status-version-contract.test.ts
webhook-event-schemas.test.ts
webhook-replay-e2e.test.ts
webhook-replay-protection.test.ts
webhook-signature-parity.test.ts
```

Plus 30+ other tests covering i18n, security headers, CORS, response validation, etc.

### Identified additive test opportunities

| Test | Purpose |
|---|---|
| `openapi-2xx-schema-coverage.test.ts` | CI ratchet — fails build if any non-204 2xx lacks schema |
| `openapi-operation-id-uniqueness.test.ts` | CI ratchet — fails on duplicate operationIds |
| `openapi-security-declared.test.ts` | CI ratchet — fails if any operation missing `security[]` |
| `webhook-inbound-stripe.test.ts` / `flutterwave` / `paypal` | E2E signature + dedupe + state-update verification |

---

## 6. Edge Function Inventory

- **350** edge functions in `supabase/functions/`
- **3** routers expose `/v1/*` paths: `gateway`, `payment-facilitation-router`, `sandbox-router`
- Provider webhook handlers: `gateway-webhook-stripe`, `gateway-webhook-flutterwave`, `gateway-webhook-paypal`, plus `bank-transaction-webhook`, `flutterwave-transfer-webhook`, `pos-woo-webhook-ingestion`, `remittance-client-webhooks`
- Outbound delivery: `gateway-webhook-deliver-v2`, `gateway-deliver-webhook`, `webhook-delivery`
- Sandbox testing: `sandbox-test-webhook`, `sandbox-trigger-webhook`, `sandbox-register-webhook`

---

## 7. Database — Webhook Tables (existing migrations)

Seven migrations touch webhook tables: `20251018005013`, `20260216212726`, `20260223224937`, `20260304030545`, `20260308211903`, `20260325192029`, `20260417115348`.

Confirmed tables (used in production code):
- `webhook_inbox` — provider event dedupe + raw payload
- `gateway_webhook_endpoints` — per-merchant endpoints + per-endpoint signing secrets
- `gateway_webhook_deliveries_v2` — full delivery log with attempts, response codes, status

---

## 8. Decision Matrix for Phase 1+

Given the baseline, Phase 1 (OpenAPI contract maturity) reduces to a **2-line fix** plus the **4 CI ratchet tests**. This frees Phase 2 to focus purely on the **4 additive opportunities** (single-delivery replay, endpoint health, settlements/fees CSV exports), and Phase 5 to focus on **portal polish and example coverage** rather than missing pages.

### Revised effort estimate

| Phase | Original estimate | Revised estimate |
|---|---|---|
| 1 — OpenAPI maturity | Major | **Minor** (2 schemas + 4 tests) |
| 2 — Webhook reliability | Major | **Moderate** (4 additive endpoints + dashboards) |
| 3 — Merchant lifecycle | Major | **Audit-only** (everything exists) |
| 4 — Reconciliation | Major | **Minor** (2 CSV exports) |
| 5 — Portal parity | Major | **Audit + polish** |
| 6 — E2E tests | Major | **Moderate** (3 inbound webhook tests) |
| 7 — Changelog | Minor | **Minor** (bump 4.17.3 → 4.17.4) |

---

## 9. Standing Order Compliance

- **SO #1 (The Lock)**: No renames or removals planned.
- **SO #2 (The Ratchet)**: All proposed changes add fields/operations.
- **SO #3 (Audit Trail)**: Each change in subsequent phases will cite its standard.
- **SO #4 (Surgeon Rule)**: All additive.
- **SO #5 (Dead Code Rule)**: New schemas (`SandboxWebhookSendResult`, `SandboxResetResult`, `WebhookEndpointHealth`) immediately referenced.
- **SO #6 (Version Gate)**: Patch bump 4.17.3 → 4.17.4 for Phase 1; further bumps per phase.
- **SO #7 (Five Roles)**: Reinstated for this mandate.

---

## 10. Next Step

Pause here for review. On approval, proceed to **Phase 1**:
1. Add `SandboxWebhookSendResult` + `SandboxResetResult` schemas in `public-api-spec/index.ts`.
2. Wire them into the two operations.
3. Add 4 new ratchet tests in `src/test/`.
4. Bump `info.version` to **4.17.4**.
5. Run `bunx vitest run` — must be green.
6. Commit `docs/audits/openapi-after-contract-fix.md` with before/after counts.

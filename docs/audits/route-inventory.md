# Route Inventory — Phase 0 Baseline

**Date**: 2026-04-30  
**Total `/v1/*` paths**: 294  
**Total operations**: 344  
**Total edge functions**: 350  
**Routers**: `gateway`, `payment-facilitation-router`, `sandbox-router`

---

## Routers

| Router | Purpose |
|---|---|
| `supabase/functions/gateway/index.ts` | Primary `/v1/gateway/*` and core REST surface |
| `supabase/functions/payment-facilitation-router/index.ts` | Marketplace / split payment flows |
| `supabase/functions/sandbox-router/index.ts` | `/v1/sandbox/*` surface |

---

## Webhook Surface (full)

### Inbound (provider)
- `POST /v1/webhooks/providers/stripe` → `gateway-webhook-stripe`
- `POST /v1/webhooks/providers/flutterwave` → `gateway-webhook-flutterwave`
- `POST /v1/webhooks/providers/paypal` → `gateway-webhook-paypal`
- `POST /v1/woocommerce/webhook` → `pos-woo-webhook-ingestion`
- Plus internal: `bank-transaction-webhook`, `flutterwave-transfer-webhook`, `remittance-client-webhooks`

### Outbound (merchant)
- `POST /v1/webhooks/v2/endpoints` (create)
- `GET  /v1/webhooks/v2/endpoints` (list)
- `GET  /v1/webhooks/v2/endpoints/{endpointId}` (read)
- `PATCH /v1/webhooks/v2/endpoints/{endpointId}` (update)
- `DELETE /v1/webhooks/v2/endpoints/{endpointId}` (delete)
- `GET  /v1/webhooks/v2/deliveries` (deliveries)
- `GET  /v1/webhooks/{webhookId}/deliveries` (legacy per-endpoint)
- `POST /v1/gateway/merchants/webhooks/{webhookId}/rotate-secret`
- Bulk replay handled inside `gateway-webhook-deliver-v2`

---

## Merchant Lifecycle Surface

| Concern | Path |
|---|---|
| Create / list merchants | `/v1/merchants` |
| API keys | `/v1/merchants/api-keys` |
| KYB submission | `/v1/merchants/kyb` |
| Institution KYB | `/v1/institutions/{institutionId}/kyb` |
| Settlement accounts | `/v1/merchants/settlement-accounts` |
| Webhooks (legacy alias) | `/v1/merchants/webhooks` |

---

## Reconciliation, Reports, Exports

| Concern | Path |
|---|---|
| Mismatch queue | `/v1/reconciliation/mismatches` |
| Resolve mismatch | `/v1/reconciliation/mismatches/{mismatchId}/resolve` |
| Bank reconcile | `/v1/safeguarding/reconcile` |
| Gateway reconciliation | `/v1/gateway/reconciliation` |
| Fees report | `/v1/gateway/reports/fees` |
| Settlements report | `/v1/gateway/reports/settlements` |
| Transactions report | `/v1/gateway/reports/transactions` |
| Transactions CSV export | `/v1/gateway/export/transactions` |
| Settlements list | `/v1/gateway/settlements` |
| Settlement detail | `/v1/gateway/settlements/{settlementId}` |

---

## Sandbox Surface

| Path | Notes |
|---|---|
| `/v1/sandbox/api-keys` | Tiered key issuance (`sbx_*`) |
| `/v1/sandbox/webhooks` | Sandbox webhook registration |
| `/v1/sandbox/webhooks/send-test` | **Missing 2xx schema** (Phase 1 fix) |
| `/v1/sandbox/reset` | **Missing 2xx schema** (Phase 1 fix) |
| `/v1/sandbox/events/simulate` | Routed via `sandbox-router` → `sandbox-trigger-webhook` |
| `/v1/sandbox/payments/simulate` | Routed via `sandbox-router` → `sandbox` |

---

## Tag Distribution (full)

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
Interbank                     6
Pay by Bank                   6
Credit Scoring                5
Ledger                        5
Payments                      5
Banking Operations            5
Virtual Cards                 5
Standards - ISO 20022         5
Security                      4
PISP                          4
Mobile Money                  4
CrediQ                        4
Certificates                  3
Consent Management            3
Institution                   3
Payment Facilitation          3
Provider Webhooks (Inbound)   3
Communications                2
PostiQ                        2
Directory                     1
Settlement                    1
Developer                     1
```

---

## Promise

This inventory is the **baseline snapshot**. The final Phase 7 report will diff against this list and prove **zero existing routes were removed or renamed** — only additions.

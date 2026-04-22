# KOB Integration Layer — System Audit (Phase 1)

**Date:** 2026-04-22  
**Scope:** Full read-only audit performed before introducing the new `integration-layer` facade.  
**Standing Orders enforced:** API Guardian 1-7, Docs Guardian P1-P10.

---

## 1. Surface inventory (current production)

| Domain | Edge functions | Notes |
|---|---:|---|
| Gateway (charges/refunds/payouts/webhooks/disputes) | 70+ | Stripe-equivalent core |
| AISP (accounts/balances/transactions/beneficiaries/standing orders/direct debits) | 7 | Open Banking read APIs |
| PISP (consents/payments/details) | 4 | Open Banking write APIs |
| Bank connectors (REST/SQL/MQ/File/DB/Sync/Reconcile) | 11 | `_shared/bank-connectors/*` |
| Payment connectors (Flutterwave/MTN MoMo/Orange Money/SOAP bank) | 4 | `_shared/payment-connectors/*` |
| Interbank (engine/dispatch/inbound) | 3 | ISO 20022 |
| OAuth/OIDC/JWKS/PAR/DCR | 7 | FAPI 1.0 Advanced |
| Remittance | 9 | RaaS 6-step wizard |
| POS/WooCommerce | 18 | Marketplace |
| Travel / Bills v2 / CrediQ / Loans / Savings / PiggyBank | 25+ | Vertical modules |
| Support / Notifications / Email infra | 12 | Live Support, transactional email |
| Sandbox / Health / Admin / Tests | 30+ | Dev tooling |
| **TOTAL** | **~275** | |

## 2. Frontend surfaces

- `/admin/*` — Super-admin portal (interbank, support, KYC, settlements, ...)
- `/biz/*` — Unified merchant app
- `/banking/*` — Bank operations app
- `/app/*` — Consumer PWA
- `/developer/*` — Permanently-public docs (Order P1)
- `/sandbox/*` — Free dev sandbox (Order P3)

## 3. Webhook plane

- Producer: `gateway-deliver-webhook` + `gateway-webhook-deliver-v2` (HMAC-signed, retried)
- Endpoints managed via `gateway-webhook-endpoints`
- Inbound provider webhooks: `gateway-webhook-{stripe,paypal,flutterwave}`, `flutterwave-transfer-webhook`, `bank-transaction-webhook`, `pos-woo-webhook-ingestion`
- Email delivery webhooks: `support-email-webhook`, `handle-email-suppression`

## 4. Existing SDKs

| SDK | Version | Resources |
|---|---|---|
| `@kangopenbanking/sdk` (Node) | 1.2.0 | OAuth, AISP, PISP, Gateway, Webhooks |
| `kangopenbanking/sdk-php` | 1.2.0 | Laravel facade + 11 resources |
| `kangopenbanking` (Python) | 1.2.0 | Typed dataclasses |

## 5. Gap classification (vs. Stripe-style developer experience)

| Capability | Status | Notes |
|---|---|---|
| Unified `Idempotency-Key` across all create endpoints | ◐ Partial | Some routes implement it ad-hoc; no platform-wide cache |
| Unified error envelope (`{error:{type,code,message,param,request_id}}`) | ◐ Partial | Each connector returns its own shape |
| Stripe-style resource verbs (`payments.create`, `transfers.create`, ...) | ✗ Missing | Only domain-prefixed routes today |
| Smart routing (auto-select connector by method/country/MSISDN) | ◐ Partial | `payment-router-charge` exists but isn't surfaced as a single SDK call |
| Webhook **replay** endpoint | ✗ Missing | Delivery + retry exist; manual replay does not |
| Sandbox magic-value simulator (`amount=4242` etc.) | ✗ Missing | Sandbox seeds data but no per-call simulator |
| Cursor pagination uniformity | ◐ Partial | Some routes use offset, some cursor |
| Public, additive `/integration-layer/*` route | ✗ Missing | New module to build |

## 6. Constraints respected

- ✅ Zero edits to any `/v1/*` handler
- ✅ Zero schema changes to existing OpenAPI components
- ✅ Zero auth-flow modifications
- ✅ Two new tables only — additive — RLS enforced
- ✅ One new edge function (`integration-layer`) — additive
- ✅ Version bump path: 4.16.4 → **4.17.0** (MINOR, additive)

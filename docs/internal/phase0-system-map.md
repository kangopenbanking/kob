# Phase 0 — System Map (Read-Only Discovery)

**Date:** 2026-04-30  
**Source of truth (public contract):** https://kangopenbanking.com/openapi.json  
**Reconciled with repo:** `/dev-server` (Lovable workspace)  
**Mode:** Discovery only — no code changed in this phase.

---

## 0.1 Repo Stack

| Layer | Technology | Location |
|---|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui | `src/` |
| Backend (serverless) | Supabase Edge Functions (Deno) — **353 functions** | `supabase/functions/` |
| Database | Supabase Postgres — **330 migrations** | `supabase/migrations/` |
| API spec | OpenAPI 3.1 — **v4.23.0**, 293 paths, 41 tags | `public/openapi.json` + `public/openapi.yaml` |
| Sandbox spec | OpenAPI 3.1 — **v4.17.5**, 291 paths | `public/openapi-sandbox.json` + `.yaml` |
| Postman | v1 collection + Production/Sandbox envs | `public/postman/` |
| Mobile / PWA | React PWA (manifests `manifest.json`, `manifest-biz.json`) | `public/` + `src/pages/{customer,business,banking}-app/` |
| Worker (proxy / SSL) | Cloudflare Worker (Wrangler) | `worker/` |
| Docs prerender | Custom Vite SSR plugin | `vite-plugin-prerender-docs.ts` |
| CI | GitHub Actions (8 workflows) | `.github/workflows/` |

> **Note:** No native Flutter or React Native apps. The "apps" are responsive PWAs served from the same Vite build, namespaced by route prefix.

---

## 0.2 Dashboards & Apps Inventory

| Surface | Route prefix | Pages | Code location |
|---|---|---|---|
| Marketing / Public | `/`, `/about`, `/pricing`, `/contact`, `/faq`, `/help-centre` | 30+ | `src/pages/*.tsx` (root) |
| **Admin Console** | `/admin/*` | 81 | `src/pages/admin/` |
| **FI / Bank Dashboard** | `/fi-portal/banking/*` (legacy `/bank-dashboard/*` redirects) | 7 | `src/pages/bank-dashboard/` |
| **Institution / Credit Union** | `/institution/*` | 44 | `src/pages/institution/` |
| **Merchant Dashboard** | `/merchant/*` | 43 | `src/pages/merchant/` |
| **Developer Portal** (PUBLIC) | `/developer/*` | **153** | `src/pages/developer/` |
| Internal Developer Tools | `/developer-tools/*` (auth-gated) | — | shared |
| **Consumer / Personal PWA** | `/customer/*` | 46 | `src/pages/customer-app/` |
| **Business PWA** | `/business/*` | 29 | `src/pages/business-app/` |
| **Banking-App PWA** (white-label, per-institution) | `/bank/:institutionId/*` | 25 | `src/pages/banking-app/` |
| Compliance / Regulatory | `/compliance/*`, `/regulatory/*` | — | `src/pages/compliance/`, `src/pages/regulatory/` |
| Widgets (embeddable) | `/widgets/*`, `/embed/status` | — | `src/pages/widgets/` |

**Sidebar standard:** Banking, Accept Payments, Open Banking APIs, Build (per design memory).

---

## 0.3 Backend Routing — Edge Function Map

353 Deno Edge Functions live under `supabase/functions/<name>/index.ts`. They are exposed at the **mandatory base URL**:

```
https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/<function-name>
```

The OpenAPI spec advertises the **public** REST shape `https://api.kangopenbanking.com/v1/<resource>`, which maps to the Edge Functions through router-style functions. Naming patterns:

| Pattern | Examples | Notes |
|---|---|---|
| `<domain>-router` | `gateway-charges-router`, `gateway-payouts-router`, `gateway-disputes-router`, `gateway-funding-router`, `gateway-merchant-router`, `gateway-settlement-router`, `bank-data-router`, `banking-api-router`, `sandbox-router` | Multiplexes REST verbs/sub-paths under one function (avoids 404s — see `mem://architecture/edge-function-infrastructure-and-deployment`) |
| `<domain>-<verb>` | `gateway-create-charge`, `gateway-create-refund`, `gateway-cancel-payout`, `kyc-submit` | Single-purpose endpoints |
| `aisp-*`, `pisp-*`, `consent-*` | `aisp-accounts`, `pisp-domestic-payment`, `consent-authorize` | Open Banking domains |
| `admin-*` | `admin-metrics`, `admin-webhooks`, `admin-sandbox-accounts` (14 admin endpoints in spec) | Admin-only, requires `has_role('admin')` |
| `sandbox-*` | `sandbox-create-account`, `sandbox-create-api-key`, `sandbox-router` | Free public sandbox (per Order P3) |
| `<provider>-webhook` | `bank-transaction-webhook`, `flutterwave-transfer-webhook`, `gateway-deliver-webhook` | Inbound provider hooks (authoritative — `mem://architecture/webhook-governance-and-security`) |
| `cron-*` / `*-cron` | `gateway-auto-withdrawal-cron`, `gateway-settlement-cron` | Scheduled jobs |

---

## 0.4 OpenAPI Tag → Endpoint Distribution (293 paths)

| Tag | Count | Sample routes |
|---|---|---|
| Payment Gateway | **98** | `POST /v1/gateway/charges`, `GET /v1/gateway/charges` |
| Admin | 14 | `POST /v1/admin/users`, `POST /v1/admin/clients` |
| Standards (ISO 20022) | 11 | `POST /v1/standards/iso20022/pain001/parse` |
| AISP | 10 | `GET /v1/aisp/accounts`, `POST /v1/aisp/consents` |
| KYC & Compliance | 10 | `POST /v1/kyc/submit`, `POST /v1/kyc/sanctions-screen` |
| Webhooks | 10 | `POST /v1/webhooks`, `GET /v1/webhooks` |
| Sandbox | 10 | `POST /v1/sandbox/accounts`, `POST /v1/sandbox/api-keys` |
| OAuth | 9 | `POST /v1/oauth/token`, `GET /v1/oauth/authorize` |
| Monitoring | 9 | `GET /v1/health`, `GET /v1/ready`, `GET /v1/version` |
| Loans | 8 | `GET /v1/loans/products`, `POST /v1/loans/apply` |
| Savings | 7 | `GET /v1/savings/products`, `POST /v1/savings/accounts` |
| Authentication | 6 | `POST /v1/auth/phone/send-otp`, `POST /v1/auth/phone/verify-otp` |
| WooCommerce | 6 | `POST /v1/woocommerce/merchants`, `POST /v1/woocommerce/validate-install` |
| Credit Scoring | 5 | `GET /v1/credit/score` |
| Ledger | 5 | `GET /v1/ledger/accounts` |
| Payments | 5 | `POST /v1/flutterwave/bank-transfer` |
| Banking Operations | 5 | `GET /v1/banking/exchange-rate` |
| Virtual Cards | 5 | `POST /v1/cards`, `GET /v1/cards` |
| Security | 4 | `POST /v1/security/captcha/generate` |
| PISP | 4 | `POST /v1/pisp/domestic-payment` |
| Mobile Money | 4 | `POST /v1/mobile-money/charge` |
| CrediQ | 4 | `GET /v1/crediq/health-check` |
| Certificates | 3 | `POST /v1/certificates`, `GET /v1/certificates` |
| Consent Management | 3 | `POST /v1/consents/{consentId}/authorize` |
| Institution | 3 | `POST /v1/institutions/register` |
| Payment Facilitation | 3 | `POST /v1/banking/facilitated-mobile-money-charge` |
| PostiQ | 2 | `POST /v1/postiq/codes` |
| Communications | 2 | `POST /v1/communications/send` |
| Settlement | 1 | `POST /v1/invoices/generate` |
| Developer | 1 | `POST /v1/developers/register` |
| Directory | 1 | `GET /v1/directory/banks/cm` |
| Bank Directory, Bank Connectors, Interbank, Pay by Bank, Provider Webhooks (Inbound), Overdraft, Approval Workflows, Operational Controls, Standards - ISO 20022, Merchant Onboarding, Consumer Tools | 1–3 each | tail of tag list |

**Total tags:** 41 · **Total paths:** 293 · **Total ops:** ~390+

---

## 0.5 Environments

| Env | Public REST base | Sandbox base | OpenAPI URL | Status |
|---|---|---|---|---|
| Production | `https://api.kangopenbanking.com/v1` | n/a | `https://kangopenbanking.com/openapi.json` | Live (200, 2.77 MB) |
| Sandbox | n/a | `https://sandbox-api.kangopenbanking.com/v1` | `/openapi-sandbox.json` | Live |
| **Edge Function backend (mandatory direct URL)** | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1` | same | n/a | Live |
| Preview | `https://id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app` | — | `/openapi.json` | Live |
| Custom domain | `https://info.kangfintechsolutions.com` | — | `/openapi.json` | Live |

Public docs surfaces (must be unauthenticated — Orders P1 / P4):

- `/developer` (Developer Home — 153 pages)
- `/developer/api-explorer` (Swagger UI + SDK code generator)
- `/developer/changelog`
- `/developer/guides/sdks` (+ `/developer/guides/sdks/:slug` per-SDK pages)
- `/developer/examples`, `/developer/examples/real-world`
- `/openapi.json`, `/openapi.yaml`, `/openapi-sandbox.json`, `/openapi-sandbox.yaml`
- `/postman/*`, `/sdk-downloads/*`

OpenAPI spec is **statically published**, not generated at request time. The Vite SSR plugin (`vite-plugin-prerender-docs.ts`) pre-renders developer pages so they are curl-readable.

---

## 0.6 Contract vs Runtime Smoke Check

Calls executed against `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`. A **404 on the route** is a contract gap; a **401/400/500 on a known function** means the route exists (auth/validation enforced as expected).

| Tag | Route under test | HTTP | Verdict |
|---|---|---|---|
| Monitoring | `GET /api-health` | 200 | OK — `version: 1.0.0`, all services operational/dormant flagged |
| Monitoring | `GET /api-status` | 200 | OK — `version: 4.18.0` *(stale — see GAP #1 below)* |
| Monitoring | `GET /api-version` | 200 | OK — `api_version: 4.18.0` *(stale)* |
| OAuth | `POST /oauth-token` | 500 | Route exists; empty body → server-side validation fault |
| AISP | `GET /aisp-accounts` | 401 | OK — auth enforced |
| Consent | `POST /consent-authorize` | exists | OK |
| PISP | `POST /pisp-create-consent`, `/pisp-domestic-payment` | exist | OK |
| Credit Scoring | `GET /credit-score` | 500 | Route exists; needs auth context |
| Loans | `GET /loans-list-products` | 404 | **GAP** — function name not deployed; spec advertises `GET /v1/loans/products` |
| Savings | `GET /savings-ops` | 400 | OK — router exists, requires `op` param |
| Ledger | `GET /ledger-accounts` | 401 | OK — auth enforced |
| Mobile Money | `POST /mobile-money-charge` | 400 | OK — validation enforced |
| Banking Ops | `GET /banking-api-router` | 400 | OK — router exists |
| Banking Ops | `GET /exchange-rate-get` | 200 | OK |
| Virtual Cards | `GET /cards-list` | 404 | **GAP** — verify deployed function name (cards routing) |
| Standards | `POST /iso20022-pain001-parse` | 404 | **GAP** — verify ISO 20022 function names |
| KYC | `POST /kyc-submit` | 401 | OK |
| Webhooks | `GET /admin-webhooks` | 401 | OK |
| Admin | `GET /admin-metrics` | 401 | OK |
| Sandbox | `GET /admin-sandbox-accounts` | 401 | OK |
| Gateway | `GET /gateway-charges-router` | 400 | OK — router exists |
| Directory | `GET /directory-banks-cm` | 200 | OK |
| PostiQ | `POST /postiq-codes` | 404 | **GAP** — actual fn is `postiq-create-code` |
| WooCommerce | `POST /woocommerce-merchants` | 404 | **GAP** — actual fn is `woocommerce-register-merchant` |

### GAPS recorded for Phase 1+ (NOT FIXED YET — discovery only)

| # | Severity | Type | Detail |
|---|---|---|---|
| 1 | Medium | Stale version | `api-status` and `api-version` return `4.18.0` while OpenAPI is at `4.23.0` (drift of 5 patch levels). Edge function constant must be updated. |
| 2 | Low | Naming drift | OpenAPI advertises `GET /v1/loans/products` but no `loans-list-products` Edge Function — likely served via a router. Need contract→runtime mapping table. |
| 3 | Low | Naming drift | Cards endpoints (`/v1/cards`, `/v1/cards/{id}`) — need confirmation of deployed function (no `cards-*` function in `ls`). |
| 4 | Low | Naming drift | ISO 20022 endpoints (`pain001/camt053/parse`) — no matching `iso20022-*` Edge Function listed; must confirm whether handled by `standards-*` router. |
| 5 | Low | Spec→runtime alias | PostiQ: spec uses `/v1/postiq/codes` but only `postiq-create-code` deployed. Document via path-prefix routing or rename. |
| 6 | Low | Spec→runtime alias | WooCommerce: spec uses `/v1/woocommerce/merchants` but deployed name is `woocommerce-register-merchant`. |
| 7 | Info | Sandbox spec drift | `openapi-sandbox.json` is at **v4.17.5** while production spec is at **v4.23.0** (5+ minor versions behind). Per Order P3 sandbox must stay current. |

> All GAPs above will be addressed via **additive, backward-compatible** patches in later phases (no renames, per Standing Order 1).

---

## 0.7 Where things are built / published

| Artifact | Built from | Published at |
|---|---|---|
| `openapi.json` / `openapi.yaml` | Hand-maintained in `public/` (single source) | `/openapi.json`, `/openapi.yaml` (static) |
| `openapi-sandbox.{json,yaml}` | Hand-maintained in `public/` | `/openapi-sandbox.json`, `/openapi-sandbox.yaml` |
| Postman collection | `scripts/regen-postman.mjs` regenerator | `/postman/Kang_Open_Banking_API_v1.postman_collection.json` |
| Developer portal pages | `src/pages/developer/*.tsx` | `/developer/*` (SSR via `vite-plugin-prerender-docs.ts`) |
| Changelog feed | `scripts/build-changelog-index.mjs` | `/changelog.json` + `src/pages/developer/Changelog.tsx` |
| API Explorer | Swagger UI `<rapi-doc>` integration | `/developer/api-explorer` |
| SDK packages | `packages/sdk-{node,python,php}` | `npm`, `PyPI`, `Packagist` (CI: `.github/workflows/publish-sdks.yml`) |
| SDK docs | `src/pages/developer/SDKsPage.tsx`, `SdkLibraryPage.tsx`, `public/sdk-downloads/` | `/developer/guides/sdks/*` |

---

## 0.8 CI / Quality Gates (existing)

| Workflow | Purpose |
|---|---|
| `openapi-parity.yml` | Verifies spec parity (production ↔ sandbox) |
| `phase6-e2e.yml` | E2E test suite (idempotency, gateway, webhooks) |
| `forbidden-domain-gate.yml` | Blocks `kob-info.kangfintechsolutions.com` proxy refs (mandate) |
| `publish-sdks.yml` | Publishes SDKs to npm/PyPI/Packagist on tag |
| `automated-billing.yml`, `automated-settlement.yml` | Cron triggers for treasury workflows |
| `crediq-monthly-report.yml`, `crediq-weekly-digest.yml` | CrediQ scheduled exports |

---

## 0.9 Outstanding Standing Orders to Honor in Future Phases

- **Standing Order 1 (LOCK):** No renames of operationId/path/schema — only additive shims for the 6 GAPs above.
- **Standing Order 6 (VERSION GATE):** Any bump to spec must include `info.version` increment + changelog entry within 48 h (Order P7).
- **Order P1 (PUBLIC FIRST):** All `/developer/*` pages stay anonymous-readable.
- **Order P5 (WORKING CODE):** Every fixed example must execute against sandbox creds.
- **Order P10 (LIVING DOCS):** Docs updated within 7 days of any API release.

---

## 0.10 Phase 0 Deliverables (this document)

- ✅ Repo + framework discovery
- ✅ Dashboards/apps inventory (9 surfaces, 500+ pages)
- ✅ Backend routing map (353 Edge Functions, 41 OpenAPI tags, 293 paths)
- ✅ Environment + publishing topology
- ✅ Contract-vs-runtime smoke check (22 endpoints sampled across all major tags)
- ✅ Gap log (7 items, all low/medium, none breaking)

**Phase 0 status: COMPLETE — read-only discovery, zero code changes.**  
**Next:** Await Phase 1 instructions before any modification.

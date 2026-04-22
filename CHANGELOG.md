# Changelog

All notable changes to the Kang Open Banking API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [4.17.0] — 2026-04-22

### Added — KOB Integration Layer (Stripe-style facade)

Strictly additive release. **No existing `/v1/*` endpoint, schema, or auth flow has been modified**
(STANDING ORDER 1 — The Lock; STANDING ORDER 4 — Surgeon Rule).

- New edge function `POST /functions/v1/integration-layer/{resource}.{action}` — unified router
  across `customers`, `accounts`, `payments`, `transfers`, `payouts`, `refunds`, `webhooks`, `sandbox`.
- Unified response envelope `{ id, object, status, amount, currency, created, livemode, metadata, data }`
  and unified error envelope `{ error: { type, code, message, param, request_id, upstream } }`.
- Smart routing engine (method × country × MSISDN) with automatic fallback chain; delegates to existing `/v1/*` handlers.
- Platform-wide `Idempotency-Key` support via new `integration_idempotency_keys` table (24h TTL).
- Webhook replay action + `integration_webhook_replays` audit table.
- Sandbox magic-value simulator (`4242` / `4000` / `5555` / `9999`) gated by `x-integration-env: sandbox` (ORDER P3).
- Public discovery: `GET /integration-layer` and public docs at `/developer/integration-layer` (ORDER P1, P4).
- `@kangopenbanking/sdk` bumped to **1.3.0** with new `kob.integration.*` namespace (ORDER P9).
- OpenAPI `info.version` → **4.17.0** (additive only).

## [4.16.4] — 2026-04-21

### Added — Security Posture Self-Verification Layer
- New public edge function `/healthz` returning a reviewer-friendly JSON snapshot with live probes
  for OAuth, OIDC, JWKS, DCR, PAR; declared posture for mTLS, JAR, PKCE, and webhooks (FAPI 1.0 Advanced).
- `/oidc-config` hardened with ETag, conditional GET (304), `Cache-Control: public, max-age=3600,
  stale-while-revalidate=86400`, plus `op_policy_uri`, `op_tos_uri`, `key_rotation_policy_uri`.
- New public pages `/developer/security` and `/developer/security/whitepaper` + downloadable PDF
  at `/whitepapers/security-compliance.pdf`.
- Existing `/developer/compliance` route preserved (zero removals — STANDING ORDER 1).

## [4.15.0] — 2026-04-17

### Added — CEMAC Universal Bank Integration (Wave 4)
- New public developer page `/developer/connectors/cemac-bank-integration` documenting the full
  BankConnector architecture, adapter decision matrix, delivery waves, and operating runbook (ORDER P6).
- OpenAPI `info.version` → 4.15.0 (zero changes to operationIds, schemas, parameters, security
  schemes, or response codes — STANDING ORDER 1).

## [4.14.0] — 2026-04-17

### Added — CEMAC Universal Bank Integration (Wave 3)
- Ledger audit fields added to bank-sourced transaction tables (additive columns only).
- Six-stage bank onboarding wizard surfaced in the admin portal.

## [4.13.0] — 2026-04-17

### Added — CEMAC Universal Bank Integration (Wave 2)
- Scheduled bank polling engine for pull-mode connectors.
- Rule-based reconciliation worker for incoming bank statements.

## [4.12.0] — 2026-04-17

### Added — CEMAC Universal Bank Integration (Wave 1)
- Unified `BankConnector` interface supporting REST, SQL, File, and SOAP adapters.
- Adapter registry and per-bank configuration model.

## [4.11.0] — 2026-04-17

### Added — BYO Phase 2
- Server-side polling worker for direct mobile-money rails.
- SOAP Bank adapter for legacy core-banking systems.

## [4.10.0] — 2026-04-17

### Added — BYO Mobile Money Connectors (Bring-Your-Own Credentials)

### Added — BYO Mobile Money Connectors (Bring-Your-Own Credentials)

Strictly additive release. Flutterwave remains the default KOB-managed rail and the automatic
fallback for every charge. Institutions, merchants, and developers may now optionally register
their own MTN MoMo or Orange Money API credentials and route charges through their own provider
accounts via the new `payment-router-charge` endpoint.

#### Edge Functions (new)
- `tenant-connectors-manage` — create / update / delete a tenant's connector credentials. Owners only.
- `tenant-connectors-list` — list a tenant's registered connectors (secrets never returned).
- `tenant-connectors-test` — runs `healthCheck()` against stored credentials and updates `health_status`.
- `payment-router-charge` — opt-in router. Resolves the caller's `tenant_payment_connectors` rows in
  priority order, attempts each, and falls back to platform Flutterwave on failure. Returns the full
  attempt trail.

#### Connector Framework (new — `_shared/payment-connectors/`)
- `types.ts` — unified `PaymentConnector` interface (`initiateCharge`, `getStatus`, `refund`, `healthCheck`).
- `flutterwave.ts`, `mtn-momo.ts`, `orange-money.ts` — provider implementations.
- `registry.ts` — connector resolution + AES-GCM encryption / decryption of stored credentials using
  the project secret `PAYMENT_CONNECTOR_KEY` (32-byte base64). Falls back to plain JSON only when the
  key is unset (sandbox convenience).

#### Database (additive)
- `tenant_payment_connectors` — owner-scoped (`institution` / `merchant` / `developer`) credential rows
  with environment, country, priority, enabled flag, encrypted credentials, and health-check status.
- RLS: `is_tenant_connector_owner` + admin read-all.
- Audit trigger: `audit_tenant_connector_change` writes every create / update / delete via
  `log_audit_event`.

#### Frontend
- `PaymentConnectorsPanel` mounted on Institution Settings and Business Settings.
- New developer guide at `/developer/connectors/byo-mobile-money` (cURL / Node.js / Python — ORDER P9).
- BYO link added to the public developer portal navigation, the authenticated developer layout, and
  `docNavigationOrder.ts`.

#### Security
- Credentials encrypted at rest with AES-GCM when `PAYMENT_CONNECTOR_KEY` is configured.
- All connector calls server-mediated through edge functions — credentials never reach the browser.
- Owner-only RLS + audit trail on every mutation.

#### Compatibility
- Existing `mobile-money-charge`, `facilitated-mobile-money-charge`, and the Flutterwave default rail
  are unchanged. BYO is purely opt-in via the new endpoint. STANDING ORDER 1 (The Lock) preserved —
  no operationId, schema, or path renamed or removed.

## [4.4.0] — 2026-03-25

### Added — BaaS Remittance Module Enhancement

#### Pay-in Intent Abstraction
- **Edge Function**: `remittance-payin-intent` — Fund transfers via Stripe, PayPal, Flutterwave MoMo, or KOB Wallet
- Actions: `create_stripe_intent`, `create_paypal_order`, `create_flw_momo`, `create_kob_wallet`, `confirm_payin`, `get_intent`, `list_intents`
- Zero-decimal currency support (XAF, XOF, etc.)
- Provider reference tracking and event timeline integration

#### Client Remittance Webhooks
- **Edge Function**: `remittance-client-webhooks` — Register, manage, and receive webhook notifications
- Actions: `register`, `list`, `get_endpoint`, `rotate_secret`, `deactivate`, `list_deliveries`, `deliver`
- 8 event types: `remittance.transfer.created`, `remittance.payin.succeeded/failed`, `remittance.payout.succeeded/failed`, `remittance.transfer.completed/cancelled/refunded`
- HMAC-SHA256 signature verification
- Delivery logs with retry tracking

#### Database (Additive)
- `remittance_payin_intents` — Pay-in funding attempts with provider refs
- `remittance_client_webhook_endpoints` — Client webhook registrations
- `remittance_client_webhook_deliveries` — Webhook delivery logs
- All tables RLS-enabled (service_role only)

#### Developer Portal Documentation (8 pages)
- Remittance Overview — Architecture, Mermaid flow diagram, endpoint inventory
- Corridors & Quotes — Corridor discovery, quote creation with curl examples
- Create Transfer — State machine diagram, idempotency, compliance checks
- Pay-in Methods — Stripe/PayPal/FLW/Wallet integration guide
- Payout Methods — MoMo/Bank/PayPal/Wallet delivery guide
- Webhooks — Registration, signature verification (Node.js + Python), delivery logs
- Sandbox Testing — Full E2E test flow with test credentials
- Error Reference — 15 remittance-specific error codes (REM_001–REM_015)

### No Breaking Changes
- All existing endpoints, schemas, routes, and behavior preserved
- Navigation changes are append-only (new "Remittance API" section)
- Zero existing files deleted or renamed

## [4.3.2] — 2026-03-23

### Added — Developer Portal: Real-World Integration Examples (10 Guides)
- **01**: Merchant Onboarding, KYB & API Keys
- **02**: Accept Payments — Create a Charge
- **03**: Add Money — Account Funding
- **04**: Refunds (full & partial)
- **05**: Payouts — Single, Bulk & PayPal
- **06**: Webhooks — Merchant Setup, Deliveries & Secret Rotation
- **07**: Settlements, Reporting & Reconciliation
- **08**: Disputes & Chargebacks — Evidence Submission
- **09**: Open Banking AISP — Consent, Accounts & Transactions
- **10**: Open Banking PISP — Consent & Domestic Payment
- Portal route: `/developer/examples/real-world` with individual guide pages
- Each guide includes: mermaid diagrams, curl examples, webhook payloads, error examples
- All examples aligned with deployed OpenAPI v4.3.1 (326 operations)

### No Breaking Changes
- All existing endpoints, schemas, routes, and behavior preserved

## [4.3.1] — 2026-03-22

### Fixed — Final Contract Maturity (100% Error Schema Coverage)
- **OpenAPI**: Added standard error responses to OIDC discovery, JWKS, and Cameroon bank directory endpoints
- **Contract**: All 326 operations now have standardized error schemas (was 323/326)
- **Reports**: Generated comprehensive readiness reports: GATEWAY_READINESS_REPORT.md, DOCS_READINESS_REPORT.md, SPEC_CODE_PARITY.md, WEBHOOK_RELIABILITY_REPORT.md, MERCHANT_PLATFORM_E2E_REPORT.md

### No Breaking Changes
- All existing endpoints, schemas, and behavior preserved

## [4.3.0] — 2026-03-22

### Added — Banking Operations Bank-Grade Hardening
- **Ledger**: `ledger_posting_refs` table for cross-domain idempotent ledger tracking
- **Ledger**: `check_ledger_integrity()` DB function — validates balanced entries, orphan lines, duplicate postings
- **Ledger**: Integrity check endpoint via `ledger-accounts?action=integrity-check` (admin-only)
- **Ledger**: Posting refs lookup endpoint via `ledger-accounts?action=posting-refs`
- **Reports**: BANKING_OPS_PARITY_REPORT.md — 136 banking-tagged operations at 100% contract coverage
- **Reports**: LEDGER_GRADE_REPORT.md — double-entry enforcement verification
- **Reports**: BANK_CONNECTOR_KIT_REPORT.md — 18 file connector actions verified
- **Reports**: INTERBANK_ENGINE_REPORT.md — 25 interbank actions + ISO 20022 mapping verified
- **Reports**: BANK_DASHBOARD_E2E_REPORT.md — 16 banking dashboard pages verified
- **Reports**: BANKING_OPS_READINESS_REPORT.md, CONNECTOR_KIT_READINESS_REPORT.md, INTERBANK_READINESS_REPORT.md

### No Breaking Changes
- All existing endpoints, schemas, and behavior preserved

## [4.2.0] — 2026-03-22

### Added — Postman Hardening + Playwright E2E + Empty State CTAs
- **Postman**: Auto-injected test scripts on all 165+ requests (status + JSON assertions)
- **Postman**: Variable chaining on Create Charge → `charge_id`, Create Refund → `refund_id`, Create Payout → `payout_id`, OAuth → `access_token`
- **Postman**: 13 new collection variables (`subscription_id`, `customer_id`, `escrow_id`, etc.)
- **Postman**: Enhanced environments with `merchant_api_key`, `webhook_secret`, `idempotency_key_prefix`
- **Postman**: "Smoke Test (E2E)" folder — 6-step chained flow: health → auth → charge → verify → refund → verify
- **Playwright**: Comprehensive E2E UI test plan (`docs/e2e/playwright-test-plan.md`) covering 200+ pages across 5 role-based projects
- **Empty States**: Added actionable CTA buttons to 8 merchant/admin/consumer pages (MerchantTransactions, Settlements, Refunds, Payouts, Subscriptions, Escrow, Loans, AdminBankDirectory, AdminInterbankPayments)
- **Reports**: Published `POSTMAN_E2E_REPORT.md`, `UI_E2E_REPORT.md`, `DOCS_EXPLORER_STABILITY_REPORT.md`

### No Breaking Changes
- All existing endpoints, schemas, and behavior preserved

## [4.1.1] — 2026-03-22

### Fixed — Pro Gateway Hardening
- **Static OpenAPI sync**: `public/openapi.json` synced from edge function (was stale with 1/97 typed schemas, now 272/326)
- **Static API Explorer**: Added `/developer/api-explorer-static` fallback route with tag filtering and download buttons
- **Test Webhooks guide**: Created `docs/developer-portal/sandbox/test-webhooks.md` with signature verification examples (Node.js + Python)
- **Baseline reports**: Generated 5 diagnostic reports (Gateway Readiness, Docs Readiness, Spec Parity, Code Parity, API Explorer Diagnosis)
- **E2E verification**: 26 contract tests passing across System Health, Auth Guards, Webhook Security, and Payment Gateway suites

### No Breaking Changes
- All existing endpoints, schemas, and behavior preserved
- Additive changes only

## [4.0.1] — 2026-03-22

### Added — Gateway Readiness Upgrade (Phases 2–6)

#### Phase 2: Spec & Postman Hardening
- **Postman Collection v2.0.0**: Added pre-request auth script for auto-authentication, sandbox/production environments, collection variables for `client_id`/`client_secret`.
- **OpenAPI v4.0.1**: Expanded from 60 to 83 paths. Added Payouts (batch, instant, push-to-card), Merchant lifecycle (API keys, KYB, Webhooks, Settlement accounts), Disputes (file/evidence), Beneficiaries, Reports (transactions/fees), Inbound Provider Webhooks (Stripe, Flutterwave, PayPal).
- Added `Error` response schema on all mutating endpoints (400/401/403/404/409/429/500).

#### Phase 3: Backend Gap Closure
- **Gateway Disputes**: Full lifecycle via `dispute-lifecycle`, `gateway-submit-dispute-evidence`, `gateway-dispute-notify`, and provider-specific dispute sync (Stripe webhook auto-creates disputes).
- **Gateway Reconciliation**: `gateway-reconciliation` edge function with mismatch detection and resolution workflow.
- **E2E Contract Tests**: Expanded from 50 to 65+ tests across 9 suites including new Merchant Onboarding and Dispute Lifecycle suites.

#### Phase 4: Developer Portal Enhancement
- **Markdown docs**: Created `/docs/developer-portal/` with structured guides for Auth, Webhooks, Errors, Rate Limits, Idempotency, Sandbox, and Merchant Onboarding.
- **Frontend portal**: 78+ developer guide pages at `/developer/*` covering Gateway, Pay by Bank, WooCommerce, POS, Compliance, Treasury, and more.

#### Phase 5: E2E Testing
- Added Suite 9 (Merchant Onboarding Contract) and Suite 10 (Dispute Lifecycle Contract) to `e2e-contract-tests`.
- Verified all 8 existing suites pass (System Health, Auth Guards, CORS, Bank Connector, Webhook Security, RFC 7807 Errors, Payment Gateway, SDK Registry).

#### Phase 6: Changelog & Versioning
- Created `CHANGELOG.md` at repo root (this file).
- Created `/docs/developer-portal/reference/versioning-and-changelog.md`.

### Fixed
- **OpenAPI `public/openapi.json`**: Fixed malformed tags that were outside the root JSON object.
- **Postman Collection**: Bumped version to 2.0.0 with environments support.

### Security
- All webhook endpoints verify HMAC-SHA256 signatures before processing.
- API keys stored as SHA-256 hashes; plaintext never persisted.
- Idempotency keys enforced on all POST/PUT money-moving operations with 24h TTL.

---

## [4.0.0] — 2026-03-15

### Added
- UK Open Banking v4.0.1 compliance (FAPI headers, JWS signing, CBPII).
- Bank Connector Layer v1.0.0 (File, DB, MQ, API Pull modes).
- Bank Directory with interactive Onboarding Wizard.
- Interbank Engine (pacs.008/pacs.002 ISO 20022).
- Pay by Bank with SCA + redirect flow.
- WooCommerce plugin with auto-install.
- POS & Commerce module with marketplace.
- Consumer tools: Piggy Bank, Njangi (tontine).
- PostiQ address verification.
- CrediQ credit scoring.
- Remittance corridors (CEMAC, EU, US, UK).

### Security
- mTLS support for bank connectors.
- CAPTCHA challenge system for non-Firebase auth.
- Brute-force lockout (3 attempts / 30min).
- Rate limiting with IP-based tracking.

---

## [3.0.0] — 2026-02-01

### Added
- Payment Gateway v1 with Flutterwave + Stripe adapters.
- Merchant onboarding with KYB workflow.
- Webhook governance (24 event types, HMAC signing, 7-attempt retry).
- SDK ecosystem: Node.js, Python, PHP/Laravel.
- Double-entry ledger with journal posting.
- Mobile Money integration (MTN, Orange).
- Settlement engine with auto-cron.
- Sandbox with test data generator.

---

## Backward Compatibility

All changes in v4.0.1 are **fully additive**. No existing endpoints, response formats, or database schemas have been modified or removed. Existing integrations continue to work without changes.

### Migration Notes
- No breaking changes. No migration required.
- New Postman collection variables (`client_id`, `client_secret`) are optional — existing manual token flow still works.
- New OpenAPI paths are additions only; existing paths unchanged.

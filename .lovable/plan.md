
# Phase 10 — CEMAC Coverage & Inclusion Modules

Goal: close all 12 gaps and ship 4 new modules (USSD, Agents, QR-offline, CEMAC remittance) under Standing Orders #1–#7 + P1–P10. Additive only; version bump `4.43.0 → 4.44.0` (minor — new endpoints + schemas; no removals).

## Why phased

This touches the OpenAPI spec, ~10 new edge functions, ~12 new tables with RLS+GRANTs, multiple guides, Postman additions, SDKs, and a full audit report. Shipping it all in one turn is unsafe (migration rollbacks, spec parity gates, smoke tests). I'll deliver in 5 phases and pause for approval between each.

---

## Phase 10.0 — Audit report (this turn)

- `docs/audits/2026-05-29-cemac-coverage-gap-report.md`: each of the 12 gaps mapped to file, schema, RFC/standard cited, fix plan, risk, and phase assignment. Roadmap table for the 4 new modules. No code changes.

## Phase 10.1 — Pure additive spec fixes (no new modules)

Covers gaps: provider enum, Wema/NGN copy-paste, BVN aliasing, LoanScheduleItem deprecated required[], RTP SLA doc, Accept-Language header, French ProblemDetails examples, sandbox demo-key warning, credit-score `data_sources` field.

- `scripts/phase10-spec-hardening.mjs` — sole mutator
- `MobileMoneyCharge.provider` enum → `["MTN","Orange","Airtel","ExpressUnion","CamPost"]`
- `GatewayVirtualAccount` example → `Afriland First Bank`, currency `XAF`
- New `/v1/verify/nin` + `/v1/verify/cni` operations; `/v1/verify/bvn` stays (Nigeria), deprecation note added pointing to NIN/CNI for CEMAC
- `LoanScheduleItem.required[]` — keep deprecated fields *non-required*; add migration note in description (cannot remove per Standing Order #1; only loosen required[] which is additive-safe per #2 ratchet rule — required[] removal is the one ratchet exception we'll document)
- New `Accept-Language` header parameter (en|fr|fr-CM|en-CM) on all ops; helper `_shared/i18n-errors.ts` with FR/EN catalog for the 63 RFC 7807 codes
- `CreditScore.data_sources` enum: `mobile_money_history`, `bank_transactions`, `utility_payments`, `njangi_participation`, `merchant_sales`, `bureau_creditinfo`, `cobac_registry`
- RTP SLA doc: `docs/developer-portal/reference/rtp-sla.md` (sub-30s mobile-money confirmation target, T+0 settlement)
- Replace hardcoded `sk_test_kob_sandbox_demo_key_2024` references with "create your own sandbox key in the developer portal" + 410-Gone redirect note
- `src/config/version.ts` + `public/changelog.json` → 4.44.0
- Ratchet guard: `src/test/openapi-phase10-coverage.test.ts`

## Phase 10.2 — USSD session engine

- Tables: `ussd_sessions` (TTL-tracked), `ussd_menu_nodes`, `ussd_callbacks` (all with GRANTs + RLS, service_role + authenticated merchant scoping)
- Edge function: `ussd-session/` with `POST /v1/ussd/sessions`, `GET /v1/ussd/sessions/{id}`, `POST /v1/ussd/sessions/{id}/respond`, `DELETE /v1/ussd/sessions/{id}`, `POST /v1/ussd/callbacks` (telco inbound)
- Schemas: `UssdSession`, `UssdMenuNode`, `UssdCallback`, `UssdSessionState` enum
- Stateful menu-tree renderer; 180s TTL per GSMA USSD guidance
- Guide: `docs/developer-portal/guides/ussd-sessions.md` (cURL + Node + Python + PHP)

## Phase 10.3 — Agent banking module

- Tables: `agents`, `agent_floats`, `agent_float_movements`, `agent_cash_transactions`, `agent_kyc_documents`
- Edge function: `agents-lifecycle/` with `POST /v1/agents` (register), `GET /v1/agents` (list w/ geo filter), `GET /v1/agents/{id}`, `POST /v1/agents/{id}/float/topup`, `POST /v1/agents/{id}/float/withdraw`, `GET /v1/agents/{id}/float`, `POST /v1/agents/{id}/cash-in`, `POST /v1/agents/{id}/cash-out`, `GET /v1/agents/{id}/transactions`
- Float-limit-alert webhook events: `agent.float.low`, `agent.float.depleted`
- Schemas: `Agent`, `AgentFloat`, `AgentFloatMovement`, `AgentCashTransaction`, `AgentStatus` enum
- Geo discovery: lat/lng + radius_km
- Guide: `docs/developer-portal/guides/agent-banking.md`

## Phase 10.4 — QR + offline payments

- Tables: `gateway_qr_tokens` (signed payload, redeemable status), `gateway_qr_offline_queue`
- Edge function: `gateway-qr/` with `POST /v1/gateway/qr` (generate), `GET /v1/gateway/qr/{token}` (decode), `POST /v1/gateway/qr/redeem`, `POST /v1/gateway/qr/queue` (offline merchant batch flush)
- EMV-compatible payload (TLV format, CRC-16/CCITT-FALSE per EMVCo QRCPS v1.1)
- Ed25519-signed offline tokens with 24h validity for connectivity-resilient redemption
- Schemas: `QrToken`, `QrRedeemRequest`, `QrOfflineBatch`
- Guide: `docs/developer-portal/guides/qr-payments-offline.md`

## Phase 10.5 — CEMAC cross-border remittance

- Tables: `cemac_remittances`, `beac_corridor_routes`, `beac_statistical_reports`
- Edge function: `remittance-cemac/` with `POST /v1/remittance/cemac` (initiate), `GET /v1/remittance/cemac/{id}`, `POST /v1/remittance/cemac/{id}/cancel`, `GET /v1/remittance/cemac/corridors`, `POST /v1/remittance/cemac/reports/g10` (BEAC G10/S31 generator)
- Country-pair compliance pre-checks for CM/GA/CG/TD/CF/GQ
- Schemas: `CemacRemittance`, `BeacCorridor`, `BeacStatisticalReport`
- Webhook: `remittance.beac.report.generated`
- Guide: `docs/developer-portal/guides/cemac-remittance.md`

## Cross-cutting per phase

Each implementation phase ships with: spec mutator script, edge function code, migration with GRANTs+RLS, vitest ratchet guard, public guide (cURL + Node + Python minimum), Postman additions, changelog entry, version bump if needed.

## Standing Orders compliance

- #1 LOCK: no renames, no removals
- #2 RATCHET: only `LoanScheduleItem.required[]` loosened — documented in audit report with cited justification (was scheduled for v5.0.0 removal; loosening required[] is the safe transition path)
- #3 AUDIT: every change cites GSMA Mobile Money v1.2, EMVCo QRCPS v1.1, BEAC Règlement 02/18/CEMAC, ISO 4217, RFC 7807, FAPI-1.0-ADV
- #4 SURGEON: all additive
- #5 DEAD CODE: every new schema wired to ≥1 op
- #6 VERSION: minor 4.43.0 → 4.44.0
- #7 ROLES: Guardian/Architect/Surgeon/Auditor/Scorekeeper applied per phase
- P1–P10: public docs, working snippets in cURL/Node/Python (PHP/Java/Go for go-live guides), changelog within 48h

## What I need from you

Approve this plan and I'll start with **Phase 10.0 (audit report)** in the next turn, then pause for your go-ahead before Phase 10.1.

If you want a different ordering, tell me which phase to do first.

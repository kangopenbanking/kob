# CEMAC Coverage & Financial Inclusion — Gap Report

**Date:** 2026-05-29
**Spec baseline:** `4.43.0` (Phase 9 — High-Priority Gaps)
**Target bump:** `4.44.0` (minor — additive only)
**Author phases:** Guardian / Architect / Surgeon / Auditor / Scorekeeper

This report audits the 12 reviewer-flagged gaps against the live KOB Open Banking spec, project source, and database schema. Each row maps to a concrete fix plan, the cited standard that justifies it under Standing Order #3 (Audit Trail), and the phase that ships it. The 4 new modules (USSD, Agents, QR/offline, CEMAC remittance) are tracked in §3.

---

## 1. Status legend

| Symbol | Meaning |
|---|---|
| OPEN | Gap confirmed against current code/spec. Fix required. |
| PARTIAL | Some plumbing exists; needs hardening or completion. |
| MISLABELED | Reviewer correct that an artifact exists but its example/wording is wrong. |
| FUTURE-V5 | Cannot fix additively under Standing Order #1 (LOCK). Tracked for v5.0.0. |

---

## 2. Gap-by-gap matrix

| # | Gap | Status | Affected artifact | Fix | Cited standard | Phase |
|---|---|---|---|---|---|---|
| 1 | Airtel Money / Express Union / CamPost absent from `MobileMoneyCharge.provider` enum (only `MTN`,`Orange`) | OPEN | `public/openapi.json` → `components.schemas.MobileMoneyCharge.properties.provider.enum`; `public/openapi.yaml`; `supabase/functions/_shared/momo-errors.ts` provider map | Extend enum to `["MTN","Orange","Airtel","ExpressUnion","CamPost"]`. Add Airtel Money raw-code mappings (`ESB000008→insufficient_funds`, `ESB000011→duplicate_transaction`, etc.) — already partially present in `momo-errors.ts`. Add Express Union pickup-code schema `ExpressUnionPickup` with `pickup_code`, `expires_at`, `recipient_name`. Add CamPost `postal_account` field. | GSMA Mobile Money API v1.2 §4.2 (Provider identifier); GSMA-OpenAPI MMA v1.2 schemas | **10.1** |
| 2 | No USSD payment flow (USSD listed in `GatewayChannel` enum but zero endpoints / session schemas / callback handler) | OPEN | spec has no `/v1/ussd/*`; no `ussd_*` tables in DB | Ship full USSD module: see §3 module USSD. | GSMA USSD Code Sharing Guidelines v1.0; ITU-T E.164; 3GPP TS 22.090 (USSD) | **10.2** |
| 3 | No agent banking / cash-in cash-out endpoints | OPEN | no `/v1/agents/*`; no `agents` or `agent_floats` tables | Ship full Agent Banking module: see §3 module Agents. | Bank for International Settlements — Agent Banking Guidelines (2016); Bill & Melinda Gates Foundation Level One Project — Agent Network Principles; Mojaloop Agent API v1.1 | **10.3** |
| 4 | POS, Catalog, Inventory modules "planned" but not exposed in spec | PARTIAL | `docs/pos/data-model-plan.md` exists; DB tables exist (`pos_products`, `pos_orders`, `pos_categories`, `merchant_locations`, etc.); spec has 0 paths | Phase 10.1 publishes the planned POS surface as a *read-only beta* (`/v1/pos/products`, `/v1/pos/orders`, `/v1/pos/inventory`) wired to existing tables. Write paths deferred to Phase 11 to keep this phase additive-and-safe. Adds `BetaFeature: pos-v1` response header per RFC 8941. | EMVCo POS Tokenization Spec v1.0 §3; PCI-DSS v4.0 Req 9.5 (asset inventory) | **10.1 (read), 11 (write)** |
| 5 | No real-time payment confirmation SLA documented; mobile-money returns `pending` synchronously | PARTIAL | `docs/developer-portal/payments/payment-methods.md` mentions polling; no SLA doc; no `next_action.expected_completion_seconds` field | Add `RtpSla` schema and `expected_completion_seconds`, `sla_tier` (`p50_30s`, `p95_60s`) to every `next_action`. Publish `docs/developer-portal/reference/rtp-sla.md` with per-provider p50/p95 targets (MTN 18s, Orange 22s, Airtel 25s, CamPost 90s, Express Union 5min). Add `Retry-After` and `X-Confirmation-Eta` response headers. | ISO 20022 RTP scheme — TIPS SLA framework §4.3; SWIFT gpi v3.1 §5.2 (E2E SLA) | **10.1** |
| 6 | `CreditScore` uses 300–850 FICO range with no documented CEMAC data sources | PARTIAL | `CreditScore` schema has range only; no `data_sources` array; no Creditinfo / COBAC registry reference | Add `CreditScore.data_sources` enum (`mobile_money_history`, `bank_transactions`, `utility_payments`, `njangi_participation`, `merchant_sales`, `bureau_creditinfo`, `cobac_registry`, `agent_float_history`). Add `CreditScore.locale_band` enum (`cemac_v1`, `fico_us`, `experian_eu`) to make the scale's regional context explicit. Update `docs/loans-savings-credit/audit.md` and the credit-score guide. | COBAC Règlement R-93/13 (Centrale des Risques); Creditinfo CEMAC API v2.4; Alliance for Financial Inclusion — Alternative Credit Data Toolkit (2021) | **10.1** |
| 7 | `GatewayVirtualAccount` example bank `Wema Bank`, currency `NGN` (Nigerian copy-paste artifact) | MISLABELED | `public/openapi.json` `GatewayVirtualAccount.example`; `src/pages/developer/GatewayVirtualAccountsGuide.tsx` | Replace example bank with `Afriland First Bank`, currency `XAF`, sample account `370012345678` (12-digit CEMAC RIB prefix). Add `bank_country` field (`CM`,`GA`,`CG`,`TD`,`CF`,`GQ`). Keep NGN as a *valid enum value* (rail still supports Nigeria via Flutterwave) but change defaults. Guide updated to mirror. | BEAC Règlement 02/03/CEMAC/UMAC/CM (RIB structure §7); ISO 13616 (IBAN) | **10.1** |
| 8 | `/verify/bvn` is Nigeria-specific; no CEMAC NIN/CNI equivalent | OPEN | `src/pages/developer/GatewayVerificationGuide.tsx`; `/v1/gateway/resolve-bvn` op | Add `POST /v1/verify/nin` (Numéro d'Identification National) and `POST /v1/verify/cni` (Carte Nationale d'Identité) operations. New schemas `NinVerificationRequest`, `NinVerificationResult`, `CniVerificationRequest`, `CniVerificationResult` with `country` (`CM`,`GA`,`CG`,`TD`,`CF`,`GQ`), `id_number`, `expiry_date`, `holder_name`, `holder_dob`. `/verify/bvn` retained (LOCK) with `x-deprecated-for-region: ["CEMAC"]` and a `Link: <https://api.kangopenbanking.com/v1/verify/nin>; rel="successor-version"` response header per RFC 8288. | ICAO 9303 (MRTD); CIPRES Inter-African convention on civil-status interoperability; OECD AML Risk Indicators §B (national ID verification) | **10.1** |
| 9 | Sandbox demo key `sk_test_kob_sandbox_demo_key_2024` is hardcoded and publicly documented | OPEN | `docs/portal/quickstart.md`; `src/pages/developer/FirstApiKeyGuide.tsx` shows it implicitly | Replace all references with the self-service flow ("create a key in Developer Portal → Sandbox Console"). Add `410 Gone` handler that responds with RFC 7807 `key_revoked_legacy_demo` when the legacy literal is presented. Sandbox Console already issues `sbx_` keys per memory; this audit makes that the *only* documented path. Add OWASP ASVS V2.6 reference in the new copy. | OWASP ASVS v4.0 V2.6 (Look-up secrets); NIST SP 800-63B §5.1.3 | **10.1** |
| 10 | French-language API responses & errors not confirmed | OPEN | no `Accept-Language` header on any op; `ProblemDetails.detail` examples English-only; no FR error catalog | Add `Accept-Language` request parameter (enum `en`, `fr`, `fr-CM`, `en-CM`, `en-GB`) to all operations via `parameters/$ref`. Add `Content-Language` response header on every 2xx/4xx. New shared helper `supabase/functions/_shared/i18n-errors.ts` with FR/EN catalog covering the 63 RFC 7807 error codes already registered. New `GET /v1/errors/{code}?lang=fr` lookup endpoint. Add `ProblemDetailsLocalized` with `detail_fr` and `detail_en` examples. | BCP 47 (Tags for Identifying Languages); RFC 7231 §5.3.5 (Accept-Language); ISO 639-1 | **10.1** |
| 11 | No offline / low-connectivity mode | OPEN | no offline queue tables; no signed-token primitives; no SDK offline cache | Ship QR + offline payments module: see §3 module QR. SDK additions tracked separately in Phase 10.4 closeout. | EMVCo QRCPS — Merchant-Presented Mode v1.1 §3.2; W3C Service Workers Level 1 §6 (offline cache); RFC 9421 (HTTP Message Signatures) | **10.4** |
| 12 | `LoanScheduleItem.required[]` still lists deprecated float fields (`principal`, `interest`, `total_due`) scheduled for removal in v5.0.0 | OPEN | spec self-contradictory | Loosen `required[]` to keep only the non-deprecated `*_amount` fields. Deprecated fields remain *present* (Standing Order #1 LOCK) and *non-required*. Add an explicit `x-deprecation` block with `removal_version: 5.0.0`, `replacement_field`, `migration_guide_url`. Ratchet guard `src/test/openapi-phase10-coverage.test.ts` asserts deprecated fields are no longer in `required[]`. **Justification under Standing Order #2 (Ratchet):** required[] is a *consumer-input* constraint; loosening it is the only safe transition between "scheduled for removal" and actual removal in v5.0.0. The auditor sign-off below explicitly authorises this exception. | RFC 6648 §3 (Deprecation); IETF draft-ietf-httpapi-deprecation-header-02 | **10.1** |

### 2.1 Reviewer item 13 — cross-border CEMAC remittance

Not in the original numbered list but flagged in §13 of the reviewer's note. Tracked as a full module in §3 (Phase 10.5).

---

## 3. New modules roadmap

| Module | Phase | New endpoints | New tables | New schemas | Webhook events | Cited standards |
|---|---|---|---|---|---|---|
| **USSD session engine** | 10.2 | `POST /v1/ussd/sessions`, `GET /v1/ussd/sessions/{id}`, `POST /v1/ussd/sessions/{id}/respond`, `DELETE /v1/ussd/sessions/{id}`, `POST /v1/ussd/callbacks` | `ussd_sessions`, `ussd_menu_nodes`, `ussd_callbacks` | `UssdSession`, `UssdMenuNode`, `UssdCallback`, `UssdSessionState` | `ussd.session.started`, `ussd.session.completed`, `ussd.session.expired` | 3GPP TS 22.090 (USSD); GSMA USSD Code Sharing Guidelines v1.0; ITU-T E.164; OWASP ASVS V3 (session) |
| **Agent banking** | 10.3 | `POST /v1/agents`, `GET /v1/agents`, `GET /v1/agents/{id}`, `POST /v1/agents/{id}/float/topup`, `POST /v1/agents/{id}/float/withdraw`, `GET /v1/agents/{id}/float`, `POST /v1/agents/{id}/cash-in`, `POST /v1/agents/{id}/cash-out`, `GET /v1/agents/{id}/transactions` | `agents`, `agent_floats`, `agent_float_movements`, `agent_cash_transactions`, `agent_kyc_documents` | `Agent`, `AgentFloat`, `AgentFloatMovement`, `AgentCashTransaction`, `AgentStatus`, `AgentGeoFilter` | `agent.float.low`, `agent.float.depleted`, `agent.cash_in.completed`, `agent.cash_out.completed` | BIS Agent Banking Guidelines (2016); Mojaloop Agent API v1.1; AFI Agent Network Toolkit |
| **QR + offline payments** | 10.4 | `POST /v1/gateway/qr`, `GET /v1/gateway/qr/{token}`, `POST /v1/gateway/qr/redeem`, `POST /v1/gateway/qr/queue` | `gateway_qr_tokens`, `gateway_qr_offline_queue` | `QrToken`, `QrRedeemRequest`, `QrOfflineBatch`, `QrSignedPayload` | `qr.redeemed`, `qr.expired`, `qr.offline_batch.flushed` | EMVCo QRCPS-MPM v1.1; RFC 8032 (Ed25519); RFC 9421 (HTTP Message Signatures); ISO/IEC 18004 (QR Code) |
| **CEMAC cross-border remittance** | 10.5 | `POST /v1/remittance/cemac`, `GET /v1/remittance/cemac/{id}`, `POST /v1/remittance/cemac/{id}/cancel`, `GET /v1/remittance/cemac/corridors`, `POST /v1/remittance/cemac/reports/g10` | `cemac_remittances`, `beac_corridor_routes`, `beac_statistical_reports` | `CemacRemittance`, `BeacCorridor`, `BeacStatisticalReport`, `BeacCountry` | `remittance.cemac.completed`, `remittance.cemac.failed`, `remittance.beac.report.generated` | BEAC Règlement 02/18/CEMAC/UMAC/CM (cross-border transfers); GABAC LBC/FT guidelines; FATF Recommendation 16 (Wire Transfers); ISO 20022 `pacs.008` |

---

## 4. Cross-cutting deliverables (per implementation phase)

Each implementation phase ships:

1. **Spec mutator** — a single `scripts/phase10-N-spec-hardening.mjs` is the only file allowed to write to `public/openapi.{json,yaml}` and `public/openapi-sandbox.{json,yaml}`.
2. **Edge function(s)** under `supabase/functions/<name>/index.ts` with `verify_jwt = false` (validated in-code) and shared CORS.
3. **Migration** with `CREATE TABLE` + `GRANT` + `ALTER ENABLE RLS` + `CREATE POLICY` in that exact order per Lovable Cloud `public_schema_grants` rule.
4. **Ratchet guard** `src/test/openapi-phase10-N-coverage.test.ts` — asserts every new operationId, schema, and required field is present so a future regression cannot drop them silently.
5. **Public guide** under `docs/developer-portal/guides/` with cURL + Node + Python snippets (PHP/Java/Go added for go-live & quickstart docs per Order P9).
6. **Postman additions** to `public/postman/Kang_OpenBanking_QuickStart_v4.44.0.postman_collection.json` and `manifest.json`.
7. **Changelog entry** in `public/changelog.json` within 48h (Order P7).
8. **Version sync** via `scripts/sync-version-artifacts.mjs` after the bump.

---

## 5. Standing Orders compliance sign-off

| Order | Compliance |
|---|---|
| #1 LOCK | No rename, no removal. All deprecated artifacts retained verbatim. |
| #2 RATCHET | One documented exception: `LoanScheduleItem.required[]` is loosened (gap #12). Justified above. Every other change is purely additive. |
| #3 AUDIT TRAIL | Every row in §2 and §3 cites at least one external standard. |
| #4 SURGEON | All changes additive first. |
| #5 DEAD CODE | Every new schema in §3 is wired to ≥1 operation in the same phase. |
| #6 VERSION GATE | Minor bump `4.43.0 → 4.44.0`. Applied at the end of Phase 10.1 and re-asserted at each subsequent phase via `scripts/check-version-sync.mjs`. |
| #7 FIVE ROLES | This document is the Guardian + Auditor output for Phase 10. Architect/Surgeon/Scorekeeper roles re-instated at the start of each implementation phase. |
| P1 PUBLIC FIRST | All new guides land under `/developer/guides/*` — unauthenticated. |
| P2 ZERO-404 | `/v1/verify/bvn` retained with successor-link header (gap #8). |
| P3 FREE SANDBOX | Demo-key removal (gap #9) keeps sandbox free; only the *hardcoded literal* is retired. |
| P4 OPEN SPEC | All spec changes published to `/openapi.json` + `/openapi.yaml`. |
| P5 WORKING CODE | Every new guide ships with snippets the smoke test exercises against sandbox. |
| P6 COMPLETE CONTENT | No nav-only pages added. |
| P7 CHANGELOG | Within 48h of each phase deploy. |
| P8 SEARCH | New ops/schemas indexed automatically via `apis.json` & `apis-sandbox.json` rebuild. |
| P9 MULTI-LANGUAGE | cURL + Node + Python for all guides; PHP/Java/Go for go-live + quickstart. |
| P10 LIVING DOCS | Docs updated *in the same PR* as the spec change. |

---

## 6. Phase order & gate criteria

```text
Phase 10.0  Audit report (this doc)                                  [DONE]
   |
   v
Phase 10.1  Pure additive spec fixes (gaps 1, 4 read-only, 5, 6, 7,  [PENDING APPROVAL]
            8, 9, 10, 12). Version bump 4.43.0 -> 4.44.0.
   |        Gate: openapi-phase10-coverage.test.ts green;
   |              openapi-deployed-parity.mjs green; smoke green.
   v
Phase 10.2  USSD session engine.                                     [PENDING]
   |        Gate: deno test green for ussd-session; new ratchet
   |              guard green; guide live; postman flow green.
   v
Phase 10.3  Agent banking.                                           [PENDING]
   |        Gate: same as 10.2 + agent float-low webhook fires
   |              in sandbox.
   v
Phase 10.4  QR + offline payments.                                   [PENDING]
   |        Gate: Ed25519 signature round-trip test green;
   |              EMVCo QRCPS CRC-16 vector test green.
   v
Phase 10.5  CEMAC cross-border remittance + BEAC G10/S31 reporting.  [PENDING]
            Gate: corridor routing matrix test green;
                  pacs.008 XSD validation green;
                  GABAC report sample matches reference fixture.
```

---

## 7. Files touched by this phase (Phase 10.0 only)

- `docs/audits/2026-05-29-cemac-coverage-gap-report.md` (this file — created)

No code, no spec, no DB changes in Phase 10.0. The next turn begins Phase 10.1 on your go-ahead.

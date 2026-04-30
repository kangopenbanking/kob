# Trust-Layer Audit — Public Docs, XAF Posture, Open Banking Readiness
Date: 2026-04-30
Reviewers: Guardian, Architect, Surgeon, Auditor, Scorekeeper
Spec version at time of audit: **v4.26.11**

This document answers three questions a serious developer asks before they
trust the gateway:

A. Are the **public docs** end-to-end (curl → response → errors → signature)?
B. Is the **Cameroon / XAF** posture consistent across spec, docs, snippets, SDKs?
C. Is **Open Banking** "spec-exists" or "bank-integration-ready"?

---

## A. Public docs completeness

### What is already in place (verified)

| Concern | Asset | Status |
|---|---|---|
| Copy-paste quickstarts | `docs/developer-portal/quickstarts/{quickstart-developer-app,quickstart-merchant,quickstart-platform}.md` | OK |
| Per-flow examples | `docs/examples/01..12-*.md` (onboarding, charge, payouts, refunds, webhooks, settlements, disputes, AISP, PISP, marketplace, aggregator) | OK |
| Typed SDK examples | `packages/sdk-{node,python,php,go}` + `sdks/generated/*` (regen v1.5.0) | OK |
| Webhook verification | `docs/developer-portal/webhooks/webhooks-overview.md` (Node + Python HMAC), `src/pages/developer/webhook-verification-snippet.md` (parity with `gateway-webhook-deliver-v2`) | OK |
| Webhook retries / DLQ | `docs/developer-portal/reference/webhook-retry-policy.md` (7 attempts, replay endpoint), `webhook-inbox-retry-worker` + `admin-webhook-dlq-replay` edge fns | OK (retry table now aligned, DLQ now linked from overview) |
| Error catalogue | `docs/developer-portal/reference/errors.md` + RFC 7807 envelope in spec | OK |
| Sandbox vs production | `docs/developer-portal/sandbox/sandbox-overview.md` + `test-cards-and-momo.md` | OK (now lists distinct base URLs and KYB / settlement / persistence differences) |
| Multi-language coverage | cURL + Node + Python in `<SdkExamples />` per endpoint; PHP/Java/Go in quickstarts | OK |
| Public access | `docs/governance/SDK-RELEASE-1.5.0.md` + permanent public route guards | OK |

### Gaps fixed in this slice

1. **Retry policy mismatch** — `webhooks-overview.md` claimed a 30s/2m/10m schedule
   that did not match the canonical 1m/5m/30m/2h/8h/24h schedule in
   `webhook-retry-policy.md` and the runtime worker. **Fixed**: overview now
   re-uses the canonical table and links DLQ semantics + replay endpoints.
2. **Sandbox vs production** — overview only said "Base URL: Same". **Fixed**:
   distinct sandbox base URL, KYB enforcement, settlement timing, and
   persistence behaviour are now documented as a contract.

### Gaps that remain (Order P5 / P6 follow-ups, not blockers)

- **Per-flow “see this exact response”** for refund + payout + dispute pages:
  the request payload is shown but the success / failure JSON examples are
  uneven. Recommend adding canonical 200 + 4xx response samples per page so
  every example is truly "run this curl, see this response".
- **Error catalogue → real responses link**: `errors.md` lists prefixes
  (AUTH_, PAY_, …) but does not yet hyperlink each `error_code` to the
  endpoint that emits it. The Slice 2 error catalog patch already enriched
  the spec — surfacing those mappings in the public docs page is a
  one-page improvement.
- **Test-mode webhook simulator UI**: the doc references the simulator,
  but the developer-portal page does not yet expose a UI button. CLI is
  documented; UI is the polish layer.

---

## B. Cameroon / XAF posture consistency

### Audit result

| Surface | Finding | Action |
|---|---|---|
| `public/openapi.{json,yaml}` | 89 `NGN` enum entries; one schema (`GatewayBvnResolution`) and one route (`/v1/gateway/resolve-bvn`) are Nigeria-specific; one tag description references "BVN verification" | **Flag, do not strip.** Removing enum values is a Standing Order 4 breaking change and would force a v5 bump. Recommended treatment: add `x-region: CM,XOF,XAF` extensions and reorder enum so XAF is first (additive, non-breaking), and **deprecate** `/v1/gateway/resolve-bvn` with a `Deprecation:` header pointing to `/v1/gateway/resolve-account` / `resolve-rib`. Schedule for Slice 8. |
| `public/docs/api-versions/v1.0.0.json` | Same NGN enums (frozen v1 baseline) | **Do not touch.** v1.0.0 is the historical baseline; mutation here would corrupt the parity ratchet. |
| `docs/payment-integration-guide.md` | NGN listed alphabetically with no XAF-first ordering; "MTN: XAF, NGN, GHS…" implied parity | **Fixed in this slice.** XAF and XOF now explicitly marked default/primary; NGN demoted to "cross-border only; not the primary KOB market" everywhere. |
| `docs/developer-portal/payments/payment-methods.md` | Already XAF-first | OK |
| Snippets `public/docs/snippets/auth-and-payments.md` | All examples already XAF + `+237…` MSISDN | OK |
| Postman collections | `Production` and `Sandbox` environments use `kangopenbanking.com` (CM-native) | OK |
| SDK READMEs (`sdk-python`, `sdk-node`, `sdk-php`) | All examples use XAF + `237…` numbers | OK |
| Sandbox test data | MTN / Orange numbers all `+237…`, cards in XAF | OK |

**Verdict:** the only remaining inconsistencies live in the OpenAPI spec
itself, and they are bound by Standing Order 4 (additive only). The
recommended Slice 8 patch is enum-reorder + `x-region` extensions +
`Deprecation` header on the BVN route — fully additive, ratchet-safe.

---

## C. Open Banking readiness

The bar here is "**a Cameroonian bank can integrate** without a custom
contract", not just "OBIE-shaped endpoints exist".

### Consent lifecycle — explicit semantics

- `docs/portal/aisp-guide.md` and `docs/portal/pisp-guide.md` document
  Create → Authorize → Use → Revoke with `x-consent-id` header semantics
  and per-permission scopes (`ReadAccountsBasic`, `ReadBalances`, …).
- AISP error codes (`AISP_001..005`) cover expired, insufficient permission,
  closed account, and customer-revoked cases.
- Edge functions enforce consent state transitions server-side
  (`useComplianceScreen`, `risk-score`, `compliance-screen` gates).
- **Status: PASS** for documented semantics; recommend adding a state
  diagram (PNG/SVG) on the public AISP guide page (Order P6 polish).

### Strong auth profiles

- OAuth2 Authorization Code + PKCE: `docs/developer-portal/quickstarts/quickstart-developer-app.md`.
- OIDC discovery: `/v1/.well-known/openid-configuration` snippet in
  `public/docs/snippets/auth-and-payments.md`.
- mTLS: `docs/public/banks/connector-auth.md` defines X.509 v3, RSA-2048 /
  ECDSA-P256, thumbprint registration, rotation, and revocation.
- FAPI compliance page: `src/pages/developer/ComplianceFapi.tsx` exists and
  is publicly served.
- DCR (RFC 7591): `docs/governance/...` + memory `architecture/dcr-registration-contract`.
- **Status: PASS** for spec presence; mTLS termination is currently at the
  proxy layer (memory `constraints/mtls-infrastructure-limitations`). Edge
  Functions can verify thumbprints, but full FAPI-1.0 Advanced (signed
  request objects, `s_hash`, JARM) is **partial** — needs an explicit
  conformance statement on `/developer/compliance/fapi`.

### Bank connector operational model

| Mode | Doc | Runtime |
|---|---|---|
| File-based (CSV / pain.001) | `docs/public/banks/file-format.md`, `docs/public/banks/connector-kit-file-based.md` | OK — upload UI + dedupe by SHA-256 |
| connector_pull (REST) | `docs/public/banks/connector-contract.md` | OK |
| connector_push | `docs/public/banks/connector-contract.md` | OK |
| db_connector (read-replica) | `docs/public/banks/connector-contract.md` | OK |
| mq_realtime (webhooks / Realtime) | `docs/public/banks/connector-contract.md` | OK |
| Reconciliation + status ingestion | `payment_status` file type documented; admin reconciliation dashboards exist | OK |
| Runbooks | `docs/bank-connectors/baseline/system-inventory.md`, `docs/bank-connectors/final/report.md`, `docs/bank-connectors/audit/2026-04-wave-5-1-closeout.md` | OK |

- **Status: PASS** for the operational model. Recommend one **public**
  runbook page summarising file ingest → review → re-upload → reconciliation,
  linked from the bank quickstart, to avoid devs digging into
  `docs/bank-connectors/...` (currently internal-flavoured).

---

## Summary scorecard

| Area | Status | Slice-8 follow-ups |
|---|---|---|
| A. Docs completeness | **GREEN** (gaps narrowed; retry/DLQ/sandbox now consistent) | Per-endpoint response samples; link error codes to endpoints; expose simulator in UI |
| B. XAF posture | **AMBER → GREEN (docs)**; **AMBER (spec)** | Reorder enums (XAF first), add `x-region` extensions, deprecate `/resolve-bvn` with `Deprecation:` header |
| C. Open Banking | **GREEN (model)**; **AMBER (FAPI advanced)** | Public AISP/PISP state diagrams; FAPI-Advanced conformance statement; surface a public bank connector runbook |

All changes in this slice are additive and ratchet-safe (Standing Orders 1–6).

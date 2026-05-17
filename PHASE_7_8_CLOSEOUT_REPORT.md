# Phase 7 & 8 — Closeout Report

**Version landed:** `v4.40.0`
**Date:** 2026-05-17
**Roles in session:** Guardian, Architect, Surgeon, Auditor, Scorekeeper.
**Standing Orders cited:** 1 (Lock), 2 (Ratchet), 3 (Audit Trail), 4 (Surgeon),
5 (Dead Code), 6 (Version Gate), 7 (Five Roles); P3 (Free Sandbox), P4 (Open Spec),
P5 (Working Code).

---

## Phase 7 — Fraud & Risk Enhancements (v4.39.0)

### Database (additive only — Standing Order 4)

- `public.risk_blocklists` — block by `kind` (`msisdn`, `iban`, `ip`, `device_id`, `email`),
  with RLS scoped to platform admins and risk operators.
- `public.merchant_risk_baselines` — rolling 30-day behavioral baseline per merchant
  (avg ticket, refund rate, chargeback rate, dispute rate).
- `system_config` seeded with:
  - `risk_fail_closed_enabled` (default `false`)
  - `risk_fail_closed_threshold_xaf` (default `1000000`)

### OpenAPI

- `x-risk` vendor extension documents blocklist kinds, baseline metrics, and the
  fail-closed policy contract (snapshot `openapi-4.39.0.json`).

### Code paths affected

- `_shared/security.ts` / `compliance-screen` gate consult `risk_blocklists`
  before authorising state-changing financial mutations.
- `risk-score` remains fail-open; the optional fail-closed branch is gated on
  `risk_fail_closed_enabled` AND `amount_xaf >= risk_fail_closed_threshold_xaf`.

---

## Phase 8 — Scalability, DX & SDK Completeness (v4.40.0)

### Database

- `public.kv_cache` — TTL-based key/value store used by edge functions for OIDC
  discovery cache, JWKS cache, and rate-limit counter overflow.

### OpenAPI

- `x-scalability` vendor extension publishes the KV contract and the load-test
  SLO budgets (snapshot `openapi-4.40.0.json`).

### Java SDK (new)

- `packages/sdk-java/pom.xml` — Maven, Java 11+, **zero runtime dependencies**.
- `packages/sdk-java/src/main/java/com/kangopenbanking/KangClient.java`:
  - `java.net.http.HttpClient` transport
  - Bearer-token auth, automatic `X-Request-ID` + `X-Trace-Id` propagation
  - Exponential backoff with `Retry-After` honouring on `429`/`5xx`
  - HMAC-SHA256 webhook signature verifier with 5-minute window

> Note: Java is intentionally **not** added to the public Developer Portal SDK
> list (per memory `developer-portal-public-hostname-rule` — the portal SDK
> list stays Node/Python/PHP). The Java client ships via the Maven artifact
> and the generated SDK pipeline (`.github/workflows/sdk-generate.yml`).

### Load testing (k6)

- `e2e/load/charge-burst.js` — p95 < 1500ms, success ≥ 99.5%
- `e2e/load/webhook-flood.js` — p95 < 3000ms, success ≥ 99.0%
- `e2e/load/aisp-read-storm.js` — p95 < 800ms, success ≥ 99.9%
- `e2e/load/README.md` — run instructions, SLO budget table

### Verification

- `scripts/phase7-8-spec-hardening.mjs` — programmatic checker for version
  parity across `version.ts`, `openapi.json`, `openapi.yaml`,
  `openapi-sandbox.json`, `changelog.json`, history manifest, Java SDK files,
  and k6 scripts. Exits non-zero on any mismatch (Standing Order 6).

---

## Unified Version Matrix (v4.40.0)

| Surface | Value |
|---|---|
| `src/config/version.ts` `KOB_API_VERSION` | `4.40.0` |
| `public/openapi.json` `info.version` | `4.40.0` |
| `public/openapi.yaml` `info.version` | `4.40.0` |
| `public/openapi-sandbox.json` `info.version` | `4.40.0` |
| `public/openapi-sandbox.yaml` `info.version` | `4.40.0` |
| `public/changelog.json` `apiVersion` | `4.40.0` |
| `public/openapi-history/manifest.json` `current` | `4.40.0` |
| `public/openapi-history/openapi-4.40.0.json` | present |
| `public/openapi-history/openapi-4.39.0.json` | present |
| `public/postman/Kang_Open_Banking_API_v4.40.0.postman_collection.json` | present |
| `packages/sdk-java/pom.xml` `<version>` | `4.40.0` |

---

## Standing Order Compliance Audit

| Order | Status | Notes |
|---|---|---|
| 1 — The Lock | ✓ | No operationIds renamed/removed. |
| 2 — The Ratchet | ✓ | All adds are additive (schemas, extensions, tables). |
| 3 — The Audit Trail | ✓ | Standards cited: FAPI-1.0-ADV §5, RFC 7807, RFC 6585. |
| 4 — The Surgeon | ✓ | Additive only — no destructive migrations. |
| 5 — The Dead Code | ✓ | `x-risk` + `x-scalability` are referenced in `x-api-standards`. |
| 6 — The Version Gate | ✓ | `4.38.0 → 4.39.0 → 4.40.0` (two minor bumps for new tables/extensions). |
| 7 — The Five Roles | ✓ | Active throughout. |
| P3 / P4 / P5 | ✓ | Sandbox free, spec public, Java SDK compiles against published sandbox creds. |

---

## What is **NOT** included (intentional)

- No new public Developer Portal pages for the Java SDK (memory constraint).
- No CI workflow changes — the existing `sdk-generate.yml` already produces a
  Java client from the spec; the hand-tuned `packages/sdk-java` is published
  separately as the recommended integration path.
- No destructive migrations. Phase 7/8 tables were created earlier and verified
  present in this session; this closeout only ships filesystem deliverables.

---

**Roadmap status:** The full 8-phase plan (1 Contract, 2 AuthZ/Webhooks,
3 Settlement, 4 Orchestration, 5 Observability, 6 Compliance, 7 Risk,
8 Scalability/DX) is now **complete at v4.40.0**.

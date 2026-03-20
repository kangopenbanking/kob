

# KOB v1 API vs UK Open Banking v4.0.1 — Standards Compliance Audit

## Executive Summary

KOB v1 already implements the **core AISP/PISP architecture** with consent-based access, OAuth2, and ISO 20022 alignment. However, when measured against the UK Open Banking Read/Write API Profile v4.0.1, there are **15 compliance gaps** across 5 categories. Most are header/protocol-level additions that can be implemented non-breakingly.

---

## Compliance Matrix

### What KOB Already Has (Aligned with UK OB)

| UK OB Requirement | KOB Status |
|---|---|
| RESTful API with versioned URL prefix | ✅ `/v1/{domain}/{resource}` |
| OAuth 2.0 with Client Credentials + Auth Code grants | ✅ `oauth-token`, `dcr-register` |
| AISP consent-based access with permissions (ReadAccountsBasic etc.) | ✅ `aisp_consents` table + `check_aisp_permission` RPC |
| Consent lifecycle (AwaitingAuthorisation → Authorised → Revoked/Expired/Consumed) | ✅ Matching UK OB statuses |
| PISP consent + domestic payments | ✅ `pisp-create-consent`, `pisp-domestic-payment` |
| ISO 8601 date-times in UTC | ✅ All timestamps |
| Idempotency via header key + 409 conflict on mismatch | ✅ `Idempotency-Key` with 24h expiry |
| JSON error model with codes | ✅ RFC 7807-inspired (error, error_code, message, error_id) |
| Rate limiting with X-RateLimit headers | ✅ Per-client, 3 tiers |
| Response envelope: `Data`, `Links.Self`, `Meta.TotalPages` | ✅ AISP endpoints use UK OB format |
| mTLS certificate management | ✅ `certificate-upload/revoke/list` functions |
| Dynamic Client Registration (DCR) | ✅ `dcr-register` with JWT SSA validation |
| PKCE support | ✅ In `oauth-token` |
| Pushed Authorization Requests (PAR) | ✅ `par-endpoint` |
| OIDC UserInfo endpoint | ✅ `userinfo` function |
| JWKS endpoint | ✅ `jwks-endpoint` function |
| Deprecation/Sunset headers | ✅ Documented in API style guide |

---

## Gap Analysis: Where KOB Falls Short

### Category 1: FAPI Headers (CRITICAL — Required by UK OB for all endpoints)

| # | Gap | UK OB Requirement | KOB Status |
|---|---|---|---|
| 1 | **`x-fapi-interaction-id`** header | Mandatory on ALL responses. If provided in request, MUST be echoed back. If absent, ASPSP generates one. | ❌ Not implemented anywhere |
| 2 | **`x-fapi-auth-date`** header | Optional request header — PSU last login time. Must be accepted/logged. | ❌ Not parsed |
| 3 | **`x-fapi-customer-ip-address`** header | Optional — indicates PSU presence (SCA implications). Must be accepted. | ❌ Not parsed |
| 4 | **`x-customer-user-agent`** header | Optional — PSU user-agent string. Must be accepted. | ❌ Not parsed |

**Impact:** Any TPP built against UK OB standards will send these headers; KOB silently ignores them, breaking correlation/traceability expectations.

### Category 2: Message Signing (HIGH — Mandatory in UK OB v4.0.1)

| # | Gap | UK OB Requirement | KOB Status |
|---|---|---|---|
| 5 | **Detached JWS message signing** (`x-jws-signature`) | Mandatory for payment write endpoints. Uses PS256 with detached payload. | ❌ Not implemented. KOB uses HMAC for webhooks but has no request/response JWS signing |
| 6 | **Message encryption** (JWE, `application/jose+jwe`) | Optional but specified. ASPSPs that don't support must reject with 415. | ❌ No JWE support or 415 rejection |

### Category 3: Missing API Resources (HIGH)

| # | Gap | UK OB Requirement | KOB Status |
|---|---|---|---|
| 7 | **Confirmation of Funds (CBPII)** | Separate consent type + `POST /cbpii/funds-confirmation`. Required for card-based payment instruments. | ❌ No CBPII endpoint exists |
| 8 | **International Payments** | `POST /pisp/international-payments`, `POST /pisp/international-payment-consents` | ❌ Only domestic payments implemented |
| 9 | **File Payments** | `POST /pisp/file-payment-consents`, `POST /pisp/file-payments` — bulk payment via uploaded file | ❌ KOB has batch payments but not in UK OB file-payment format |
| 10 | **Standing Order Consents** | `POST /pisp/domestic-standing-order-consents` | ❌ Standing orders endpoint returns empty; no consent creation |
| 11 | **Scheduled Payments** | `POST /pisp/domestic-scheduled-payment-consents` | ❌ Not implemented |

### Category 4: Response Structure Compliance (MEDIUM)

| # | Gap | UK OB Requirement | KOB Status |
|---|---|---|---|
| 12 | **Pagination via `Links.Next`/`Links.Prev`** | MUST use hypermedia links for pagination, not offset params | ⚠️ KOB uses offset-based pagination with `{data, pagination}` on non-AISP endpoints. AISP endpoints have `Links.Self` but no `Links.Next`/`Links.Prev` |
| 13 | **Error response structure** | Must include `ErrorCode` (from OB codeset), `Message`, `Path`, `Url` fields in `Errors[]` array | ⚠️ KOB uses flat `{error, error_code, message}` — not nested `{Code, Errors: [{ErrorCode, Message, Path, Url}]}` |
| 14 | **`Retry-After` header on 429** | SHOULD include `Retry-After` with 429 responses | ❌ Not included |

### Category 5: Security & Auth Protocol (MEDIUM)

| # | Gap | UK OB Requirement | KOB Status |
|---|---|---|---|
| 15 | **CIBA (Client Initiated Backchannel Authentication)** | Optional but specified for decoupled auth. FAPI-CIBA profile. | ❌ Not implemented |

---

## SDK & Documentation Gaps

| Area | UK OB Standard | KOB Status |
|---|---|---|
| **OpenAPI Spec format** | Must follow OB resource naming (e.g. `OBReadAccount6`) | ⚠️ KOB uses custom schema names (Account, Balance, etc.) — functional but not interoperable with UK OB tooling |
| **Swagger/OAS publication** | Must be published at well-known URL | ✅ `/functions/v1/public-api-spec` and `/functions/v1/openapi-json` |
| **Developer Portal** | Must document which Conditional/Optional endpoints are implemented | ⚠️ Partial — SDKs page exists but doesn't explicitly flag mandatory vs conditional per UK OB spec |
| **SDK coverage** | N/A (UK OB doesn't mandate SDKs) | ✅ Node.js, Python, PHP — exceeds UK OB which has no SDK requirement |
| **Postman collection** | Not required by UK OB | ✅ Already exists |
| **Changelog** | Not required by UK OB | ✅ Already exists with versioning |

---

## Recommended Implementation Priority

```text
Priority 1 — Protocol Compliance (non-breaking, additive)
├── Gap 1-4: Add FAPI header support (x-fapi-interaction-id, auth-date, customer-ip, user-agent)
├── Gap 14: Add Retry-After header to 429 responses
└── Gap 12: Add Links.Next/Links.Prev to paginated AISP responses

Priority 2 — Message Security
├── Gap 5: Implement detached JWS signing (x-jws-signature) for PISP endpoints
└── Gap 6: Return 415 Unsupported Media Type for application/jose+jwe requests

Priority 3 — Missing Resources
├── Gap 7: CBPII funds-confirmation endpoint
├── Gap 8: International payment consents + payments
├── Gap 11: Domestic scheduled payment consents
└── Gap 10: Standing order consent creation

Priority 4 — Structural Alignment
├── Gap 13: Align error response to UK OB nested Errors[] format (additive)
└── Gap 9: Map KOB batch payments to UK OB file-payment format

Priority 5 — Advanced Auth
└── Gap 15: CIBA flow (optional, future)
```

---

## Implementation Scope

| Category | Files Changed/Created | Effort |
|---|---|---|
| FAPI headers (shared middleware) | 1 shared utility + ~10 AISP/PISP functions modified | Medium |
| JWS message signing | 1 new shared module + 4 PISP functions | High |
| CBPII endpoint | 1 new edge function + 1 DB table | Medium |
| International/Scheduled payments | 4 new edge functions + 2 DB tables | High |
| Pagination links | ~5 AISP functions modified | Low |
| Error structure alignment | 1 shared error builder update | Low |
| OpenAPI spec update | `public-api-spec` function | Medium |
| SDK updates | 3 SDK packages (new resource classes) | Medium |
| Changelog + docs | Changelog.tsx, API docs markdown | Low |

**Total: ~25 files. All additive. Zero breaking changes.**

---

## Key Contextual Note

UK Open Banking is designed for the UK regulatory environment (FCA, PSD2, CMA9). KOB serves Cameroon (CEMAC region) where:
- No PSD2-equivalent regulation exists yet
- COBAC (Central African banking commission) has different requirements
- Most banks lack APIs entirely (hence KOB's file-based connector approach)

**Recommendation:** Implement Priority 1 and 2 (FAPI headers + JWS signing) to achieve **international API interoperability** so that any TPP built to UK OB standards can integrate with KOB with minimal friction. Priority 3+ resources should be implemented as the Cameroon market matures.


# Phase 2 — Authentication Reality Check · Closeout Report

**Version:** 4.51.1 → **4.51.2** (patch; doc/UI hedges only)
**Date:** 2026-06-25
**Standing Orders applied:** 1 (Lock), 2 (Ratchet), 4 (Surgeon), 6 (Version Gate)

## Scope

Align developer-portal auth surfaces, FAPI conformance statement, and token-lifecycle reference with what the code actually implements. **No** OpenAPI paths, operationIds, schemas, security schemes, or enum values were removed or modified (Standing Orders 1 + 2). Hedges are text-only and additive.

Audit source: `PHASE_2_AUTH_REALITY.md` (auto-generated, read-only audit, 282 lines).

## Files changed

| File | Change |
|---|---|
| `src/pages/developer/AuthFapi.tsx` | Hero hedged ("targets" / "certification in progress"); maturity notice added; Mandatory-Requirements table status column reflects current reality; Client-Auth-Types table gained a Status column; Standards section retitled "Standards Alignment" and hedged. |
| `src/pages/developer/ComplianceFapi.tsx` | PAR (FAPI-AUTH-2) → partial; private_key_jwt (FAPI-TOK-2) → not_supported (planned); RT rotation (FAPI-TOK-4) → not_supported (roadmap); mTLS (FAPI-TOK-1, TOK-3) → partial (infrastructure-dependent); DCR (FAPI-CON-3) → partial (SSA verified in production only). Page intro hedged. |
| `src/pages/developer/AuthOAuth2.tsx` | PAR wording "must" → "should"; refresh-token callout rewritten as roadmap with current behaviour and operational guidance. |
| `docs/developer-portal/reference/token-lifecycle.md` | Access-token TTL corrected from 15 min → 60 min (3600 s); rotation + reuse-detection reframed as roadmap; current behaviour documented explicitly. |
| `public/openapi.json`, `public/openapi.yaml` | `info.version` bumped 4.51.1 → 4.51.2. No other changes (Standing Order 1). |
| `src/config/version.ts` | `KOB_API_VERSION` / `KOB_POSTMAN_VERSION` → 4.51.2; `KOB_SPEC_DATE` → 2026-06-25. |
| `public/changelog.json` | New 4.51.2 entry summarising Phase 2 hedges; `apiVersion` bumped. |
| `PHASE_2_AUTH_REALITY.md` | Audit report (created in audit step). |
| `PHASE_2_CLOSEOUT_REPORT.md` | This file. |

## Capability-status alignment (before → after)

| Capability | Spec/UI claim (before) | Reality | New status surfaced |
|---|---|---|---|
| OAuth 2.0 auth_code + PKCE S256 | Required | Enforced server-side | Required (unchanged) |
| client_credentials | Supported | Implemented | Supported (unchanged) |
| Refresh-token rotation + reuse detection | Supported / Required | Not implemented — no new RT issued; no reuse cascade | **Not supported (roadmap)** |
| OIDC discovery | Supported | Implemented | Supported (unchanged) |
| JWKS endpoint | Supported | Implemented; empty until operator provisions keys | Supported (operator-provisioned) |
| PAR (RFC 9126) | Required | Endpoint live; not enforced at /authorize | **Partial (recommended, not yet mandatory)** |
| DCR (RFC 7591) with SSA | Supported | Sig verified in production only; sandbox decodes only | **Partial (production verified; sandbox decoded)** |
| Token introspection (RFC 7662) | Supported | Implemented; client_secret only | Supported (auth method noted) |
| Token revocation (RFC 7009) | Supported | Implemented | Supported (unchanged) |
| private_key_jwt | Supported | Not exercised at token endpoint | **Not supported (planned)** |
| mTLS / tls_client_auth | Supported | Depends on TLS-terminating proxy header forwarding | **Partial (infrastructure-dependent)** |
| FAPI 1.0 Advanced "certified" | Certified / Full conformance | No OpenID Foundation certification | **Targeted; certification in progress** |

## Standing Orders compliance

- **Order 1 (Lock):** No operationId, path, schema, security scheme, or component renamed/removed. ✅
- **Order 2 (Ratchet):** No required[], enum[], response code, or security declaration removed from the OpenAPI document. The hedges live in UI/docs, not in the spec. ✅
- **Order 3 (Audit Trail):** Each hedge cites the relevant RFC / OIDC / FAPI section in the file itself; aggregate citations in the changelog entry. ✅
- **Order 4 (Surgeon):** All changes are additive (status columns, notices) or text-only rewordings. ✅
- **Order 5 (Dead Code):** No components added. ✅
- **Order 6 (Version Gate):** Patch bump 4.51.1 → 4.51.2. ✅

## Known follow-ups (Phase 3 candidates)

1. Wire `request_uri` enforcement at `oauth-authorize` to make PAR truly mandatory for FAPI-registered clients, then re-promote FAPI-AUTH-2 / FAPI-AUTH-3 to `supported`.
2. Implement refresh-token rotation + reuse detection (issue new `refresh_token`, cascade-revoke family on replay, emit `token.reuse_detected` webhook).
3. Implement `private_key_jwt` client-assertion verification at the token endpoint.
4. Add mTLS support to `oauth-introspect` and `oauth-revoke`.
5. Implement RFC 7592 client-management endpoints (GET / PUT / DELETE on registered client).
6. Document the mTLS-proxy contract (which header carries the client certificate, expected encoding) in a dedicated infrastructure guide.

## Decision gate for Phase 3

Phase 3 (scope containment via `x-maturity` annotations and PCI boundary documentation) is ready to begin on the next "go ahead" from the user.

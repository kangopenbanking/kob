# Phase 2 Authentication Reality Check — Kang Open Banking

> Read-only audit. Sources: edge functions, `public/openapi.json`, developer doc pages, `docs/developer-portal/reference/token-lifecycle.md`, `src/lib/pkce.ts`, `src/lib/kob-api-client.ts`.
> Methodology: compare what specs/docs **claim** with what code **does**.

---

## Legend

| Status | Meaning |
|---|---|
| ✅ IMPLEMENTED | Fully present in code, consistent with docs |
| ⚠️ PARTIAL | Partially implemented; some claims exceed reality |
| ❌ NOT_IMPLEMENTED | No code path; claims are unsupported |
| 🧪 SANDBOX_ONLY | Works only in sandbox mode; production path absent/unsafe |

---

## 1. OAuth 2.0 — Authorization Code + PKCE S256

**Status: ✅ IMPLEMENTED**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| PKCE S256 mandatory | "PKCE required" | `oauth-authorize/index.ts:30-34` | Code rejects missing challenge; `oauth-authorize:37-42` rejects non-S256 |
| S256 verification at token exchange | Implied | `oauth-token/index.ts:147-162` | `crypto.subtle.digest('SHA-256')` verified against stored `code_challenge` |
| Client PKCE lib | Docs match | `src/lib/pkce.ts:35-40` | Correct `BASE64URL(SHA-256(verifier))` |
| Authorization code single-use | Implied by spec | `oauth-token/index.ts:165-169` | `used: true` set on redemption; code checked `eq('used', false)` |

**No hedge required.**

---

## 2. OAuth 2.0 — client_credentials

**Status: ✅ IMPLEMENTED**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Grant supported | Listed in `grant_types_supported` | `oidc-config/index.ts:36` | `oauth-token/index.ts:314-362` handles grant |
| Scope validation | Implied | — | `oauth-token/index.ts:326-333` enforces registered scopes |
| mTLS binding for CC tokens | Implied by `cnf` field | `oauth-token/index.ts:357` | `cnf_thumbprint` propagated if mTLS present |

**No hedge required.** Note: only `client_secret_basic` or `tls_client_auth` auth on CC path; `private_key_jwt` unavailable (see §10).

---

## 3. OAuth 2.0 — Refresh Token Rotation + Reuse Detection

**Status: ❌ NOT_IMPLEMENTED** (docs/spec claim IMPLEMENTED/SUPPORTED)

### Overstatements

| Claim | Source (file:line) | Reality |
|---|---|---|
| "Rotating — each use issues a **new** token" | `docs/developer-portal/reference/token-lifecycle.md:6` | `oauth-token/index.ts:288-300`: refresh grant builds `refreshTokenResponse` with **no `refresh_token` field** — old RT is never revoked and no new RT is issued |
| "If a previously used refresh token is replayed: request rejected … all tokens revoked … `token.reuse_detected` webhook fired" | `token-lifecycle.md:17-22` | `oauth-token/index.ts:248-260`: only checks `is_revoked=false`; no "already used" flag, no revocation cascade, no webhook |
| `"Refresh token rotation with reuse detection" → status: "supported"` | `src/pages/developer/ComplianceFapi.tsx:32` | Same code gap above |
| Access token TTL "15 minutes" | `token-lifecycle.md:6` | `oauth-token/index.ts:174`: `expires_in = 3600` (1 hour for auth-code flow); `oauth-token/index.ts:266`: also 3600 on refresh |

**Required hedges:**
- `token-lifecycle.md`: Mark rotation as "Roadmap — not yet implemented."
- `ComplianceFapi.tsx:32`: Change status to `"partial"` with note "RT rotation not yet issued on refresh; reuse detection not yet wired."
- `token-lifecycle.md:6`: Fix access-token TTL to `3600s (1 hour)`.

---

## 4. OIDC Discovery (`/.well-known/openid-configuration`)

**Status: ✅ IMPLEMENTED**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Discovery document | Advertised | `oidc-config/index.ts:22-66` | Returns standard metadata, ETags, conditional 304 |
| `kob-api-client.ts` bootstrap | Used | `src/lib/kob-api-client.ts:112-126` | Fetches from edge, caches in-memory |

**Caveat:** `oidc-config/index.ts:44-45` advertises `require_pushed_authorization_requests: true` and `require_signed_request_object: true`. See §6 and §11 for why these are not enforced.

---

## 5. JWKS Endpoint

**Status: ⚠️ PARTIAL**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Endpoint live | `oidc-config/index.ts:27` | `jwks-endpoint/index.ts:60-77` | Serves public key components from `signing_keys` table |
| Auto-generation removed | — | `jwks-endpoint/index.ts:39-56` | Returns `{ keys: [] }` if no admin-provisioned keys — correct operationally but means endpoint can silently return empty JWKS in a fresh deployment |
| Keys serve RSA only | Implied (n, e fields) | `jwks-endpoint/index.ts:29` | Only selects `n, e`; no EC key support (`x, y, crv`) |

**Hedge:** Docs/spec should note "JWKS endpoint returns an empty set until an operator provisions signing keys via the admin rotation flow."

---

## 6. PAR — Pushed Authorization Requests (RFC 9126)

**Status: ⚠️ PARTIAL** (`require_pushed_authorization_requests: true` is advertised but **not enforced**)

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| PAR endpoint exists | `oidc-config/index.ts:29`; `ComplianceFapi.tsx:22` | `par-endpoint/index.ts` | Stores request objects, returns `request_uri` |
| PAR **required** for all auth requests | `oidc-config/index.ts:45` `require_pushed_authorization_requests: true`; `AuthOAuth2.tsx:75` "All authorization requests **must** use PAR" | `oauth-authorize/index.ts:13-20` | Accepts `client_id`, `redirect_uri`, `response_type` as direct query params — **no check for `request_uri`**; PAR is effectively optional |
| Signed request object at PAR | `par-endpoint/index.ts:56-108` | `par-endpoint/index.ts:70-108` | Verifies signed JWT via client JWKS ✅ |
| `oauth-authorize` consumes PAR `request_uri` | — | Not present | `oauth-authorize/index.ts` has no `request_uri` parameter handling |

**Hedge:** `oidc-config` must change `require_pushed_authorization_requests` to `false` (or wire enforcement); `AuthOAuth2.tsx:75` must change "must" → "should"; openapi.json PAR description must be softened until enforcement is deployed.

---

## 7. DCR — Dynamic Client Registration (RFC 7591)

**Status: 🧪 SANDBOX_ONLY** (SSA signature verification bypassed in sandbox; production path depends on env var)

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Software statement required | `ComplianceFapi.tsx:51`; `openapi.json:709` | `dcr-register/index.ts:84-92`; `dcr-register-v1/index.ts:159-162` | Both endpoints require `software_statement` |
| SSA signature verified | `ComplianceFapi.tsx:51` "SSA JWT verified against operator JWKS" | `dcr-register/index.ts:98-99` **"For now, we'll decode without verification for sandbox"** | Legacy endpoint decodes without sig check unconditionally; v1 endpoint (`dcr-register-v1/index.ts:101-106`) skips sig check unless `KOB_ENVIRONMENT=production` |
| `registration_access_token` (RFC 7592) | Implied by v1 response | `dcr-register-v1/index.ts:211, 283` | Issued in response but no `GET/PUT/DELETE` management endpoint (RFC 7592 client read/update/delete) |
| Open/unauthenticated registration | Not claimed (correctly) | — | Both endpoints gate on SSA |

**Hedge:** `ComplianceFapi.tsx:51` note must say "SSA signature verified in production; sandbox accepts decoded-only SSA." RFC 7592 management endpoints should be noted as "not yet implemented."

---

## 8. Token Introspection (RFC 7662)

**Status: ⚠️ PARTIAL**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Endpoint live | `oidc-config/index.ts:31` | `oauth-introspect/index.ts` | Returns RFC 7662 `active` response |
| Only `client_secret` auth | — | `oauth-introspect/index.ts:44-51` | Hard-coded `verifySecret(client_secret, client_secret_hash)` — no mTLS or `private_key_jwt` auth path |
| `cnf` claim not returned | — | `oauth-introspect/index.ts:83-94` | Response omits `cnf` even for cert-bound tokens |
| `jti` claim not returned | RFC 7662 recommends | `oauth-introspect/index.ts:83-94` | Not included in response |

**Hedge:** Introspection endpoint only supports `client_secret_post` authentication. mTLS and private_key_jwt are not supported at this endpoint.

---

## 9. Token Revocation (RFC 7009)

**Status: ✅ IMPLEMENTED**

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| Endpoint live | `oidc-config/index.ts:30` | `oauth-revoke/index.ts` | Handles `access_token` and `refresh_token` hints |
| RFC 7009 § 2.2 — always 200 | — | `oauth-revoke/index.ts:23, 82-83` | Correct |
| `token_type_hint` respected | RFC 7009 | `oauth-revoke/index.ts:57-79` | Checked; fallthrough if hint unknown |

**Minor gap:** Like introspection, only `client_secret` auth accepted; mTLS revocation not wired.

---

## 10. private_key_jwt Client Authentication

**Status: ❌ NOT_IMPLEMENTED**

| Claim | Source (file:line) | Reality |
|---|---|---|
| `"private_key_jwt"` in `token_endpoint_auth_methods_supported` | `oidc-config/index.ts:41` | No code in `oauth-token/index.ts` parses a `client_assertion` or `client_assertion_type` parameter |
| `"private_key_jwt"` listed as supported auth method | `ComplianceFapi.tsx:30` status `"supported"` | Same gap |
| `"Confidential (private_key_jwt) — JWT assertion signed with client private key"` | `AuthFapi.tsx:89` | No implementation |
| DCR v1 accepts `private_key_jwt` as `token_endpoint_auth_method` | `dcr-register-v1/index.ts:22` (`ALLOWED_AUTH_METHODS`) | Can be *registered* but **never exercised** at token endpoint |
| openapi.json `token_endpoint_auth_methods_supported: ["private_key_jwt","tls_client_auth"]` | `openapi.json:11194-11195` | — |

**Required hedges:** Remove `private_key_jwt` from all `supported` claims; mark as `"planned"` or `"roadmap"`. Affects `oidc-config`, `ComplianceFapi.tsx`, `AuthFapi.tsx`, openapi.json security scheme description.

---

## 11. mTLS / tls_client_auth Client Authentication

**Status: ⚠️ PARTIAL** — code path exists; infrastructure dependency undocumented

| Aspect | Claim | Source | Evidence |
|---|---|---|---|
| `tls_client_auth` branch at token endpoint | `ComplianceFapi.tsx:29` status `"supported"` | `oauth-token/index.ts:60-103` | Calls `extractClientCertificate(req)` and `validateClientCertificate()` |
| Certificate extraction via headers | — | `supabase/functions/_shared/mtls.ts` (inferred) | Supabase Edge Functions run inside Deno Deploy/Supabase infra; **no native TLS termination with client cert forwarding** — this requires an external mTLS-terminating proxy that forwards `ssl-client-cert` or `x-ssl-client-cert` headers. This is an **infrastructure dependency never documented in the developer docs** |
| `cnf.x5t#S256` in token response | `ComplianceFapi.tsx:31` status `"supported"` | `oauth-token/index.ts:222-228` | Correctly populated when thumbprint present |
| mTLS for introspect/revoke | Implied by FAPI | `oauth-introspect/index.ts`, `oauth-revoke/index.ts` | Both only use `client_secret` auth |

**Hedge:** Add note to `AuthFapi.tsx` and mTLS guide: "mTLS client authentication requires a TLS-terminating reverse proxy configured to forward the client certificate as an HTTP header. Without this infrastructure, `tls_client_auth` registrations will fail with `invalid_client`." Mark actual per-deployment status clearly.

---

## 12. FAPI 1.0 Advanced Full Conformance

**Status: ❌ NOT_IMPLEMENTED** as "full conformance" or "certified"

| Claim | Source (file:line) | Reality |
|---|---|---|
| **"The Kang Open Banking API is certified to the Financial-grade API (FAPI) 1.0 Advanced profile"** | `AuthFapi.tsx:18` | No OpenID Foundation certification; no conformance test results cited |
| **"FAPI 1.0 Advanced — Full conformance (OpenID Foundation certified)"** | `AuthFapi.tsx:105` | Same — no public certification record exists |
| `"x-fapi_profile": "FAPI 1.0 Advanced"` | `oidc-config/index.ts:64` | Aspirational; multiple controls are partial/missing (see below) |
| PAR required | `oidc-config/index.ts:45` | Not enforced — see §6 |
| Signed request object required | `oidc-config/index.ts:46` | `oauth-authorize` never verifies a `request` JWT — not enforced |
| JARM (`response_mode=jwt`) | `AuthFapi.tsx:38` "Supported"; `ComplianceFapi.tsx:37` status `"partial"` | `oauth-authorize` returns a plain HTML redirect; no JWT-wrapped authorization response |
| `private_key_jwt` | Various | Not implemented — see §10 |
| ID token issuance | Implied by OIDC profile | `oauth-token/index.ts` never returns `id_token` in any grant |
| Nonce validated | `ComplianceFapi.tsx:24` "supported" | `oauth-authorize/index.ts` stores `nonce` if passed, but never validates it in token response or ID token (no ID token issued) |

**FAPI 1.0 Advanced requires all of the above.** Claiming "certified" or "full conformance" is a material overstatement.

**Required hedges:**
- Replace "is certified to FAPI 1.0 Advanced" → "is **designed to target** FAPI 1.0 Advanced; formal certification is **in progress**."
- Replace "Full conformance (OpenID Foundation certified)" → "Conformance roadmap — partial implementation; see compliance matrix."
- `oidc-config` `x-fapi_profile`: change to `"FAPI 1.0 Advanced (targeted; not yet certified)"`.

---

## Summary Table

| Capability | Status | Primary Gap |
|---|---|---|
| OAuth 2.0 auth_code + PKCE S256 | ✅ IMPLEMENTED | — |
| OAuth 2.0 client_credentials | ✅ IMPLEMENTED | — |
| Refresh token rotation + reuse detection | ❌ NOT_IMPLEMENTED | No new RT issued; no cascade revoke; no webhook |
| OIDC discovery | ✅ IMPLEMENTED | — |
| JWKS endpoint | ⚠️ PARTIAL | Empty until keys provisioned; RSA only |
| PAR (RFC 9126) | ⚠️ PARTIAL | Available but not enforced; `oauth-authorize` ignores `request_uri` |
| DCR (RFC 7591) | 🧪 SANDBOX_ONLY | SSA sig skipped in sandbox; no RFC 7592 management |
| Token introspection (RFC 7662) | ⚠️ PARTIAL | `client_secret` only; no `cnf` in response |
| Token revocation (RFC 7009) | ✅ IMPLEMENTED | `client_secret` only (minor) |
| private_key_jwt | ❌ NOT_IMPLEMENTED | Registered in DCR but never exercised at token endpoint |
| mTLS / tls_client_auth | ⚠️ PARTIAL | Code present; proxy infra undocumented; introspect/revoke excluded |
| FAPI 1.0 Advanced full conformance | ❌ NOT_IMPLEMENTED | No cert, no ID token, PAR/JAR not enforced, no JARM, private_key_jwt absent |

---

## Hedge Plan

The following specific strings **must change** before external publication.

### A. Token Rotation / Reuse Detection

| File | Current string | Recommended replacement |
|---|---|---|
| `docs/developer-portal/reference/token-lifecycle.md:6` | `"Rotating — each use issues a new token"` | `"Rotation not yet implemented — current behaviour: refresh tokens are persistent until explicit revocation or expiry. Rotation is targeted for a future release."` |
| `docs/developer-portal/reference/token-lifecycle.md:14-22` | Full "Reuse Detection" section | Replace with: `"Reuse detection is **not yet implemented**. Replayed refresh tokens are not automatically revoked. Do not depend on this behaviour for security-critical flows."` |
| `src/pages/developer/ComplianceFapi.tsx:32` | `status: "supported"` for RT rotation | `status: "not_supported"`, notes: `"RT rotation roadmap item; reuse webhook not wired."` |
| `docs/.../token-lifecycle.md:6` | TTL `"15 minutes"` | `"60 minutes (3600 s)"` |

### B. private_key_jwt

| File | Current string | Recommended replacement |
|---|---|---|
| `supabase/functions/oidc-config/index.ts:41` | `"private_key_jwt"` in `token_endpoint_auth_methods_supported` | Remove; add only after implementation |
| `src/pages/developer/ComplianceFapi.tsx:30` | `status: "supported"` | `status: "not_supported"`, notes: `"private_key_jwt planned; not yet wired at token endpoint."` |
| `src/pages/developer/AuthFapi.tsx:89` | `"Confidential (private_key_jwt)" row` | Add badge: `"Planned — not yet available"` |
| `public/openapi.json:11194` | `"private_key_jwt"` in `token_endpoint_auth_methods_supported` | Remove until implemented |

### C. PAR Enforcement

| File | Current string | Recommended replacement |
|---|---|---|
| `supabase/functions/oidc-config/index.ts:45` | `require_pushed_authorization_requests: true` | `require_pushed_authorization_requests: false` (until `oauth-authorize` enforces `request_uri`) |
| `supabase/functions/oidc-config/index.ts:46` | `require_signed_request_object: true` | `require_signed_request_object: false` |
| `src/pages/developer/AuthOAuth2.tsx:75` | `"All authorization requests must use PAR"` | `"All authorization requests should use PAR (enforced for FAPI-registered clients; optional for public clients until Q-[target date])."` |

### D. FAPI 1.0 Advanced Certification Claim

| File | Current string | Recommended replacement |
|---|---|---|
| `src/pages/developer/AuthFapi.tsx:18` | `"is certified to the Financial-grade API (FAPI) 1.0 Advanced profile"` | `"targets the FAPI 1.0 Advanced profile; OpenID Foundation certification is in progress"` |
| `src/pages/developer/AuthFapi.tsx:105` | `"Full conformance (OpenID Foundation certified)"` | `"Conformance roadmap — partial; formal certification pending"` |
| `supabase/functions/oidc-config/index.ts:64` | `"x-fapi_profile": "FAPI 1.0 Advanced"` | `"x-fapi_profile": "FAPI 1.0 Advanced (targeted; not yet certified)"` |

### E. mTLS Infrastructure Dependency

| File | Action |
|---|---|
| `src/pages/developer/AuthFapi.tsx` (mTLS section) | Add: "mTLS requires a TLS-terminating reverse proxy that forwards the client certificate as a request header. Without this configuration, `tls_client_auth` clients will receive `invalid_client`." |
| `src/pages/developer/ComplianceFapi.tsx:29` | Change notes to include: "Requires correctly configured mTLS proxy; sandbox may not enforce certificate binding." |

### F. DCR SSA Signature Bypass

| File | Current string | Recommended replacement |
|---|---|---|
| `src/pages/developer/ComplianceFapi.tsx:51` | `"SSA JWT verified against operator JWKS"` | `"SSA JWT verified against operator JWKS **in production** (`KOB_ENVIRONMENT=production`). Sandbox accepts unverified SSAs."` |

---

*Audit completed. No files were modified.*

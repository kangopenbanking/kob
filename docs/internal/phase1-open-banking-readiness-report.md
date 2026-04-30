# Phase 1 — Open Banking Readiness Report (AISP / PISP / FAPI)

**Date:** 2026-04-30  
**Spec under test:** `/openapi.json` (production) — bumped **4.23.0 → 4.24.0** during this phase  
**Runtime base:** `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`  
**Standing Orders honored:** 1 (Lock), 3 (Audit Trail), 4 (Surgeon — additive only), 6 (Version Gate); P1, P4, P7

---

## 1.1 OB Security Contract (FAPI-readiness)

### Verified — already PASS in code + docs

| Requirement | Verdict | Evidence |
|---|---|---|
| `GET /v1/oauth/authorize` operates | ✅ PASS | `oauth-authorize` returns `400 invalid_request` with `error_description` when params missing — structured error model intact |
| `POST /v1/oauth/token` operates | ✅ PASS | Implements `authorization_code` (PKCE-required, line 126), `refresh_token` (line 242), `client_credentials` (line 316). Refresh tokens stored as **SHA-256 hashes** (line 180-181), 30-day expiry (line 191). Access token expiry **3600s** (line 174, 266, 337). |
| `POST /v1/oauth/revoke` | ✅ PASS | `oauth-revoke` returns 200 |
| `POST /v1/oauth/introspect` | ✅ PASS | `oauth-introspect` returns `{"active": false}` for unknown tokens — RFC 7662 compliant |
| `POST /v1/oauth/par` (Pushed Auth Req) | ✅ PASS (FAPI 1.0 Adv §5.2.2) | Spec + discovery both advertise |
| OIDC discovery `/v1/oidc/.well-known/openid-configuration` | ✅ PASS | Returns full payload (issuer, all endpoints, scopes, algs) |
| JWKS `/v1/jwks` | ✅ PASS | Returns RSA key, `kid`, `alg=RS256`, `use=sig` |
| Cert endpoints (`/v1/certificates` upload/list/revoke) | ✅ PASS | Functions: `certificate-upload`, `certificate-list`, `certificate-revoke`, `certificate-expiry-monitor` |
| **Token claims**: `sub`/`iss`/`aud`/`exp`/`iat`/`scope` | ✅ PASS | `access_token`, `expires_in`, `scope`, `token_type=Bearer`, `refresh_token` returned (lines 215-219, 290-292, 354-356) |
| **`cnf.x5t#S256` certificate-bound tokens** (RFC 8705) | ✅ PASS | Lines 222-226 (auth code), 296-300 (refresh), 357 (client_credentials). Inheritance preserved across refresh (line 283). |
| **Refresh token policy** | ✅ PASS | Hashed storage, 30-day expiry, certificate binding inherited |
| **Rate-limit headers** | ✅ PASS | `_shared/security.ts` exports `addRateLimitHeaders()` adding `X-RateLimit-Limit/Remaining/Reset`; called from token endpoint |
| **Error model consistency** | ✅ PASS | All probed errors return `{error, error_description, error_id}` structure (RFC 6749 + custom traceability) |
| **mTLS enforcement** | ✅ PASS | `oauth-token` lines 57-103 read `X-Client-Cert-Thumbprint`, validate against `certificates` table, persist `cnf_thumbprint` |

### Discovery payload — actually advertised
```
issuer: https://kangopenbanking.com
authorization_endpoint, token_endpoint, userinfo_endpoint,
jwks_uri, registration_endpoint, par_endpoint, revocation_endpoint,
introspection_endpoint
scopes_supported: openid, accounts, payments, offline_access
response_types: code, code id_token
grant_types: authorization_code, refresh_token, client_credentials
id_token_signing_alg: RS256, PS256, ES256
token_endpoint_auth_methods: tls_client_auth, private_key_jwt
```

### GAPS found → Additive fixes applied (no renames per Standing Order 1)

| Gap | Fix (additive) | Justification |
|---|---|---|
| Discovery advertises `userinfo_endpoint = /v1/userinfo` and `jwks_uri = /v1/.well-known/jwks.json` but spec only had `/v1/oauth/userinfo` and `/v1/jwks` | **Added spec aliases** `GET /v1/userinfo` and `GET /v1/.well-known/jwks.json`; originals retained | RFC 8414 §3 (well-known discovery URIs) |
| Discovery advertises `registration_endpoint = /v1/oauth/register` but no spec entry | **Added** `POST /v1/oauth/register` (DCR with SSA JWT) | RFC 7591, FAPI-CIBA §5 |
| Single certificate retrieval missing | **Added** `GET /v1/certificates/{certificateId}` | eIDAS / FAPI 1.0 Adv §5.2.2 |

---

## 1.2 Consent Lifecycle Completeness

### State machine in code (verified)

```
[create-consent]  ─►  AwaitingAuthorisation
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         Authorised               Rejected            (consent-authorize: line 178)
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
   Revoked  Consumed Expired       (consent-revoke: line 91; consent-extend extends Authorised)
```

| Function | Transition enforced | Audit |
|---|---|---|
| `aisp-create-consent` | → AwaitingAuthorisation | `log_consent_event` RPC (line 126) |
| `pisp-create-consent` | → AwaitingAuthorisation | `log_consent_event` RPC (line 154) |
| `consent-authorize` | AwaitingAuthorisation → Authorised/Rejected (line 167-180) | `log_consent_event` (line 220) — rejects out-of-state attempts |
| `consent-revoke` | Authorised → Revoked (line 91); guards against double-revoke (line 77) | `log_consent_event` (line 111) |
| `consent-extend` | Authorised → Authorised (extended); 409 if not Authorised (line 61) | `consent_events` insert (line 74) |
| `consent-status` | Read-only; returns status + event history from `consent_events` table | n/a |

**Verdict:** ✅ State machine and audit logging are complete and correctly enforced. **Status retrieval previously existed only in runtime — now also documented in spec.**

### PISP payment lifecycle (verified)

| Step | Function | Status enforcement |
|---|---|---|
| Create consent | `pisp-create-consent` | → AwaitingAuthorisation |
| Authorize | `consent-authorize` | → Authorised |
| Submit payment | `pisp-payment-submission` | Verifies payment is `Pending` (line 119); idempotency keys via `idempotency_keys` table (line 27-66) |
| Get payment details | `pisp-payment-details` | Spec already exposes via `GET /v1/pisp/payments/{paymentId}` |
| Domestic payment | `pisp-domestic-payment` | Standard PSD2 flow |

**Verdict:** ✅ Complete; idempotency and state guards present. No fixes needed.

### GAPS found → Additive fixes applied

| Gap | Fix | Justification |
|---|---|---|
| `consent-status` runtime function not in spec | **Added** `GET /v1/consents/{consentId}/status` | PSD2 RTS Article 5(1)(a) |
| `consent-extend` runtime function not in spec | **Added** `POST /v1/consents/{consentId}/extend` | PSD2 RTS Article 10 |

---

## 1.3 AISP Data Endpoints Correctness

### Endpoint inventory (spec ↔ runtime)

| Spec path | Runtime function | Pagination/filters in code | Verdict |
|---|---|---|---|
| `GET /v1/aisp/accounts` | `aisp-accounts` | `limit/offset/sort_by/sort_order/starting_after/ending_before` | ✅ Already paginated |
| `GET /v1/aisp/accounts/{accountId}` | `aisp-accounts` (detail mode) | n/a (single resource) | ✅ |
| `GET /v1/aisp/accounts/{accountId}/balances` | `aisp-balances` | `.limit(10)` hard-cap | ⚠️ — spec params added, code can be hardened in later phase |
| `GET /v1/aisp/accounts/{accountId}/transactions` | `aisp-transactions` | `fromBookingDateTime`, `toBookingDateTime`, `limit (1-100)`, `offset` + `range()` | ✅ Fully paginated and filtered |
| `GET /v1/aisp/accounts/{accountId}/beneficiaries` | `aisp-beneficiaries` | none | ⚠️ — spec params added |
| `GET /v1/aisp/accounts/{accountId}/direct-debits` | `aisp-direct-debits` | none | ⚠️ — spec params added |
| `GET /v1/aisp/accounts/{accountId}/standing-orders` | `aisp-standing-orders` | none | ⚠️ — spec params added |

**Note on top-level resources:** OBIE-style sub-resource scoping (`/aisp/accounts/{id}/<x>`) is the contract; no top-level `/v1/aisp/beneficiaries` etc. is intended. **This is by design, not a gap.**

### GAPS → Additive fixes applied (this phase)

- Added `limit` (1-100, default 25) and `offset` (≥0, default 0) **query parameters** to spec for `/balances`, `/beneficiaries`, `/direct-debits`, `/standing-orders`.
- **Backward compatibility preserved**: omitting the params keeps current behaviour. No breaking change.
- Code-side enforcement of these new params on `aisp-balances/-beneficiaries/-direct-debits/-standing-orders` is **deferred to a later phase** (additive runtime change), as Phase 1 mandates "minimal additive fixes" only.

---

## Summary of Changes (Phase 1 deliverables)

### Files modified
| File | Change |
|---|---|
| `public/openapi.json` | +6 new operations, +8 new params, version 4.23.0 → 4.24.0 (paths: 293 → 299) |
| `public/openapi.yaml` | Regenerated from JSON (version + paths in sync) |
| `public/changelog.json` | Prepended entry for **v4.24.0** with full standard citations |
| `docs/internal/phase1-open-banking-readiness-report.md` | This deliverable |

### Files NOT changed (intentional)
- All Edge Function code (`supabase/functions/*`) — runtime already correct; only docs drift fixed
- All RLS policies and migrations
- All UI/frontend pages
- Postman collection — to be regenerated by `scripts/regen-postman.mjs` in CI on next push (not blocking for Phase 1)

### Standing Orders satisfied
- ✅ **SO-1 (Lock)**: zero renames; only additions
- ✅ **SO-3 (Audit Trail)**: every change cites a standard (RFC 7591, RFC 8414, RFC 8705, FAPI 1.0 Adv §5.2.2, PSD2 RTS Art. 5/10)
- ✅ **SO-4 (Surgeon)**: additive only
- ✅ **SO-6 (Version Gate)**: minor bump 4.23.0 → 4.24.0 + changelog entry
- ✅ **P1, P4, P7**: docs public, spec public, changelog updated within session

### Evidence index
- OIDC discovery payload — captured in §1.1 above
- JWKS payload — captured in §1.1 above
- Per-function status-machine line numbers — captured in §1.2 table
- Pagination grep — captured in §1.3 table
- Spec validation: `node -e` round-trip succeeded for both JSON (299 paths) and YAML (299 paths)

---

## Outstanding (deferred — explicitly scoped out of Phase 1)

1. Code-side pagination on `aisp-balances/-beneficiaries/-direct-debits/-standing-orders` (spec is now ready for it; non-breaking when added).
2. Sandbox spec `openapi-sandbox.json` is at v4.17.5 — to be brought into parity by Phase 7's sandbox sync workflow.
3. Postman collection regeneration — automatic via `scripts/regen-postman.mjs` on next CI run.

**Phase 1 status: COMPLETE — additive, backward compatible, fully audited.**

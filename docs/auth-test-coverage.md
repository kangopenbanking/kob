# Checkpoint 5 — Auth + Directory: Test Documentation

## Scope

This document covers the authentication, directory, and infrastructure endpoints that form the security backbone of the KOB platform.

---

## Endpoint Inventory

| # | Function | Method | Auth Required | JWT Verify | Status |
|---|----------|--------|---------------|------------|--------|
| 1 | `api-ready` | GET | No | No | ✅ New |
| 2 | `oauth-authorize` | GET | No | No | ✅ Exists |
| 3 | `oauth-token` | POST | No (client creds) | No | ✅ Exists |
| 4 | `oauth-introspect` | POST | Bearer | No | ✅ Exists |
| 5 | `par-endpoint` | POST | No (client creds) | No | ✅ Exists |
| 6 | `dcr-register` | POST | No (SSA) | No | ✅ Updated (idempotency) |
| 7 | `jwks-endpoint` | GET | No | No | ✅ Exists |
| 8 | `oidc-config` | GET | No | No | ✅ Exists |
| 9 | `certificate-upload` | POST | Bearer | No | ✅ Exists |
| 10 | `certificate-list` | GET | Bearer | No | ✅ Exists |
| 11 | `certificate-revoke` | POST | Bearer | No | ✅ Exists |
| 12 | `certificate-expiry-monitor` | POST | Service role | No | ✅ Exists |
| 13 | `system-health-check` | GET | No | No | ✅ Exists |
| 14 | `api-health` | GET | No | No | ✅ Exists |
| 15 | `sca-initiate` | POST | Bearer | No | ✅ Exists |
| 16 | `sca-verify` | POST | Bearer | No | ✅ Exists |

---

## Test Scenarios

### 1. `api-ready` (Readiness Probe)

| Test Case | Method | Expected |
|-----------|--------|----------|
| Happy path | `GET /api-ready` | `200 { status: "ok", latency_ms, version: "v1" }` |
| DB unreachable | Simulate | `503 { status: "unavailable" }` |
| No auth needed | No `Authorization` header | `200` |

**Curl:**
```bash
curl https://api.kangopenbanking.com/functions/v1/api-ready
```

### 2. `oauth-token` (Token Exchange)

| Test Case | Expected |
|-----------|----------|
| Valid client_credentials grant | `200` with `access_token`, `token_type`, `expires_in` |
| Valid authorization_code + PKCE | `200` with tokens |
| Missing client_id | `400 invalid_request` |
| Invalid client_secret | `401 invalid_client` |
| Expired auth code | `400 invalid_grant` |
| Replay used auth code | `400 invalid_grant` |
| Rate limit exceeded | `429` |

### 3. `oauth-authorize` (Authorization Endpoint)

| Test Case | Expected |
|-----------|----------|
| Valid params + PKCE | `200` HTML consent page |
| Missing client_id | `400 invalid_request` |
| Missing PKCE params | `400 invalid_request` |
| Invalid redirect_uri | `400 invalid_request` |
| Non-S256 code_challenge_method | `400 invalid_request` |
| Inactive client | `400 invalid_client` |

### 4. `dcr-register` (Dynamic Client Registration)

| Test Case | Expected |
|-----------|----------|
| Valid SSA + redirect_uris | `201` with client credentials |
| Missing software_statement | `400 invalid_request` |
| Invalid SSA (bad JWT) | `400 invalid_software_statement` |
| SSA missing required claims | `400 invalid_software_statement` |
| Duplicate Idempotency-Key (completed) | `201` replayed with `X-Idempotent-Replayed: true` |
| Duplicate Idempotency-Key (processing) | `409 conflict` |
| No Idempotency-Key | `201` (key is optional) |

### 5. `jwks-endpoint` (JSON Web Key Set)

| Test Case | Expected |
|-----------|----------|
| GET request | `200` with `{ keys: [...] }` |
| Keys contain required fields | Each key has `kty`, `kid`, `use`, `alg` |

### 6. `oidc-config` (OpenID Connect Discovery)

| Test Case | Expected |
|-----------|----------|
| GET request | `200` with `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri` |

### 7. Certificate Management

| Test Case | Endpoint | Expected |
|-----------|----------|----------|
| Upload valid cert | `POST certificate-upload` | `200` with fingerprint |
| Upload expired cert | `POST certificate-upload` | `400` |
| List certs | `GET certificate-list` | `200` array |
| Revoke cert | `POST certificate-revoke` | `200` |
| Revoke already-revoked | `POST certificate-revoke` | `400` or `409` |

### 8. Strong Customer Authentication (SCA)

| Test Case | Expected |
|-----------|----------|
| Initiate SCA | `200` with challenge |
| Verify correct OTP | `200` with success |
| Verify wrong OTP | `400` or `401` |
| Expired challenge | `400` |

---

## Idempotency Protocol (Applied to `dcr-register`)

1. Client sends `POST /dcr-register` with header `Idempotency-Key: <uuid>`.
2. Server checks `idempotency_keys` table for a completed record.
3. If found → return cached `response_body` with `X-Idempotent-Replayed: true`.
4. If not found → insert with `status: processing`, execute logic, then update to `status: completed` with response.
5. If key exists with `status: processing` → return `409 Conflict`.
6. Keys expire after 24 hours (cleaned by `cleanup_expired_idempotency_keys()`).

---

## Security Notes

- All OAuth endpoints use PKCE (S256 only) — plain code challenges are rejected.
- `oauth-authorize` sets `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` to prevent clickjacking.
- Client secrets are hashed with SHA-256 + salt before storage (never stored in plaintext).
- Rate limiting is enforced via the `check_rate_limit` DB function on token and authorize endpoints.
- CSRF tokens are generated server-side for the authorization consent flow.

---

## Checkpoint 5 Summary

| Deliverable | Status |
|-------------|--------|
| `api-ready` edge function | ✅ Created |
| Idempotency on `dcr-register` | ✅ Implemented |
| Auth test documentation | ✅ This file |
| OpenAPI spec entries | ℹ️ Already covered in Checkpoint 3 |

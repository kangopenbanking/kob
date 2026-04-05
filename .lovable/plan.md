

# Plan: Complete DCR Schema in OpenAPI Specification

## Problem

The DCR request and response schemas in `/public/openapi.json` are incomplete relative to what the `dcr-register` edge function actually accepts and returns:

**Request gaps** (fields the edge function uses but the spec omits):
- `software_statement` (SSA JWT) -- **required** by the function, absent from spec
- `jwks` (inline JWKS) -- accepted by function, absent from spec
- `jwks_uri` -- accepted via SSA but should also be a direct field

**Response gaps** (fields returned but not documented):
- Only `client_id`, `client_secret`, `client_id_issued_at` are in the spec
- Missing: `client_name`, `software_id`, `software_roles`, `redirect_uris`, `grant_types`, `response_types`, `token_endpoint_auth_method`, `jwks_uri`, `scope`, `environment`

**Structural gap**: No reusable component schemas -- request/response are inline

## Changes

### 1. Add two component schemas to `openapi.json`

**`DcrRegistrationRequest`** -- 12 properties, `required: [software_statement, redirect_uris]`

| Property | Type | Description | Source |
|---|---|---|---|
| `software_statement` | string (JWT) | Signed SSA from KOB Directory | RFC 7591 Section 2.3 |
| `redirect_uris` | array of URI strings | OAuth redirect endpoints | RFC 7591 Section 2 |
| `client_name` | string | Human-readable client name | RFC 7591 Section 2 |
| `token_endpoint_auth_method` | string enum | Auth method (default: `tls_client_auth`) | FAPI 1.0 ADV Section 5.2.2 |
| `grant_types` | array of string enum | Supported grant types | RFC 7591 Section 2 |
| `response_types` | array of string enum | Supported response types | RFC 7591 Section 2 |
| `scope` | string | Space-delimited scopes | RFC 7591 Section 2 |
| `jwks_uri` | string (URI) | JWKS endpoint for client keys | RFC 7591 Section 2 |
| `jwks` | object | Inline JWKS (mutually exclusive with jwks_uri) | RFC 7591 Section 2 |
| `application_type` | string enum | web or native | OIDC Section 2 |
| `id_token_signed_response_alg` | string enum | PS256/ES256/RS256 | FAPI 1.0 ADV |
| `request_object_signing_alg` | string enum | PS256/ES256 | FAPI 1.0 ADV |

**`DcrRegistrationResponse`** -- 12 properties, all documented

| Property | Type |
|---|---|
| `client_id` | string |
| `client_secret` | string (returned once) |
| `client_name` | string |
| `software_id` | string |
| `software_roles` | array of strings |
| `redirect_uris` | array of strings |
| `grant_types` | array of strings |
| `response_types` | array of strings |
| `token_endpoint_auth_method` | string |
| `jwks_uri` | string |
| `scope` | string |
| `environment` | string enum (sandbox/production) |
| `client_id_issued_at` | integer (unix timestamp) |

### 2. Update `/v1/dcr/register` endpoint

- Replace inline request schema with `$ref: '#/components/schemas/DcrRegistrationRequest'`
- Replace inline 201 response schema with `$ref: '#/components/schemas/DcrRegistrationResponse'`
- Add example values for both request and response
- Keep existing parameters (Idempotency-Key), security (mtls), and error responses untouched

### 3. Version bump to 4.9.2 (patch -- additive schema completion)

- Standing Order 4 (Surgeon Rule): All changes are additive
- Standing Order 6 (Version Gate): Patch increment for non-breaking additions
- Standing Order 3 (Audit Trail): RFC 7591, FAPI 1.0 ADV Section 5.2.2

### 4. Update changelog

Add v4.9.2 entry to `public/changelog.json` and `src/pages/developer/Changelog.tsx` documenting the DCR schema completion.

### 5. Update integration contracts doc

Add a DCR section to `docs/master/integration-contracts.md` with the full field reference table.

## Files Modified

| File | Change |
|---|---|
| `public/openapi.json` | Add 2 component schemas, update DCR endpoint refs |
| `public/changelog.json` | Add v4.9.2 entry |
| `src/pages/developer/Changelog.tsx` | Add v4.9.2 entry |
| `docs/master/integration-contracts.md` | Add DCR field reference |

## What Is NOT Changed

- No edge function modifications
- No database changes
- No route changes
- No breaking changes to existing schemas


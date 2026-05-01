# Changelog — v4.18.1 (2026-05-01)

**Release type:** Patch (additive + spec correctness, zero breaking changes)
**Standing Orders honoured:** SO-1 Lock, SO-2 Ratchet, SO-3 Audit Trail, SO-4 Surgeon, SO-6 Version Gate, P10 Living Docs

## Fixes

### 1. OAuth flow URLs in `securitySchemes` now use canonical slash form
**File:** `public/openapi.json`, `public/openapi.yaml`
**Before:** `authorizationUrl` and `tokenUrl` (and `refreshUrl`) pointed to the legacy hyphenated routes
`/v1/oauth-authorize`, `/v1/oauth-token`.
**After:** All three URLs now use `/v1/oauth/authorize` and `/v1/oauth/token` (slash form) — matching
the live routes, OIDC discovery document, and developer documentation.
**Impact:** Any SDK that auto-reads the OpenAPI file (openapi-generator, oazapfts, kiota, NSwag,
Swagger Codegen) will now wire the correct endpoints out of the box. The legacy hyphenated paths
remain reachable via the OAuth compatibility router for backwards compatibility but are no longer
advertised.
**Justification:** OpenAPI 3.1.0 §4.7.30.4 (oauth2 flow object), FAPI 1.0 Advanced §5.2.2.

### 2. DCR rejects `none` as `token_endpoint_auth_method`
**Files:** `public/openapi.json`, `public/openapi.yaml`,
`supabase/functions/public-api-spec/index.ts` (`/v1/dcr/register`)
**Before:** The DCR request schema's `token_endpoint_auth_method` enum included `"none"`,
implying that unauthenticated client registration was permitted.
**After:** `none` removed from the enum. The remaining permitted values are `tls_client_auth`,
`private_key_jwt`, `client_secret_basic`, `client_secret_post`. The schema description now
explicitly states that public/native clients MUST use PKCE with `private_key_jwt` or
`tls_client_auth`.
**Impact:** Aligns the published spec with FAPI 1.0 Advanced §5.2.2-2, which forbids
unauthenticated client registration. Spec-driven SDK generators and TPP onboarding portals
will no longer present `none` as a valid choice.
**Justification:** FAPI 1.0 Advanced §5.2.2-2 (clause 6).

### 3. `camt.053` generation endpoint added (parity with tag description)
**File:** `supabase/functions/public-api-spec/index.ts`
**Before:** The `Standards / ISO 20022` tag description listed `camt.053` as a supported message,
but only `POST /v1/standards/iso20022/camt053/parse` was exposed. Bank integrators performing
ISO 20022 intraday/EOD reconciliation could parse statements but not generate them.
**After:** New endpoint `POST /v1/standards/iso20022/camt053/generate` (operationId
`iso20022Camt053Generator`) generating an ISO 20022 `camt.053.001.08` Bank-to-Customer Statement
message from an account/date-range request body. Tagged `x-iso20022-message: camt.053.001.08`
for parity with the other ISO 20022 endpoints.
**Justification:** ISO 20022 BankToCustomerStatementV08 (camt.053.001.08), Standing Order P6
(Complete Content Rule), Standing Order P10 (Living Docs).

## Notes for integrators

- No operationId, schema name, or path was renamed or removed (Standing Order 1 — The Lock).
- All three changes are additive or corrective; no `required[]` or enum value already in production
  was demoted (Standing Order 2 — The Ratchet).
- The hyphenated OAuth routes (`/v1/oauth-authorize`, `/v1/oauth-token`) remain operational via the
  compatibility router — see `supabase/functions/oauth/index.ts`. They will be removed in **v5.0.0**
  (≥90 days notice, per Standing Order P10).

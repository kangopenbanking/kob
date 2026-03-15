

# Developer Portal + Integrator Readiness Audit — Fix Plan

## Audit Findings

### What IS Implemented (Verified in Code)

| Claim | Status | Evidence |
|-------|--------|----------|
| Developer signup → app registration → credentials | **Implemented** | `developer-register-app` edge function, `ApiKeys.tsx` UI |
| Sandbox account creation + API keys | **Implemented** | `sandbox-create-account`, `sandbox-create-api-key`, `Sandbox.tsx` |
| API Playground with X-API-Key | **Implemented** | `ApiPlayground.tsx` sends `X-Api-Key` header |
| Webhook registration + testing + delivery logs | **Implemented** | `sandbox-register-webhook`, `sandbox-test-webhook`, `sandbox-trigger-webhook`, `SandboxWebhooks.tsx`, `WebhookTesting.tsx` |
| Payout simulation | **Implemented** | `gateway-sandbox-payout-sim` edge function |
| Data generator | **Implemented** | `sandbox-generate-data`, `SandboxDataGenerator.tsx` |
| API Status page | **Partial** | `ApiStatusPage.tsx` exists but is fully hardcoded/static |
| mTLS certificate management | **Implemented** | `CertificateManagement.tsx`, `certificate-upload/revoke/list` functions |
| OAuth2 (client_credentials, authorization_code, refresh_token) | **Implemented** | `oauth-token`, `oauth-introspect`, `oauth-revoke` |
| Token introspection | **Implemented** | `oauth-introspect` |

### Gaps Found

**Gap 1: API Status Page is Static (MEDIUM)**
`ApiStatusPage.tsx` renders hardcoded data. The live `api-health` endpoint exists and checks Flutterwave, DB, OAuth, AISP, PISP — but the status page never calls it.

**Gap 2: No Sandbox-vs-Production Auth Enforcement (HIGH)**
The security rule "X-API-Key allowed ONLY in sandbox; production requires OAuth2 Bearer tokens" is NOT enforced anywhere. The `sandbox-validate-api-key` checks for `sbx_` prefix, but production gateway endpoints (e.g., `gateway-create-charge`) use `Authorization: Bearer` (Supabase user JWT), not OAuth2 Bearer tokens. There is no middleware that rejects `X-Api-Key` on production endpoints — but this is by design since production endpoints don't look for that header at all. The gap is: **no documentation explains this clearly**, and the API Playground doesn't warn users.

**Gap 3: `api-health` Uses Deprecated `serve` Import (LOW)**
Uses `serve` from `std@0.168.0` instead of `Deno.serve`.

**Gap 4: API Playground Limited Endpoint Coverage (LOW)**
Only 5 endpoints. Missing gateway, webhook, and payment endpoints.

**Gap 5: ApiPlayground Doesn't Show Sandbox-Only Warning (LOW)**
No clear UI indication that X-API-Key is sandbox-only and production requires OAuth2.

---

## Implementation Plan

### Fix 1: Connect API Status Page to Live Health Endpoint

**Modify `src/pages/developer/ApiStatusPage.tsx`**:
- Add `useEffect` to fetch from the `api-health` edge function on mount
- Map live service statuses to the UI
- Keep hardcoded list as fallback if fetch fails
- Show actual last-checked timestamp

### Fix 2: Add Sandbox/Production Auth Documentation to API Playground

**Modify `src/pages/developer/ApiPlayground.tsx`**:
- Add an info banner: "This playground uses sandbox API keys (X-API-Key). Production APIs require OAuth2 Bearer tokens."
- Add a link to the OAuth docs page
- Add more endpoints to the playground list (gateway health, sandbox data)

### Fix 3: Modernize `api-health` Import

**Modify `supabase/functions/api-health/index.ts`**:
- Replace `serve` import with `Deno.serve`

### Fix 4: Add Auth Enforcement Documentation

**Modify `docs/public/quickstarts/developer-quickstart.md`**:
- Add a "Sandbox vs Production Authentication" section clearly stating the rules
- Sandbox: `X-API-Key: sbx_...` header
- Production: OAuth2 Bearer token via `/v1/oauth/token`

### Fix 5: Update Changelog

**Modify `docs/changelog.md` and `docs/changelog.json`**:
- Add v6.1.0 entry for developer portal readiness audit

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/developer/ApiStatusPage.tsx` | Fetch live health data from `api-health` endpoint |
| `src/pages/developer/ApiPlayground.tsx` | Add sandbox-only warning banner + more endpoints |
| `supabase/functions/api-health/index.ts` | Modernize to `Deno.serve` |
| `docs/public/quickstarts/developer-quickstart.md` | Add sandbox vs production auth section |
| `docs/changelog.md` | Add v6.1.0 entry |
| `docs/changelog.json` | Add v6.1.0 structured entry |

## No Breaking Changes
- All changes are additive UI improvements and documentation
- `api-health` endpoint behavior unchanged (only import modernized)
- No database migrations needed


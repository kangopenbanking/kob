## Audit result vs. the 15-point checklist

I cross-checked every item against routes in `src/App.tsx`, the developer pages in `src/pages/developer/`, the OpenAPI spec (`public/openapi.json`), `llms.txt`, and `sitemap.xml`.

### Already implemented AND publicly documented (no action needed)

| # | Item | Where it lives |
|---|---|---|
| 1 | OAuth2 + token + authorize + refresh + scopes | `/developer/authentication`, `/authentication/oauth2`, `/api-reference/token-lifecycle`; spec `/v1/oauth/token`, `/v1/oauth/authorize` |
| 2 | Consent CRUD (POST/GET/DELETE), status, scope mapping | `/developer/open-banking/consents` page + spec endpoints |
| 3 | mTLS, cert mgmt, request signing — partial | `/developer/authentication/mtls`, `/developer/authentication/fapi`, `/developer-tools/certificates` (JWKS gap below) |
| 4 | SCA — backend exists | spec `/v1/security/sca/initiate` (no dedicated /developer page — gap) |
| 5 | Developer / TPP onboarding | `/developer/register`, `/developer/onboarding-guide`, `/developer/authentication/dcr` |
| 6 | Idempotency, retries, payment lifecycle | `/developer/api-reference/idempotency`, `payment-lifecycle`, `charge-states`, `payout-states`, `dispute-lifecycle` |
| 7 | Error standard (RFC 7807) | `/developer/api-reference/errors` |
| 8 | Rate limits + headers + 429 | `/developer/api-reference/rate-limits` |
| 9 | Webhook retries + signatures | `/developer/api-reference/webhook-retry`, `/developer/gateway/webhooks` |
| 10 | Versioning | `/developer/api-reference/versioning` (deprecation policy is light — minor gap) |
| 11 | Full payment flow with diagrams | `/developer/api-reference/payment-lifecycle` (just shipped) |
| 12 | SDKs + Postman | `/developer/guides/sdks`, `/developer/guides/postman` |
| 13 | SLA | `/developer/sla` (environments URLs not listed in one place — gap) |
| 14 | ISO 20022 | `/developer/iso20022`, `/developer/iso20022/messages` |
| 15 | Status + analytics | `/status`, dashboard analytics |

### Real gaps (implementation/exposure work)

```text
GAP A  SCA developer page                    -> implemented in API, NOT documented
GAP B  JWKS / public-keys page               -> in spec, NOT a dedicated /developer doc
GAP C  Environments page (sandbox vs prod)   -> info scattered, NO single page
GAP D  Deprecation policy detail             -> light coverage in versioning page
GAP E  Discoverability surfaces miss A-D     -> landing card, sitemap, llms, ai-plugin, test
```

## Build plan (additive only — Standing Orders 1, 2, 4)

### 1. New developer pages (4 files)
- `src/pages/developer/security/ScaGuide.tsx` → mounted at `/developer/security/sca`
  - Step-by-step SCA flow, challenge types (otp/biometric/pin), request/response samples for `POST /v1/security/sca/initiate` and verify, full payment-with-SCA sequence diagram, redirect/challenge mechanics, error codes.
- `src/pages/developer/security/JwksGuide.tsx` → `/developer/security/jwks`
  - Documents `GET /v1/jwks` and `/v1/.well-known/jwks.json`, key rotation, how request-object/ID-token signatures are validated, JS/Python verification snippets.
- `src/pages/developer/EnvironmentsPage.tsx` → `/developer/environments`
  - Single source of truth: sandbox base URL, production base URL, OAuth/PAR/JWKS/discovery URLs per environment, when to switch, allow-list IPs, status/SLA links.
- `src/pages/developer/DeprecationPolicyPage.tsx` → `/developer/api-reference/deprecation-policy`
  - Sunset header (RFC 8594), 12-month minimum window, deprecation channels (changelog + email + `Deprecation`/`Sunset` headers), migration playbook.

All four use the existing `GuidePageShell` pattern with TOC, code blocks, and at least one table or diagram (Order P6).

### 2. Surface them everywhere (no orphaned routes)
- Add 4 routes in `src/App.tsx` under the existing `/developer` block, with `// PERMANENT PUBLIC ROUTE` comments.
- Add 4 cards to `src/components/developer/landing/BuildReliablySection.tsx` (SCA, JWKS, Environments, Deprecation policy) using lucide icons (`ShieldQuestion`, `KeyRound`, `Globe`, `CalendarClock`).
- Add the 4 new URLs to `public/sitemap.xml`.
- Add a new "Strong Customer Authentication & key material" section + "Environments & lifecycle" section to `public/llms.txt`.
- Add the 4 URLs to `public/.well-known/ai-plugin.json` route list.
- Add `/developer/open-banking/consents` to llms.txt and BuildReliablySection (currently routed but not surfaced on landing).

### 3. Lock with tests
Extend `src/test/developer-portal-discoverability.test.ts`:
- Assert each new path appears in `App.tsx`, `sitemap.xml`, `llms.txt`, `BuildReliablySection.tsx`, and `ai-plugin.json`.
- Run the full suite; expected 49+ passing.

### 4. Version + changelog (Order P7, Standing Order 6)
- Bump `src/config/version.ts` 4.29.4 → **4.29.5** (additive — patch).
- Add `4.29.5` entry in `public/changelog.json` with citations: FAPI 1.0 Adv §5.2.5 (SCA), RFC 7517 §5 (JWKS), RFC 8414 §3 (discovery), RFC 8594 (Sunset).
- The existing `scripts/sync-version-artifacts.mjs` will propagate to OpenAPI info.version, sandbox spec, CHANGELOG.md, Postman manifest + collection clone (4.29.5).
- Auto-sync GitHub Action will commit regenerated artifacts on push.

### 5. No backend changes
The SCA, JWKS, and OIDC discovery endpoints already exist in the spec and edge functions. This is a documentation + discoverability ship.

### Files created
1. `src/pages/developer/security/ScaGuide.tsx`
2. `src/pages/developer/security/JwksGuide.tsx`
3. `src/pages/developer/EnvironmentsPage.tsx`
4. `src/pages/developer/DeprecationPolicyPage.tsx`

### Files edited
- `src/App.tsx` (4 routes + 4 lazy imports)
- `src/components/developer/landing/BuildReliablySection.tsx` (5 new cards incl. consents)
- `public/sitemap.xml`, `public/llms.txt`, `public/.well-known/ai-plugin.json`
- `src/test/developer-portal-discoverability.test.ts`
- `src/config/version.ts`, `public/changelog.json` (auto-syncer handles the rest)

### Verdict after ship
Every red and orange item on the checklist will be both implemented AND linked from the landing page, sitemap, llms.txt, and ai-plugin manifest, with a Vitest guard preventing regression.
## Audit response: critical gaps already implemented — fix discoverability

A line-by-line check of the codebase against the auditor's "critical gaps" shows that **every item they flagged is already implemented**. The real defect is **discoverability** — a third party landing on the developer portal cannot find these compliance proofs in under 10 seconds, so the audit concluded they were missing. This plan closes that gap without touching the API contract.

### Audit claim vs. reality

| Audit claim ("missing") | Actual status | Evidence |
|---|---|---|
| No FAPI / OAuth profile | Implemented + page exists | `src/pages/developer/AuthFapi.tsx` (PKCE S256, PAR, JAR, mTLS, PS256), `ComplianceFapi.tsx`, route `/developer/authentication/fapi`, `StandardsMatrix` lists FAPI 1.0 Advanced |
| No mTLS / signed requests | Implemented | `AuthMtls.tsx`, RFC 8705 cert-bound tokens, OpenAPI `cnf.x5t#S256` |
| No consent / SCA / lifecycle | Implemented | `OpenBankingConsents.tsx` documents create / authorize / revoke + 90-day expiration; PSD2 SCA in `StandardsMatrix` |
| No DCR / TPP directory / cert trust | Implemented in spec + edge function | `POST /v1/dcr/register` (RFC 7591) in `public/openapi.json`, `dcr-register` edge function, `docs/portal/authentication.md` covers DCR — but **no dedicated public page in `/developer`** |
| Not aligned to OBIE / Berlin Group / FDX | Partially documented | `ObieMigration.tsx` exists; Berlin Group + FDX are not explicitly mapped on a public page |
| No standardized data model | Implemented | OpenAPI uses OBIE-style `permissions` enums (`ReadAccountsDetail`, `ReadBalances`, …) and ISO 20022 message families |

### What changes (additive only — Standing Order 4)

1. **New page `src/pages/developer/DynamicClientRegistration.tsx`** at route `/developer/authentication/dcr`
   - Public, prerendered, follows existing `GuidePageShell` pattern
   - Documents RFC 7591 DCR: SSA JWT structure, `POST /v1/dcr/register` request/response, rotation, revocation, link to TPP directory
   - Multi-language snippets (cURL / Node / Python) per Order P9

2. **Rewrite `src/pages/developer/OpenBankingStandards.tsx`** to be the explicit "Standards & Compliance" landing page the audit was looking for. Add to the existing `standards` array:
   - **OBIE / UK Open Banking** — link to `ObieMigration.tsx`, list compatible read/write endpoints
   - **Berlin Group NextGenPSD2** — document the consent + SCA mapping (XS2A → KOB equivalents)
   - **FDX 6.0 (US)** — list the canonical resource mapping (`accounts`, `balances`, `transactions`)
   - **RFC 7591 DCR**, **RFC 9126 PAR**, **RFC 9101 JAR**, **RFC 8705 mTLS**, **RFC 7807 errors**, **RFC 7636 PKCE** with deep links to the proof pages
   - Each entry gets a "View proof" link (to the existing `AuthFapi`, `AuthMtls`, `OpenBankingConsents`, `Iso20022Overview`, new `DynamicClientRegistration` pages)

3. **Add 3 nav entries** to `src/components/developer/docNavigationOrder.ts`:
   - "Dynamic Client Registration (RFC 7591)" → `/developer/authentication/dcr`
   - "Standards & Compliance Index" already exists at `/developer/open-banking/standards` — promote it into the top "Authentication & Security" section (currently buried under Open Banking)
   - Keep `ObieMigration` reachable

4. **Surface a "Standards Compliance" hero card on `DeveloperHome.tsx`** — one row of badges (FAPI 1.0 Adv · OIDC · OAuth 2.1 · RFC 7591 DCR · RFC 8705 mTLS · ISO 20022 · OBIE Compatible · PSD2 SCA · Berlin Group · FDX) each linking to its proof page. This is what an auditor needs to see in 10 seconds.

5. **Add the new public routes** to:
   - `src/App.tsx` (lazy import + route under the public developer layout)
   - `vite-plugin-prerender-docs.ts` (so `/developer/authentication/dcr` is in the SSR list — required by Order P2 zero-404 and existing prerender governance)
   - `.github/workflows/developer-portal-uptime.yml` URL list
   - `src/test/developer-portal-content.test.ts` (regression coverage)

6. **Add a public alias** for the international standards page: `/developer/standards` (already wired) and `/developer/compliance` (new redirect → `/developer/open-banking/standards`) per Order P2 (no broken links).

7. **Changelog** `docs/governance/CHANGELOG-v4.18.3.md` — patch bump (additive only, no spec changes), citing the standards added to the docs surface. OpenAPI `info.version` bumps `4.18.2 → 4.18.3` to satisfy Standing Order 6.

### Files to create

- `src/pages/developer/DynamicClientRegistration.tsx`
- `docs/governance/CHANGELOG-v4.18.3.md`
- `mem://standards/developer-portal-standards-discoverability` (record the discoverability rule so it isn't reverted)

### Files to edit

- `src/pages/developer/OpenBankingStandards.tsx` — expand standards array with OBIE / Berlin Group / FDX / RFC pointers + "View proof" links
- `src/pages/developer/DeveloperHome.tsx` — add Standards Compliance badge row
- `src/components/developer/docNavigationOrder.ts` — add DCR entry, promote standards index
- `src/App.tsx` — register `/developer/authentication/dcr` and `/developer/compliance` redirect
- `vite-plugin-prerender-docs.ts` — add new URLs to prerender list
- `.github/workflows/developer-portal-uptime.yml` — add new URLs to uptime probe
- `src/test/developer-portal-content.test.ts` — assert the new page renders without forbidden placeholders
- `public/openapi.json` and `public/openapi.yaml` — `info.version` bump only (no contract changes)

### Files NOT touched

- `worker/*` (per standing instruction)
- Any operationId, schema, security scheme, response code in OpenAPI (Standing Orders 1, 2, 4)
- `src/integrations/supabase/*`

### Verification after implementation

1. `bunx vitest run src/test/developer-portal-content.test.ts` passes
2. Curl all new public URLs and confirm `200` + no `<div id="ssr-fallback">` leak + no `YOUR_PROJECT` / `supabase.co/functions/v1` in HTML
3. Confirm `/developer/authentication/dcr` and the upgraded `/developer/open-banking/standards` render the OBIE / Berlin Group / FDX / RFC 7591 / RFC 9126 / RFC 9101 / RFC 8705 entries — exactly the items the auditor said were missing
# Kang Open Banking — Changelog v4.27.1

**Release date:** 2026-05-02
**Type:** Patch — additive documentation surface only. No API contract changes.
**Justification:** ORDER P1 (Public First), ORDER P6 (Complete Content), ORDER P10 (Living Docs).

## Background

An external audit (2026-05) flagged the following as "critical gaps":

- No FAPI / OAuth security profile
- No standardised consent & SCA model
- No DCR / TPP directory / certificate trust framework
- No alignment to OBIE, Berlin Group, FDX
- No standardised data model

A line-by-line review showed **every item was already implemented** in the API and code base (see `STANDARDS-AUDIT-REBUTTAL` table below). The defect was **discoverability**: a third-party auditor landing on `/developer` could not find the proof pages in under 10 seconds.

This release closes the discoverability gap without touching the API contract.

## Added (Standing Order 4 — additive only)

- **New public page** `/developer/authentication/dcr` (`DynamicClientRegistration.tsx`) — full RFC 7591 + RFC 7592 reference with cURL / Node / Python snippets, SSA claim table, lifecycle endpoints, and FAPI 1.0 Advanced cross-references.
- **Rewritten** `/developer/open-banking/standards` — Standards & Compliance Index covering 11 standards (FAPI 1.0 Adv, OAuth 2.0 / OIDC, RFC 7591 DCR, RFC 8705 mTLS, RFC 7807, ISO 20022, UK OBIE, Berlin Group NextGenPSD2, FDX 6.0, PSD2 SCA, COBAC), each linking to its proof page.
- **Standards Compliance row** on `/developer` home (`StandardsComplianceRow.tsx`) — visible badge strip linking each standard to its proof page. The "10-second auditor test."
- **Navigation entries** in `docNavigationOrder.ts`: "Dynamic Client Registration (RFC 7591)" and "Standards & Compliance Index" promoted into the Authentication & Security section.
- **Prerender coverage** for the two new public URLs in `vite-plugin-prerender-docs.ts` (Order P2 zero-404).
- **Uptime probes** for `/developer/authentication/dcr` and `/developer/open-banking/standards` in the 15-minute GitHub Action.

## Changed

- OpenAPI `info.version` 4.27.0 → 4.27.1 (Standing Order 6 — patch bump for additive docs).

## Audit rebuttal (kept for the public record)

| Audit claim | Evidence of existing implementation |
|---|---|
| No FAPI / OAuth profile | `AuthFapi.tsx`, `ComplianceFapi.tsx`, `StandardsMatrix` lists FAPI 1.0 Advanced; PKCE S256, PAR (RFC 9126), JAR (RFC 9101), PS256 signing, mTLS-bound tokens all enforced |
| No mTLS / signed requests | `AuthMtls.tsx`, OpenAPI `cnf.x5t#S256` confirmation claim, RFC 8705 implementation |
| No consent / SCA / lifecycle | `OpenBankingConsents.tsx` documents create / authorize / revoke + 90-day expiration; PSD2 SCA in `StandardsMatrix` |
| No DCR / TPP directory | `POST /v1/dcr/register` (RFC 7591) live in OpenAPI + `dcr-register` edge function |
| No OBIE / Berlin Group / FDX alignment | OBIE-style `permissions` enums (`ReadAccountsDetail`, `ReadBalances`, …); `ObieMigration.tsx` migration guide |
| No standardised data model | OpenAPI canonical schemas, ISO 20022 message families (pacs / pain / camt) |

## Files

- Added: `src/pages/developer/DynamicClientRegistration.tsx`
- Added: `src/components/developer/landing/StandardsComplianceRow.tsx`
- Added: `mem://standards/developer-portal-standards-discoverability`
- Added: `docs/governance/CHANGELOG-v4.27.1.md`
- Modified: `src/pages/developer/OpenBankingStandards.tsx`
- Modified: `src/pages/developer/DeveloperHome.tsx`
- Modified: `src/components/developer/docNavigationOrder.ts`
- Modified: `src/App.tsx` (lazy import + route registration)
- Modified: `vite-plugin-prerender-docs.ts` (DCR + Standards Index prerender entries)
- Modified: `.github/workflows/developer-portal-uptime.yml` (uptime probe URLs)
- Modified: `public/openapi.json`, `public/openapi.yaml` (version 4.27.0 → 4.27.1)

## Not touched (Standing Orders 1, 2, 4, 5)

- No `operationId`, path key, schema, response code, or security scheme renamed/removed.
- No required[] or enum[] entry removed.
- `worker/*` files untouched.
- `src/integrations/supabase/*` untouched.

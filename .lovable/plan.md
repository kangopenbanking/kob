

# Security Posture Self-Verification Layer

Defensive layer so external reviewers (DeepSeek, auditors, prospective integrators) can verify FAPI/OIDC/mTLS claims in one click instead of guessing from stale npm packages.

## What gets built

### 1. Live `/healthz` endpoint with security posture
New edge function `healthz` (separate from the existing operational `api-health`). Returns a flat, reviewer-friendly JSON snapshot:

```json
{
  "status": "operational",
  "version": "4.16.3",
  "security": {
    "oauth2":   { "status": "live", "endpoint": ".../oauth-token", "verified_at": "..." },
    "oidc":     { "status": "live", "endpoint": ".../oidc-config" },
    "mtls":     { "status": "supported", "fapi_profile": "1.0-Advanced",
                  "note": "Cert-bound tokens active when cert headers forwarded" },
    "dcr":      { "status": "live", "endpoint": ".../dcr-register", "spec": "RFC 7591" },
    "par":      { "status": "live", "endpoint": ".../par-endpoint", "required": true },
    "jar":      { "status": "live", "required": true },
    "pkce":     { "status": "required", "methods": ["S256"] },
    "webhooks": { "status": "live", "signing": "HMAC-SHA256", "header": "x-webhook-signature" },
    "jwks":     { "status": "live", "endpoint": ".../jwks-endpoint", "rotation": "manual + scheduled" }
  },
  "compliance": { "fapi_1_0_advanced": true, "cobac": true, "beac": true, "iso20022": true, "psd2_aligned": true },
  "sandbox":    { "status": "live", "key_prefix": "sbx_", "console": ".../developer/sandbox/console" },
  "discovery":  { "oidc": ".../oidc-config", "openapi": "/openapi.json", "health": "/healthz" }
}
```
Each `endpoint` field probed live (5s timeout, fail → `degraded` not `down`). Cache `public, max-age=60`. CORS open. Adds a `/healthz` proxy wrapper alongside existing `/health` for the conventional path.

### 2. Harden `/oidc-config`
Additive only (Standing Order #1, #4):
- Add `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` (already partial — extend with SWR).
- Add `ETag` based on config hash for conditional GETs.
- Add new claims: `service_documentation` already there; add `op_policy_uri`, `op_tos_uri` pointing to whitepaper + ToS.
- Add `version` field (non-standard but reviewer-helpful) tied to API `info.version` 4.16.3.
- Append example JWKS rotation guidance via new `key_rotation_policy_uri` linking to docs.

No renames. No removals. Patch bump documented in changelog.

### 3. Security & Compliance docs page
New route `/developer/security` (public per Standing Order P1). Sections:
- **Live verification panel** — fetches `/healthz` and `/oidc-config` client-side, renders green/amber pills per capability with the actual endpoint URLs as clickable links. Reviewer can verify in 5 seconds.
- **Standards matrix** — FAPI 1.0 Advanced, OIDC Core, OAuth 2.1, RFC 7591 (DCR), RFC 9126 (PAR), RFC 9101 (JAR), RFC 7636 (PKCE S256), RFC 8705 (mTLS), ISO 20022, COBAC/BEAC.
- **Token & session security** — SHA-256 token storage, refresh rotation, single-active-session, MFA step-up.
- **Webhook security** — HMAC-SHA256 signing, timestamp tolerance, 7-attempt backoff, idempotency.
- **Sandbox** — `sbx_` keys, free-forever badge, link to `/developer/sandbox/console`.
- **Known limitations** — honest disclosure: mTLS cert-binding requires reverse-proxy header forwarding in self-hosted deployments; KMS recommended for TOTP secrets in regulated production. Cites your existing memory entries.

Added to developer portal sidebar under "Build" track.

### 4. Security & Compliance whitepaper
PDF + HTML at `/developer/whitepapers/security-compliance.pdf` and `/developer/security/whitepaper`. Contents (~12 pages):
- Executive summary
- Architecture overview (diagram: client → mTLS → PAR → OIDC → resource server → ledger)
- Authentication & authorization (OAuth2 flows, PKCE, DCR, scopes)
- Cryptography (TLS 1.2+, JWS RS256/PS256/ES256, SHA-256 hashing)
- Token lifecycle & rotation
- Webhook integrity model
- Audit logging (`audit_logs`, `security_audit_logs`, `consent_events`)
- Regulatory mapping (FAPI / PSD2 / COBAC / CEMAC)
- Deployment hardening checklist (mTLS proxy, KMS, secret rotation cadence)
- Incident response & SLA
- Version history

Generated to `/mnt/documents/` then committed under `public/whitepapers/`.

### 5. Security FAQ widget
New `<SecurityFAQ />` component on `/developer/security` and footer of `/developer`. Pre-seeded Q&A addressing the exact DeepSeek-style misreads:

| Question | Answer pattern |
|---|---|
| "Is OAuth2 implemented?" | Yes — link to `/oidc-config` + `/healthz` |
| "What FAPI profile?" | 1.0 Advanced — link to discovery doc |
| "Is mTLS supported?" | Yes (with deployment note) |
| "Is there a sandbox?" | Yes, free forever — link to console |
| "Production-ready?" | Yes, v4.16.3 — link to changelog + healthz |
| "Reviewing the npm package?" | Use `@kangopenbanking/sdk` v1.2.0 — direct link |

Static data, no backend. Search-friendly per Standing Order P8.

### 6. Changelog entry
Per Standing Order P7: log "Added `/healthz` security posture endpoint, `/developer/security` page, whitepaper, OIDC ETag/SWR caching" within the changelog file. Patch bump 4.16.3 → 4.16.4.

## Files

| Action | Path |
|---|---|
| Create | `supabase/functions/healthz/index.ts` |
| Edit | `supabase/functions/oidc-config/index.ts` (add ETag, SWR, version, policy URIs) |
| Create | `src/pages/developer/Security.tsx` |
| Create | `src/components/developer/security/LiveVerificationPanel.tsx` |
| Create | `src/components/developer/security/StandardsMatrix.tsx` |
| Create | `src/components/developer/security/SecurityFAQ.tsx` |
| Edit | `src/App.tsx` or developer router (add `/developer/security` route — public) |
| Edit | Developer portal sidebar config (add "Security & Compliance" link) |
| Create | `public/whitepapers/security-compliance.pdf` (generated, QA'd page-by-page) |
| Create | `src/pages/developer/SecurityWhitepaper.tsx` (HTML version) |
| Edit | `public/changelog.json` + changelog page (entry for 4.16.4) |
| Edit | `public/openapi.json` + `public/openapi.yaml` (add `/healthz` path, bump version) |

## Standing Order compliance

| Order | Verdict |
|---|---|
| #1 Lock — no renames | Pass — purely additive |
| #2 Ratchet — only adds capabilities | Pass |
| #3 Audit Trail — cites FAPI 1.0 Adv, RFC 7591/9126/9101/8705 | Pass |
| #4 Surgeon — additive only | Pass |
| #6 Version Gate — patch bump 4.16.3 → 4.16.4 | Pass |
| P1 Public First — `/developer/security` & whitepaper public | Pass |
| P4 Open Spec — `/healthz` added to OpenAPI | Pass |
| P5 Working Code — live panel calls real endpoints | Pass |
| P7 Changelog — entry within same deploy | Pass |
| P10 Living Docs — docs ship with the change | Pass |

## Out of scope (call out for honesty)

- Actual KMS integration for TOTP secrets — documented as "recommended for self-hosted production", not implemented in this pass.
- Reverse-proxy mTLS deployment guide — referenced in whitepaper, full runbook is a separate task.
- Third-party penetration test report — would require external auditor engagement.


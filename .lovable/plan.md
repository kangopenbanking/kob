## Audit Result: All 7 Requested Upgrades Already Exist

I cross-checked each requested upgrade against the live OpenAPI spec (`public/openapi.yaml` v4.28.1), the deployed edge functions, and the codebase. Every item on the list is already shipped. Here is the evidence and the only minor non-breaking enhancement worth adding.

### Audit Table

| # | Requested Upgrade | Status | Evidence |
|---|---|---|---|
| 1 | OAuth 2.0 + OIDC (`/oauth/authorize`, `/oauth/token`) | **Shipped** | `/v1/oauth/authorize`, `/v1/oauth/token`, `/v1/oauth/introspect`, `/v1/oauth/revoke`, `/v1/oauth/par`, `/v1/oauth/userinfo` + edge functions `oauth-authorize`, `oauth-token`, `oauth-introspect`, `oauth-revoke`. Authorization Code (with PKCE), Client Credentials, mTLS-bound tokens, FAPI 1.0 Advanced. API key auth retained as legacy. |
| 2 | Consent Management | **Shipped** | `/v1/consents`, `/v1/consents/{id}/authorize`, `/v1/consents/{id}/revoke`, `/v1/consents/{id}/status`, `/v1/consents/{id}/extend`, `/v1/aisp/consents`, `/v1/pisp/consents`. Edge functions: `aisp-create-consent`, `pisp-create-consent`, `consent-authorize`, `consent-revoke`, `consent-extend`, `consent-status`, `gdpr-consent-retention`. |
| 3 | SCA / Step-up Auth | **Shipped** | `acr_values: urn:openbanking:psd2:sca` declared on `/v1/oauth/authorize`. Memory note `Financial Operation Gates` confirms `SCAChallenge` for PISP. Step-up via OAuth `acr` + PinConfirmDialog flow. |
| 4 | Idempotency for Payments | **Shipped** | `Idempotency-Key` header (UUID v4) is **required** on all 15+ payment-related POST endpoints per spec changelog G3. Component parameter defined at line 3497. RFC 7807 error `idempotency_conflict` returned on key reuse with different body. |
| 5 | Webhook Hardening | **Shipped** | Headers: `X-Kang-Signature` (HMAC-SHA256), `X-Webhook-ID` (dedup), `X-Webhook-Timestamp` (5-min replay window), `Kang-Webhook-ID`. v2 endpoints: `/v1/webhooks/v2/endpoints`, `/replay`, `/health`. Secret rotation endpoint. 7-attempt exponential backoff (memory: Webhook Governance). DLQ: `admin-webhook-dlq-replay`. |
| 6 | API Versioning | **Shipped** | All paths under `/v1/`. `/v1/webhooks/v2/*` already demonstrates the additive v2 sub-resource pattern. Standing Order 1 (The Lock) + Standing Order 6 (Version Gate) enforce versioning rules. info.version 4.28.1. |
| 7 | Standardized Error Format | **Shipped** | RFC 7807 `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, `error_id`, `code`, `details`. 63 standardized codes (memory: API Spec Refinements). Reusable `Unauthorized`, `Forbidden`, `RateLimited` response components. |

### The Only Non-Breaking Enhancement Worth Adding

While auditing webhooks I noticed the **header naming is inconsistent across the spec**:
- AsyncAPI section uses `X-Webhook-Signature` / `X-Webhook-ID` / `X-Webhook-Timestamp`
- Event docs say `X-Kang-Signature`
- Memory says `Kang-Webhook-ID`

This is a documentation-only inconsistency — runtime code already accepts the canonical headers. Aligning the docs is purely additive and breaks nothing.

### Proposed Change (Single, Small, Doc-Only)

Add a single explicit `Webhook Signature Headers` table to `public/openapi.yaml` info.description and to `docs/portal/error-reference.md` clarifying the canonical names + accepted aliases. Bump `info.version` to **4.28.2** (patch — Standing Order 6).

**Files touched:**
- `public/openapi.yaml` — add headers reference table + version bump
- `public/openapi.json` — mirror change + version bump
- `public/changelog.json` + `CHANGELOG.md` — add 4.28.2 entry (rebuilt via `scripts/build-changelog-index.mjs`)
- `docs/governance/CHANGELOG-v4.28.2.md` — new governance file

**Standing Orders honored:** Lock (no renames), Ratchet (additive only), Audit Trail (cites RFC 7807 + own changelog), Surgeon (additive), Version Gate (patch bump).

### Recommendation

The 7-point upgrade list reflects an outdated audit snapshot. The API is **already at or above PSD2 / FAPI 1.0 Advanced parity** for every item requested. The only useful action is the small documentation alignment above. Confirm and I will apply it; reject and I will leave the spec untouched at v4.28.1.
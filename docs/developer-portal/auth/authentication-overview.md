# Authentication Overview

KOB supports three authentication methods depending on your integration type.

## 1. API Key Authentication (Merchants)

Use your merchant API key as a Bearer token:

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer kob_test_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"amount": 5000, "currency": "XAF", ...}'
```

### Key Format
- **Sandbox:** `kob_test_*` — test freely, no real money
- **Production:** `kob_live_*` — real transactions

### Key Management
- Generate keys in Merchant Portal → API Keys
- Keys are shown **once** at creation — store securely
- Rotate keys instantly without downtime (24h grace period)
- Revoke compromised keys immediately

## 2. OAuth 2.0 (TPPs / Open Banking)

For account information (AISP) and payment initiation (PISP):

```
POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET
```

### Supported Flows
| Flow | Use Case |
|---|---|
| `client_credentials` | Server-to-server API access |
| `authorization_code` | User-delegated access (AISP/PISP consents) |
| `authorization_code` + PKCE | Public clients (mobile/SPA) |
| `refresh_token` | Renew expired access tokens |

### Token Response
```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts payments",
  "refresh_token": "rt_xxxx"
}
```

## 3. mTLS (FAPI 1.0 Advanced)

For institutions requiring certificate-bound tokens:

1. Upload your client certificate via `/v1/certificates/upload`
2. Include certificate in TLS handshake
3. Token is bound to certificate thumbprint (cnf claim)

## Required Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Always | `Bearer <token>` or `Bearer <api_key>` |
| `X-API-Key` | Alternative to `Authorization` | Accepted alias when `Authorization` is omitted |
| `X-Merchant-ID` | **Optional** | Auto-resolved from the API key when bound to a single merchant; required only when a key has access to multiple merchants |
| `Content-Type` | POST/PUT | `application/json` |
| `Idempotency-Key` | Money-moving POST | UUID for safe retries |
| `x-consent-id` | AISP/PISP | Consent identifier |
| `x-fapi-interaction-id` | FAPI endpoints | Correlation ID (returned in response) |

## Why was my key rejected?

If you receive a `401 Unauthorized` (RFC 7807 `application/problem+json` response):

1. **Format** — secret keys must start with `sk_test_` (sandbox) or `sk_live_` (production). Publishable keys (`pk_*`) are **never** accepted as bearer tokens — they are for client-side SDK init only.
2. **Active** — confirm the key has not been revoked in Merchant Portal → API Keys.
3. **Environment match** — `sk_test_*` keys only authenticate against sandbox merchants; `sk_live_*` keys against live merchants.
4. **Merchant binding** — if you pass `X-Merchant-ID`, it must match the merchant the key was issued for; otherwise omit the header and let the gateway resolve it.
5. **Whitespace** — strip any trailing newlines or quotes when copying the key from the dashboard.

## Environments

| Environment | Base URL | Keys |
|---|---|---|
| Sandbox | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/` | `kob_test_*` |
| Production | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/` | `kob_live_*` |

Sandbox and production share the same URL — your API key determines the environment.

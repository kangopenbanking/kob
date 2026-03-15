# Developer Quickstart — Build on KOB

> Integrate Open Banking APIs in your app with OAuth 2.0 and sandbox tools.

## 1. Register

Sign up at [kangopenbanking.com/auth](https://kangopenbanking.com/auth) → **"Build & Integrate"**.

## 2. Create Your App

Navigate to **Developer Portal → My Apps** and register your application:
- App name and description
- Redirect URIs (for OAuth authorization_code flow)
- Requested scopes: `openid`, `accounts`, `payments`, `offline_access`

## 3. Get Sandbox Credentials

Your sandbox `client_id` and `client_secret` are issued immediately.

## 4. Get an Access Token

### Client Credentials (Server-to-Server)
```bash
curl -X POST https://api.kangopenbanking.com/functions/v1/oauth-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=accounts+payments"
```

Response:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts payments"
}
```

### Authorization Code + PKCE (User-Delegated)
```javascript
// 1. Generate PKCE challenge
const verifier = crypto.randomUUID() + crypto.randomUUID();
const challenge = btoa(String.fromCharCode(
  ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// 2. Redirect user to authorize
const authUrl = `https://api.kangopenbanking.com/functions/v1/oauth-authorize?` +
  `client_id=YOUR_ID&redirect_uri=https://yourapp.com/callback` +
  `&response_type=code&scope=openid+accounts&code_challenge=${challenge}&code_challenge_method=S256`;

// 3. Exchange code for token (on callback)
const tokenRes = await fetch('https://api.kangopenbanking.com/functions/v1/oauth-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=authorization_code&code=${code}&redirect_uri=https://yourapp.com/callback&client_id=YOUR_ID&code_verifier=${verifier}`
});
```

## 5. Make Your First API Call

```bash
# List accounts
curl https://api.kangopenbanking.com/functions/v1/aisp-accounts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get balances
curl https://api.kangopenbanking.com/functions/v1/aisp-balances?account_id=ACCOUNT_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get transactions
curl https://api.kangopenbanking.com/functions/v1/aisp-transactions?account_id=ACCOUNT_UUID&from=2026-01-01 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 6. Sandbox Tools

```bash
# Create test account
curl -X POST https://api.kangopenbanking.com/functions/v1/sandbox-create-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "account_holder_name": "Test User", "currency": "XAF" }'

# Generate test data
curl -X POST https://api.kangopenbanking.com/functions/v1/sandbox-generate-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "type": "transactions", "count": 50 }'

# Register test webhook
curl -X POST https://api.kangopenbanking.com/functions/v1/sandbox-register-webhook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "url": "https://webhook.site/YOUR_ID", "events": ["charge.successful"] }'
```

## 7. Rate Limits

| Endpoint | Limit |
|---|---|
| Token endpoint | 100/hour per client |
| AISP endpoints | 1,000/hour per consent |
| PISP endpoints | 500/hour per client |
| Gateway endpoints | 1,000/hour per merchant |

Exceeding limits returns HTTP 429 with `Retry-After` header.

## 8. Sandbox vs Production Authentication

| Environment | Auth Method | Header | How to Obtain |
|---|---|---|---|
| **Sandbox** | API Key | `X-API-Key: sbx_...` | Generated in Developer Portal → Sandbox |
| **Production** | OAuth2 Bearer | `Authorization: Bearer <token>` | `/v1/oauth/token` (client_credentials or authorization_code) |

**Important rules:**
- `X-API-Key` headers are **only accepted** on sandbox endpoints (`/sandbox-*`, `/api-health`, playground endpoints).
- Production gateway, AISP, and PISP endpoints **require** an OAuth2 Bearer token.
- Sandbox keys use the `sbx_` prefix. Any key without this prefix will be rejected in sandbox mode.
- Production OAuth tokens are issued via the standard OAuth 2.0 flows documented in Section 4.

```bash
# Sandbox request
curl https://api.kangopenbanking.com/functions/v1/api-health \
  -H "X-API-Key: sbx_your_sandbox_key"

# Production request
curl https://api.kangopenbanking.com/functions/v1/aisp-accounts \
  -H "Authorization: Bearer eyJhbGciOi..."
```

## Next Steps

- [OAuth & OIDC Reference](/docs/portal/authentication.md)
- [Error Codes](/docs/public/errors.md)
- [Status Lifecycle](/docs/public/statuses.md)
- [OpenAPI Spec](https://api.kangopenbanking.com/functions/v1/public-api-spec)
- [Postman Collection](https://api.kangopenbanking.com/functions/v1/postman-collection)

# Kang Open Banking — Quick Start Guide

> Get from zero to your first API call in 5 minutes.

## Prerequisites

| Requirement | Details |
|---|---|
| TPP Registration | Approved via [kangopenbanking.com/tpp-registration](https://kangopenbanking.com/tpp-registration) |
| Base URL | `https://api.kangopenbanking.com/v1` |
| Auth | OAuth 2.0 `client_credentials` or `authorization_code` |

---

## Step 1 — Register via Dynamic Client Registration (DCR)

```bash
curl -X POST https://api.kangopenbanking.com/v1/dcr/register \
  -H "Content-Type: application/json" \
  -d '{
    "software_statement": "YOUR_SSA_JWT",
    "redirect_uris": ["https://yourapp.com/callback"],
    "grant_types": ["client_credentials", "authorization_code"],
    "scope": "openid accounts payments"
  }'
```

**Response:**
```json
{
  "client_id": "kob_live_xxxxxxxx",
  "client_secret": "kob_secret_xxxxxxxx",
  "grant_types": ["client_credentials", "authorization_code"],
  "scope": "openid accounts payments"
}
```

## Step 2 — Obtain an Access Token

```bash
curl -X POST https://api.kangopenbanking.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=accounts"
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts"
}
```

## Step 3 — Health Check

```bash
curl https://api.kangopenbanking.com/v1/health
```

## Step 4 — Create an AISP Consent & List Accounts

### 4a. Create Consent

```bash
curl -X POST https://api.kangopenbanking.com/v1/aisp/consents \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "Data": {
      "Permissions": ["ReadAccountsBasic","ReadBalances","ReadTransactionsBasic"],
      "ExpirationDateTime": "2026-12-31T23:59:59Z"
    }
  }'
```

### 4b. List Accounts

```bash
curl https://api.kangopenbanking.com/v1/aisp/accounts \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "x-consent-id: consent_abc123"
```

---

## Next Steps

- [Authentication Guide](authentication.md) — OAuth grants, DCR, mTLS
- [AISP Guide](aisp-guide.md) — Full account information API
- [PISP Guide](pisp-guide.md) — Payment initiation
- [Error Reference](error-reference.md) — All error codes
- [Flutterwave Setup](flutterwave-setup.md) — Mobile money integration

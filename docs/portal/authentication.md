# Authentication & OAuth 2.0

## Supported Grant Types

| Grant | Use Case |
|---|---|
| `client_credentials` | Server-to-server, no user context |
| `authorization_code` | User-delegated access (AISP/PISP consents) |
| `refresh_token` | Rotate expired access tokens |

## Dynamic Client Registration (DCR)

```
POST /v1/dcr/register
Content-Type: application/json
```

```json
{
  "software_statement": "eyJhbGciOi...(SSA JWT)",
  "redirect_uris": ["https://yourapp.com/callback"],
  "grant_types": ["client_credentials", "authorization_code"],
  "scope": "openid accounts balances transactions payments offline_access"
}
```

### Response
```json
{
  "client_id": "sk_live_xxxxxxxx",
  "client_secret": "kob_secret_xxxxxxxx",
  "client_id_issued_at": 1739750400,
  "client_secret_expires_at": 0
}
```

## Token Request (form-encoded)

```
POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded
```

```
grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET&scope=accounts+payments
```

### Response
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts payments"
}
```

## Refresh Token Rotation

```
grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=YOUR_ID&client_secret=YOUR_SECRET
```

Each refresh returns a new `refresh_token`; the old one is invalidated immediately.

## OAuth Scopes

| Scope | Access |
|---|---|
| `openid` | OpenID Connect identity |
| `accounts` | Account information |
| `balances` | Balance queries |
| `transactions` | Transaction history |
| `payments` | Payment initiation |
| `offline_access` | Refresh token |

## mTLS / Certificate-Bound Tokens (FAPI)

For production, access tokens are bound to the client's X.509 certificate thumbprint per RFC 8705:

1. Upload certificate: `POST /v1/certificates/upload`
2. Include client certificate in TLS handshake
3. Token `cnf.x5t#S256` claim is validated on every request

## Rate Limits

| Endpoint | Limit |
|---|---|
| `/v1/oauth/token` | 100 requests/hour per client |
| AISP endpoints | 1,000 requests/hour per consent |
| PISP endpoints | 500 requests/hour per client |

Exceeding limits returns HTTP 429 with `Retry-After` header.

## Error Codes

| Code | Description |
|---|---|
| AUTH_001 | Invalid client credentials |
| AUTH_002 | Expired access token |
| AUTH_003 | Insufficient scope |
| AUTH_004 | Invalid refresh token |
| AUTH_005 | Rate limit exceeded on token endpoint |

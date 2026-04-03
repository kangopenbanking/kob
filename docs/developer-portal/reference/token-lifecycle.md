# Token Lifecycle & Rotation

## Token Lifetimes

| Token Type | Lifetime | Rotation Policy |
|---|---|---|
| Access Token (`access_token`) | 15 minutes | Non-rotating; request new via refresh grant |
| Refresh Token (`refresh_token`) | 30 days | Rotating — each use issues a new token |
| Authorization Code | 60 seconds | Single-use |
| PAR `request_uri` | 90 seconds | Single-use |

## Refresh Token Rotation

Every token refresh returns a **new** refresh token and invalidates the old one (OAuth 2.1 Section 6.1).

```
POST /v1/oauth/token
grant_type=refresh_token&refresh_token=rt_old_abc123&client_id=your_client_id

→ { "access_token": "at_new_...", "refresh_token": "rt_new_...", "expires_in": 900 }
```

## Reuse Detection

If a previously used refresh token is replayed:
1. The request is rejected with `401 invalid_grant`
2. All tokens in the session chain are revoked
3. A `token.reuse_detected` webhook event is fired
4. The user must re-authenticate from scratch

## Best Practices

- Store refresh tokens encrypted at rest, never in client-side storage
- Refresh proactively at ~80% of access token lifetime (12 minutes)
- Implement a token refresh mutex to prevent concurrent refreshes
- Handle 401 by re-authenticating, not by retrying the same refresh token

# Token Lifecycle & Rotation

## Token Lifetimes

| Token Type | Lifetime | Rotation Policy |
|---|---|---|
| Access Token (`access_token`) | 60 minutes (3600 s) | Non-rotating; request a new one via the refresh grant |
| Refresh Token (`refresh_token`) | 30 days | **Rotation not yet implemented** — see below |
| Authorization Code | 60 seconds | Single-use |
| PAR `request_uri` | 60 seconds | Single-use |

## Refresh Token Behaviour (current)

The current refresh grant returns a new `access_token` but **does not** issue a new `refresh_token` and **does not** invalidate the previous refresh token automatically. Refresh tokens remain valid until their TTL expires or they are explicitly revoked via `/v1/oauth/revoke`.

```
POST /v1/oauth/token
grant_type=refresh_token&refresh_token=rt_abc123&client_id=your_client_id

→ { "access_token": "at_new_...", "token_type": "Bearer", "expires_in": 3600 }
```

> **Roadmap:** Rotating refresh tokens with reuse detection (per OAuth 2.1 §6.1 and FAPI 1.0 Advanced) are on the implementation roadmap. Until then, do not rely on rotation as a security control.

## Reuse Detection — Roadmap

Automatic reuse detection (replayed refresh token → 401 + token family revocation + `token.reuse_detected` webhook) is **not yet implemented**. Treat refresh tokens as long-lived bearer credentials and protect them accordingly.

## Best Practices

- Store refresh tokens encrypted at rest, never in client-side storage.
- Refresh proactively at ~80% of access-token lifetime (~48 minutes).
- Implement a refresh mutex to prevent concurrent refreshes from the same session.
- On logout or suspected compromise, call `/v1/oauth/revoke` for both the access and refresh tokens.
- Re-authenticate the user on persistent 401 `invalid_grant` responses.

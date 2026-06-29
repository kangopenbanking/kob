# Python SDK examples

| Example | Purpose |
| --- | --- |
| `pkce_auth_code.py` | Minimal browser-redirect OAuth 2.0 + PKCE flow against the sandbox. |

## Run

```bash
export KOB_BASE=https://sandbox-api.kangopenbanking.com/v1
export KOB_CLIENT_ID=<your_sandbox_client_id>
export KOB_REDIRECT_URI=http://127.0.0.1:8765/callback
export KOB_SCOPE="openid accounts"

python packages/sdk-python/examples/pkce_auth_code.py
```

Open the printed URL in any browser, sign in, consent. The sample's localhost
listener captures the redirect, validates `state`, exchanges the code at
`/oauth/token`, and calls `/health` with the bearer.

Public clients only — no `client_secret` is sent. See RFC 7636 §4. Standard
library only — no third-party dependencies.

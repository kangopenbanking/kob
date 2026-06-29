## Current state

I audited the OAuth client creation flows and found **three paths** today, but none of them create the `sbx_*` OAuth client your CI docs reference:

| Path | Route | Edge function | Client ID prefix | Environment stored |
|---|---|---|---|---|
| Admin API Client Management | `/admin/api-clients` | `admin-create-client` | `client_{uuid}` | Defaults to `sandbox` via DB, no UI toggle |
| Developer API Keys | `/developer/api-keys` | `developer-register-app` | `dev_{uuid}` | `sandbox` |
| Developer Registration (fallback) | `/developer/register` | client-side fallback | `kob_client_*` / `sk_test_*` | Not persisted |

The separate **Sandbox API Keys** flow (`/developer/sandbox`, `sandbox-create-api-key`) creates `sbx_test_*` API keys, but those are not OAuth 2.0 clients and cannot be used for the `authorization_code` / PKCE CI smoke tests.

So right now there is **no way to create an `sbx_*` OAuth client** with a registered redirect URI. You can create a sandbox OAuth client with prefix `client_` or `dev_` and use it for testing, but the `sbx_*` convention is missing.

## Proposed fix

Add a first-class `sbx_*` sandbox OAuth client creation flow so the CI integration docs (KOB_SANDBOX_CLIENT_ID, KOB_SANDBOX_CLIENT_SECRET, KOB_SANDBOX_REDIRECT_URI) line up with real credentials.

### 1. Backend edge function
Create or extend a sandbox OAuth client creation function:
- Accept `client_name`, `redirect_uris`, `scopes`, `grant_types`.
- Generate `client_id` with `sbx_{uuid}` prefix and a secure `client_secret`.
- Force `api_environment = 'sandbox'`.
- Insert into `api_clients` with `developer_user_id` / `developer_email` when called by a developer, or admin-only when called from `/admin`.
- Validate redirect URI(s) and reject wildcard/localhost for non-sandbox (not applicable here, but keep the rule).
- Return `{ client_id, client_secret, registration_client_uri, client_id_issued_at }`.

### 2. Admin UI (Developer Ops)
- Add a **"Create Sandbox OAuth Client"** button on `/admin/api-clients`.
- Add an **Environment** column/filter to the API clients table so admins can see `sandbox` vs `live` clients.
- Pre-fill the new-client dialog with `api_environment = sandbox` and `sbx_` prefix when the sandbox button is used.

### 3. Developer portal UI
- Add a **"Create OAuth 2.0 Sandbox Client"** card on `/developer/sandbox` and `/developer/api-keys`.
- Let the developer enter a redirect URI (e.g. `https://ci.kangopenbanking.com/callback`) and choose scopes/grant types.
- Show the client secret once with a copy button.

### 4. OAuth token compatibility
- Verify the `oauth/token` edge function and worker token endpoint accept `sbx_*` client IDs (no hard-coded prefix checks).
- Add a regression test ensuring `sbx_*` clients can exchange `client_credentials` and `authorization_code` tokens.

### 5. E2E audit
- Add a test that:
  1. Creates an `sbx_*` OAuth client.
  2. Completes the authorization_code / PKCE exchange.
  3. Calls `/v1/health` with the access token.
  4. Marks the result PASS/FAIL.

### 6. Docs & changelog
- Update the "create `sbx_*` OAuth client" section in `README.md` / CI docs.
- Add changelog entry for v4.52.x.

## Open question for you
Do you want the sandbox OAuth client to be:
- **(A)** Admin-only creation (only bank admins can mint `sbx_*` clients for institutions), or
- **(B)** Developer self-service (any logged-in developer can create `sbx_*` clients for their own CI/tests)?

Both are straightforward; (B) is closer to the existing `/developer/api-keys` experience.
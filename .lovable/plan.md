## Problem

The `api-health` Edge Function leaks the raw Supabase project URL (`https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/...`) in the `documentation` block of every `/health` response. This defeats the Cloudflare Worker proxy, which can rewrite headers but not JSON bodies.

A second leak exists in `oauth/index.ts` — the root response exposes `discovery: ${SUPABASE_URL}/functions/v1/oidc-config` to any anonymous caller.

The `oidc-config` function also hardcodes `SUPABASE_URL` for every endpoint field (issuer, token_endpoint, jwks_uri, etc.). These are OAuth/OIDC discovery endpoints — by spec they must point to the public production URL, not the backend origin.

## Fix

### 1. Add a new Supabase secret
- **`PUBLIC_API_BASE_URL`** = `https://api.kangopenbanking.com/v1`
- **`PUBLIC_SITE_URL`** = `https://kangopenbanking.com` (used by oidc-config issuer / explorer links)

A small helper resolves these with safe fallbacks so functions never crash if a secret is missing.

### 2. Patch `supabase/functions/api-health/index.ts`
Replace the `documentation` block:
```ts
const PUBLIC_API = Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1';
const PUBLIC_SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://kangopenbanking.com';

documentation: {
  openapi:        `${PUBLIC_API}/public-api-spec`,
  postman:        `${PUBLIC_API}/postman-collection`,
  explorer:       `${PUBLIC_SITE}/developer/api-explorer`,
  oidc_discovery: `${PUBLIC_API}/.well-known/openid-configuration`,
}
```
No more `Deno.env.get('SUPABASE_URL')` references in any user-facing field.

### 3. Patch `supabase/functions/oauth/index.ts`
The root listing response currently echoes the Supabase URL in `discovery`. Replace with:
```ts
discovery: `${PUBLIC_API}/.well-known/openid-configuration`,
```
Internal proxy logic (line 46) keeps using `SUPABASE_URL` — that's correct (it's a server-to-server call, never returned to the client).

### 4. Patch `supabase/functions/oidc-config/index.ts`
OIDC discovery is a public document; every URL it advertises must be the branded public URL. Replace `apiBase` and `issuer`:
```ts
const PUBLIC_API  = Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1';
const PUBLIC_SITE = Deno.env.get('PUBLIC_SITE_URL')     ?? 'https://kangopenbanking.com';

const issuer = PUBLIC_SITE;                       // stable issuer
authorization_endpoint:               `${PUBLIC_API}/oauth/authorize`,
token_endpoint:                       `${PUBLIC_API}/oauth/token`,
userinfo_endpoint:                    `${PUBLIC_API}/userinfo`,
jwks_uri:                             `${PUBLIC_API}/.well-known/jwks.json`,
registration_endpoint:                `${PUBLIC_API}/oauth/register`,
pushed_authorization_request_endpoint:`${PUBLIC_API}/oauth/par`,
revocation_endpoint:                  `${PUBLIC_API}/oauth/revoke`,
introspection_endpoint:               `${PUBLIC_API}/oauth/introspect`,
```
The Cloudflare Worker already maps `/v1/oauth/*` and `/v1/.well-known/*` paths to the corresponding flat Supabase functions, so these advertised URLs will resolve correctly through the proxy.

> Note: changing the `issuer` is technically a discovery-document change. Existing clients that pinned the old Supabase issuer would need to refresh discovery — acceptable because (a) the gateway is new and (b) the old value leaked the backend, which is the bug we're fixing.

### 5. Worker route check
Confirm `worker/src/index.ts` already handles:
- `/v1/.well-known/openid-configuration` → `oidc-config`
- `/v1/.well-known/jwks.json` → `jwks-endpoint`
- `/v1/public-api-spec`, `/v1/postman-collection` → flat functions
- `/v1/oauth/*` → `oauth` router

Add any missing mappings so the new public URLs return 200, not 404.

### 6. Deploy & verify
1. Add `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_URL` as Supabase secrets.
2. Deploy `api-health`, `oauth`, `oidc-config` (and worker if route map updated).
3. Smoke test:
   ```bash
   curl -s https://api.kangopenbanking.com/v1/health | grep -i 'supabase\.co'   # must return nothing
   curl -s https://api.kangopenbanking.com/v1/oauth | grep -i 'supabase\.co'    # must return nothing
   curl -s https://api.kangopenbanking.com/v1/.well-known/openid-configuration | grep -i 'supabase\.co'  # must return nothing
   ```
   All three greps must produce zero matches.

## Files Changed
- `supabase/functions/api-health/index.ts` — branded documentation URLs
- `supabase/functions/oauth/index.ts` — branded discovery URL in root response
- `supabase/functions/oidc-config/index.ts` — branded issuer + endpoint URLs
- `worker/src/index.ts` — confirm/extend route map for `.well-known/*` and `/oauth/*` (only if gaps found)
- New secrets: `PUBLIC_API_BASE_URL`, `PUBLIC_SITE_URL`

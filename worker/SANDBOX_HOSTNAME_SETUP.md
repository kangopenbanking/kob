# Sandbox Hostname — `sandbox-api.kangopenbanking.com`

The sandbox API hostname is served by the **same Cloudflare Worker** that powers
production (`api.kangopenbanking.com`). No second deployment is required.

## How it works

1. `worker/wrangler.toml` registers two `[[routes]]` entries pointing at the
   same Worker:

   ```toml
   [[routes]]
   pattern = "api.kangopenbanking.com/*"
   custom_domain = true

   [[routes]]
   pattern = "sandbox-api.kangopenbanking.com/*"
   custom_domain = true
   ```

2. Inside the Worker, `isSandboxHost(host, env)` checks the inbound `Host`
   header against `env.SANDBOX_HOST` (default `sandbox-api.kangopenbanking.com`).
   When it matches, the Worker:

   - Sets `x-kob-environment: sandbox` for the upstream call.
   - Rewrites `/v1/*` paths to the sandbox adapter (`/functions/v1/sandbox/*`).
   - Re-orders the OpenAPI `servers[]` so sandbox is the **default** server
     when `/openapi.json` is fetched from the sandbox host.

3. Existing path-based routing (`/v1/sandbox/...`) and the explicit header
   override (`x-kob-environment: sandbox`) remain supported on production for
   backward compatibility.

## DNS / Cloudflare provisioning

One-time setup in the Cloudflare dashboard for the `kangopenbanking.com` zone:

1. **DNS**: add an `AAAA`/`A` proxied record `sandbox-api → 100::` (any IP works
   when proxied through Cloudflare; the orange cloud is what matters).
2. **Workers Routes**: confirm the second route entry for
   `sandbox-api.kangopenbanking.com/*` is present (auto-created by
   `wrangler deploy` once the route block is added).
3. **SSL/TLS**: Cloudflare automatically issues an Edge cert for the new
   hostname. Verify it shows **Active** under SSL/TLS → Edge Certificates.

## Verification

```bash
# 1. OpenAPI spec is branded for sandbox
curl -s https://sandbox-api.kangopenbanking.com/openapi.json \
  | jq '.servers[0]'   # → { "url": "https://sandbox-api.kangopenbanking.com/v1", ... }

# 2. Health-check responds
curl -s https://sandbox-api.kangopenbanking.com/health | jq '.status'

# 3. No internal Supabase URL leaks (production + sandbox)
BASE_URL=https://api.kangopenbanking.com/v1 \
SANDBOX_URL=https://sandbox-api.kangopenbanking.com/v1 \
  ./worker/scripts/test-no-leak.sh
```

## Rollback

If the sandbox hostname needs to be retired, simply remove the second
`[[routes]]` block from `worker/wrangler.toml` and redeploy. The Worker code
falls back gracefully — production traffic is unaffected.

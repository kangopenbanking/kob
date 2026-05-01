# Kang Open Banking — API Gateway Worker

A 150-line Cloudflare Worker that fronts **`https://api.kangopenbanking.com/*`**
and forwards every request to the Supabase Edge Functions origin
(`https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/*`).

> **Why a worker and not a Supabase Custom Domain?**
> The Custom Domain path (Supabase Pro tier) is the long-term destination, but
> `api.kangopenbanking.com` is currently bound to a different Supabase project
> (`dkvyupzohoynkrfgojfh`). Until that mapping is freed and re-bound to project
> `wdzkzeahdtxlynetndqw`, this worker provides a branded, working API hostname
> with **zero risk to the production runtime** (the Direct Backend Mandate in
> `src/config/api.ts` is preserved — apps still call Supabase directly).

## What it does

| Public URL                                           | Forwards to                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `https://api.kangopenbanking.com/v1/<resource>`      | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/<resource>`        |
| `https://api.kangopenbanking.com/openapi.json`       | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec`   |
| `https://api.kangopenbanking.com/openapi.yaml`       | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/public-api-spec.yaml` |
| `https://api.kangopenbanking.com/health`             | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/health-check`      |
| `OPTIONS *`                                          | Answered at the edge (zero round-trip CORS)                                |

The worker:

- Streams request and response bodies (no buffering — large file uploads work).
- Strips hop-by-hop headers (`host`, `cf-*`, `x-forwarded-*`).
- Forwards `Authorization`, `apikey`, `idempotency-key`, `x-fapi-interaction-id`,
  `x-merchant-id`, and `x-api-key` untouched.
- Surfaces the Supabase debug headers (`sb-project-ref`, `sb-gateway-version`,
  `sb-request-id`, `x-sb-edge-region`) on every response.
- Returns RFC 7807 `application/problem+json` on upstream failures.

## Prerequisites

1. A Cloudflare account (free tier is sufficient).
2. The zone `kangopenbanking.com` added to that Cloudflare account.
3. Node.js 20+ locally.

## One-time deployment

```bash
cd worker
npm install
npx wrangler login            # opens browser, authorises CLI
npx wrangler deploy           # deploys to api.kangopenbanking.com
```

Wrangler creates the route binding automatically because of the
`custom_domain = true` declaration in `wrangler.toml`. Cloudflare provisions
and renews the TLS certificate for you.

## Verification

```bash
# 1. Health check — should return JSON 200 within ~150 ms.
curl -i https://api.kangopenbanking.com/health

# 2. OpenAPI spec — should return application/json with 339+ operations.
curl -sS https://api.kangopenbanking.com/openapi.json | jq '.info.version'

# 3. Public OAuth token endpoint — should return 400 (missing grant_type)
#    rather than 404, proving the proxy reached the origin.
curl -i -X POST https://api.kangopenbanking.com/v1/oauth/token

# 4. Inspect the Supabase debug headers to confirm origin routing.
curl -sI https://api.kangopenbanking.com/health | grep -E '^sb-|^x-served-by'
# Expected:
#   sb-project-ref: wdzkzeahdtxlynetndqw
#   sb-gateway-version: 1
#   x-served-by: kob-edge-gateway
```

## Local development

```bash
npm run dev          # http://127.0.0.1:8787 — proxies to live Supabase origin
npm run test         # vitest path-rewrite unit tests
npm run tail         # live production logs
```

## Optional: shared-secret hardening

If you want to guarantee the Supabase origin only ever serves traffic that
arrived via the gateway (e.g. to retire the direct URL from documentation
without breaking it for the apps), set a shared secret:

```bash
wrangler secret put GATEWAY_SHARED_SECRET
# Paste a long random value when prompted.
```

The worker will inject `X-Gateway-Secret: <value>` on every forwarded request.
You can then add a check in the Supabase functions (e.g. in `_shared/cors.ts`
or per-function) to reject anonymous, gateway-less traffic. **Do not enable
this until the apps and SDKs have been migrated to the gateway URL — it would
break every direct call.**

## Rollback

```bash
npx wrangler delete kob-gateway
```

Then update DNS to remove the `api` CNAME (or repoint it). The runtime apps
are unaffected because they call the direct Supabase URL.

## Long-term migration to a Supabase Custom Domain

When you are ready to replace this worker with a native Supabase Custom Domain:

1. In the Supabase dashboard for project `dkvyupzohoynkrfgojfh`, **remove**
   the custom-domain mapping for `api.kangopenbanking.com`.
2. In project `wdzkzeahdtxlynetndqw` (this project), **add**
   `api.kangopenbanking.com` under Settings → Custom Domains.
3. Follow the CNAME + TXT verification flow shown in the dashboard.
4. Once the domain shows **Active**, run `wrangler delete kob-gateway` and
   delete this folder. No code changes elsewhere are required, because the
   apps already use the direct Supabase URL and the SDKs use the branded URL —
   only the layer answering on `api.kangopenbanking.com` changes.

## Files

| File                            | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `src/index.ts`                  | Worker entry point — request/response pipeline.    |
| `wrangler.toml`                 | Deployment config (route, vars, observability).    |
| `test/rewrite.test.ts`          | Unit tests for the path rewriter.                  |
| `package.json` / `tsconfig.json`| Tooling.                                           |

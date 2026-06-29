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

## GitHub Actions deploy (`.github/workflows/worker-deploy.yml`)

The workflow auto-runs on every push that touches `worker/**`, and is also
manually dispatchable from **Actions → Deploy Cloudflare Worker → Run workflow**
with an `environment` choice (`production` | `sandbox`).

After `wrangler deploy` it runs three post-deploy gates and fails the job if
any of them break:

1. `worker/scripts/verify-deploy.sh` — header + status checks on both hostnames.
2. `worker/scripts/check-spec-version.mjs <env>` — confirms `/openapi.json`
   returns 200 JSON whose `info.version` matches `KOB_API_VERSION` in
   `src/config/version.ts`, and that `/docs` serves the Swagger UI shell.
3. `curl /v1/health` against the selected environment's gateway base.
4. OAuth quickstart smoke — exchanges `client_credentials` for an access
   token and calls the secured `/v1/health` against the just-deployed
   environment (skips cleanly if sandbox credentials are not configured).

### Required GitHub Actions secrets

| Secret                          | Required | Purpose                                                                                          |
| ------------------------------- | :------: | ------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`          |   yes    | Auth for `wrangler deploy`. Token scopes: **Workers Scripts: Edit** + **Account Settings: Read** (add **Workers Routes: Edit** if you also manage routes from CI). |
| `CLOUDFLARE_ACCOUNT_ID`         | optional | Only needed if the token belongs to multiple accounts. Wrangler auto-detects otherwise.          |
| `KOB_SANDBOX_CLIENT_ID`         | optional | OAuth client id used by the post-deploy quickstart smoke (sandbox).                              |
| `KOB_SANDBOX_CLIENT_SECRET`     | optional | OAuth client secret matched to `KOB_SANDBOX_CLIENT_ID`.                                          |

Add them under **Repo → Settings → Secrets and variables → Actions → New
repository secret**. The workflow itself only needs `permissions: contents:
read`; no `id-token`, `packages`, or `deployments` permissions are required.

## Verification



After every deploy, run the automated post-deploy gate:

```bash
npm run verify                 # checks PROD + SANDBOX /health, /v1/health, headers
# or, deploy-and-verify in one shot:
npm run deploy:verified
```

The script (`scripts/verify-deploy.sh`) asserts, on both
`api.kangopenbanking.com` and `sandbox-api.kangopenbanking.com`:

- `/health`, `/healthz`, `/v1/health`, `/openapi.json` return **200**
- `x-served-by: kob-edge-gateway` is present (proves Worker is in path)
- `x-kob-environment` matches the hostname (`production` vs `sandbox`)
- `sb-project-ref: wdzkzeahdtxlynetndqw` is correct
- `/v1/accounts` (unauthenticated) returns **401** — auth gate is live

A non-zero exit code blocks CI. Common failure causes are printed by the script.

Manual spot-checks:

```bash
# Inspect the Supabase debug headers to confirm origin routing.
curl -sI https://api.kangopenbanking.com/health | grep -E '^sb-|^x-served-by|^x-kob-environment'
# Expected:
#   sb-project-ref: wdzkzeahdtxlynetndqw
#   x-served-by: kob-edge-gateway
#   x-kob-environment: production
```

> **Adding a new public path?** Update `PUBLIC_PREFIXES` in
> `worker/src/index.ts` AND add a `check_endpoint` line to
> `scripts/verify-deploy.sh`. See the maintenance rules block above
> `PUBLIC_PREFIXES` in source.

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

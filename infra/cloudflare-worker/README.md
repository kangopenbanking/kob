# Kang Open Banking — Webhook Edge (Cloudflare Worker)

Public, Cloudflare-fronted ingress for upstream provider webhooks.
Maps `https://api.kangopenbanking.com/webhooks/v1/{provider}` to the
internal `gateway-webhook-{provider}` Edge Functions **without ever
exposing the underlying compute origin** in any response, header, or log.

## Routes

| Public path                      | Method | Forwards to internal function    |
| -------------------------------- | ------ | -------------------------------- |
| `/webhooks/v1/stripe`            | POST   | `gateway-webhook-stripe`         |
| `/webhooks/v1/flutterwave`       | POST   | `gateway-webhook-flutterwave`    |
| `/webhooks/v1/paypal`            | POST   | `gateway-webhook-paypal`         |
| `/webhooks/v1/health`            | GET    | (returns `{ ok: true }` directly) |

Sandbox URLs live at `sandbox.api.kangopenbanking.com/webhooks/v1/*`.

## Deploy

```bash
cd infra/cloudflare-worker
npm i -g wrangler

# Production
wrangler secret put UPSTREAM_BASE        # e.g. https://<project-ref>.supabase.co/functions/v1
wrangler secret put UPSTREAM_INVOKE_KEY  # platform anon key
wrangler deploy

# Sandbox
wrangler --env sandbox secret put UPSTREAM_BASE
wrangler --env sandbox secret put UPSTREAM_INVOKE_KEY
wrangler --env sandbox deploy
```

## Verification

After deploy:

```bash
curl -i https://api.kangopenbanking.com/webhooks/v1/health
# → 200 { "ok": true, "edge": "cloudflare", "host": "api.kangopenbanking.com" }

curl -i -X POST https://api.kangopenbanking.com/webhooks/v1/stripe \
  -H "Content-Type: application/json" -d '{"probe":"unsigned"}'
# → 401 + body { code: "missing_signature" | "invalid_signature", ... }

# The response MUST NOT contain Server, Via, X-Powered-By, or any URL
# referencing supabase.co. The Worker strips those headers explicitly.
```

## Security notes

- Origin URL lives only in `env.UPSTREAM_BASE` (Worker secret). It is
  **never** echoed in error bodies, logs, or response headers.
- Response headers `Server`, `Via`, `X-Powered-By`, `X-Supabase-Region`,
  `X-Deno-Region`, `X-Served-By`, `CF-Ray` are stripped before reply.
- Provider signature header is preserved byte-for-byte so upstream
  HMAC / cert-chain verification works unchanged.
- Per-route Cloudflare WAF + rate limit (500 rpm) is configured at the
  zone level, not in the Worker.

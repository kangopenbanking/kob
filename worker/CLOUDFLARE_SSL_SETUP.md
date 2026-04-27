# Cloudflare SSL/TLS Setup — `api.kangopenbanking.com`

This guide configures Cloudflare to serve `api.kangopenbanking.com` over
HTTPS via the Worker, **without disturbing the Netlify-hosted apex
(`kangopenbanking.com`) or `www`**.

The runtime app continues to call Supabase directly — only the documented
public API hostname routes through this Worker (Direct Backend Mandate).

---

## 1. Zone-level SSL/TLS settings

Cloudflare dashboard → **SSL/TLS → Overview**

| Setting | Value | Why |
|---|---|---|
| Encryption mode | **Full (strict)** | Worker → Supabase already uses a valid public cert. "Flexible" would break HTTPS to origin. |
| Minimum TLS version | **TLS 1.2** | FAPI 1.0 Advanced baseline. |
| Opportunistic Encryption | **On** | Free perf win for HTTP/2 clients. |
| TLS 1.3 | **On** | Required for modern API clients. |
| Automatic HTTPS Rewrites | **On** | Defensive — rewrites any stray `http://` references. |

**SSL/TLS → Edge Certificates**

- **Always Use HTTPS:** **On**
- **HTTP Strict Transport Security (HSTS):**
  - Enable: **On**
  - Max-age: **6 months** (`15552000`)
  - Apply to subdomains: **On** *(only after you've verified `api`, `www`, and apex all serve HTTPS cleanly — otherwise leave Off for safety)*
  - Preload: **Off** initially; enable once you're certain.
- **Minimum TLS Version:** **1.2**
- **TLS 1.3:** **On**
- **Automatic HTTPS Rewrites:** **On**
- **Certificate Transparency Monitoring:** **On**

---

## 2. DNS records (preserves Netlify on apex/www)

Cloudflare dashboard → **DNS → Records**

| Type | Name | Content | Proxy status | Notes |
|---|---|---|---|---|
| `A` | `@` | Netlify IP (`75.2.60.5` or your assigned) | **DNS only (grey cloud)** | Apex stays on Netlify; do NOT proxy. |
| `CNAME` | `www` | `<your-site>.netlify.app` | **DNS only (grey cloud)** | `www` stays on Netlify. |
| `CNAME` | `api` | *(auto-created by `wrangler deploy`)* | **Proxied (orange cloud)** | Created automatically when the Worker route binds the custom domain. |

`wrangler.toml` already declares:

```toml
[[routes]]
pattern = "api.kangopenbanking.com/*"
custom_domain = true
```

When you run `npx wrangler deploy`, Cloudflare:
1. Creates the `api` CNAME automatically (proxied).
2. Issues a free Universal SSL certificate for `api.kangopenbanking.com`.
3. Routes all requests to your Worker.

Cert provisioning typically takes 1–3 minutes.

---

## 3. Verify — copy/paste

```bash
# 1. SSL handshake works and uses TLS 1.3.
curl -vI https://api.kangopenbanking.com/health 2>&1 | grep -E 'SSL|TLS|HTTP/'

# 2. Edge → origin chain reports our gateway.
curl -sI https://api.kangopenbanking.com/health | grep -iE 'x-served-by|x-gateway-version'
#   x-served-by: kob-edge-gateway
#   x-gateway-version: 1.0.0

# 3. Health JSON includes upstream latency.
curl -s https://api.kangopenbanking.com/health | jq '.upstream'

# 4. Netlify is still serving the apex + www.
curl -sI https://kangopenbanking.com   | grep -i 'server: Netlify'
curl -sI https://www.kangopenbanking.com | grep -i 'server: Netlify'
```

Expected: `200` on `/health`, `Netlify` on apex+www, `kob-edge-gateway`
on the `api` host.

---

## 4. Recommended Page Rules / Rules engine (optional but professional)

**Rules → Page Rules** *(or Configuration Rules on new dashboards)*

| Match | Setting | Reason |
|---|---|---|
| `api.kangopenbanking.com/*` | Cache Level: **Bypass** | API responses must not be cached at the edge by default. |
| `api.kangopenbanking.com/openapi.*` | Cache Level: **Standard**, Edge Cache TTL: **5 minutes** | Spec is read-mostly; safe to cache briefly. |
| `api.kangopenbanking.com/health` | Cache Level: **Bypass** | Health must always be live. |

**Security → WAF → Rate limiting rules** *(recommended)*

- Rule: `(http.host eq "api.kangopenbanking.com")` → **100 requests / 10s per IP** → **Block**.
- Per-key tier limits remain enforced downstream by the existing
  `api_clients.rate_limit_tier` logic.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on `api` | Wait 5 minutes for Universal SSL provisioning. Verify in **SSL/TLS → Edge Certificates**. |
| Apex returns Cloudflare error 522 | The apex `A` record was accidentally proxied. Set it back to **DNS only**. |
| `525 SSL handshake failed` | Encryption mode is set to **Full** instead of **Full (strict)**, but origin cert mismatched. Switch to **Full (strict)** — Supabase has a valid public cert. |
| `/health` works but `/v1/...` returns 401 | Expected — `/v1/*` requires `x-api-key`. See `worker/README.md`. |

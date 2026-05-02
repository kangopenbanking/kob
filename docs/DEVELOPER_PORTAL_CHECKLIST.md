# Developer Portal Content Checklist

Run this checklist before every production deployment. The
`worker/scripts/verify-deploy.sh` script automates the curl checks; this
document captures the human review items.

## URLs that MUST return real content (not the homepage)

- [ ] `/developer` — portal hub with working navigation
- [ ] `/developer/getting-started` — step-by-step first API call
- [ ] `/developer/api-explorer` — Swagger UI rendering the live spec
- [ ] `/developer/gateway/quickstart` — payment quickstart guide
- [ ] `/developer/sandbox/overview` — test credentials and test numbers
- [ ] `/developer/guides/sdks` — Node, Python, PHP install + Java/Go/Ruby
      community implementation guides
- [ ] `/developer/examples/real-world` — working code examples
- [ ] `/developer/changelog` — versioned API changelog

## Content that MUST be accurate on every deploy

- [ ] Sandbox base URL is `https://sandbox-api.kangopenbanking.com/v1`
      (NEVER a `*.supabase.co` URL)
- [ ] Production base URL is `https://api.kangopenbanking.com/v1`
- [ ] Officially published SDK list is exactly: Node.js, Python, PHP
- [ ] Java, Go, Ruby are clearly labelled "Community guide" /
      "Implementation guide", not "Published SDK"
- [ ] No page renders its content body twice (view source — the prerender
      plugin must NOT inject a visible `#ssr-fallback` div)
- [ ] All code snippets have copy buttons
- [ ] Every payment code example shows an `Idempotency-Key` header
- [ ] Amount values are quoted strings (`"500000"`), not numbers, in every
      sample for XAF / XOF currencies

## After any change to `public/openapi.json`

- [ ] Version number incremented in `info.version` per the Version Gate
- [ ] Changelog entry added under `docs/governance/CHANGELOG-vX.Y.Z.md`
- [ ] Entry added to `public/changelog.json`
- [ ] Swagger UI on `/developer/api-explorer` loads without errors
- [ ] No existing `operationId`, field name, or path was changed
- [ ] OAuth `authorizationUrl`, `tokenUrl`, and `refreshUrl` all use
      slash-form paths (e.g. `/v1/oauth/authorize`, never
      `/v1/oauth-authorize`)
- [ ] DCR `token_endpoint_auth_method` enum does NOT contain `none`
      (FAPI 1.0 Adv §5.2.2 forbids it)
- [ ] Every tag advertised in the spec maps to at least one operation
      (no orphan tags such as a `camt.053` advert without an endpoint)

## Curl smoke test (run after every deploy)

```bash
for path in \
  "/developer" \
  "/developer/getting-started" \
  "/developer/api-explorer" \
  "/developer/gateway/quickstart" \
  "/developer/sandbox/overview" \
  "/developer/guides/sdks" \
  "/developer/examples/real-world" \
  "/developer/changelog" \
  "/openapi.json" \
  "/openapi.yaml"
do
  code=$(curl -o /dev/null -s -w "%{http_code}" "https://kangopenbanking.com${path}")
  echo "${code}  ${path}"
done

# Every line MUST be 200. Any 301/302 to "/" is a regression.

# Source-content checks
curl -s https://kangopenbanking.com/developer/sandbox/overview | \
  grep -q "YOUR_PROJECT" && echo "FAIL: placeholder URL leaked" || \
  echo "OK: no YOUR_PROJECT placeholder"

curl -s https://kangopenbanking.com/developer/sandbox/overview | \
  grep -q "supabase.co/functions/v1" && \
  echo "FAIL: internal URL leaked" || \
  echo "OK: no internal URL leaked"

curl -s https://kangopenbanking.com/developer | \
  grep -c '<div id="ssr-fallback"' | \
  awk '{ if ($1 > 0) { print "FAIL: duplicate-content div present"; exit 1 } else { print "OK: no ssr-fallback div" } }'
```

## Owners

- Spec & OpenAPI changes: Backend Architect
- Portal content: Developer Experience
- Worker / Cloudflare: Platform
- This checklist: Developer Experience (review every quarter)

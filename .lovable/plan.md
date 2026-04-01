

# Fix: Developer Portal Rendering -- All Pages Showing Same Stub (12/100 to 85+/100)

## Root Cause

The file `public/developer/index.html` is the single cause of the entire audit failure. Vite serves static files from `public/` with higher priority than SPA routing. When any browser requests `/developer` or `/developer/anything`, Vite (and the production hosting) serves this static HTML file instead of letting React Router handle the route.

The React SPA already has 60+ fully-built developer documentation pages with real content (code examples, tables, test credentials, Swagger UI, SDK docs, etc). None of them are reachable because the static HTML file intercepts every request.

## Evidence

- `src/pages/developer/GettingStarted.tsx` -- 338 lines, step-by-step guide with multi-language code examples
- `src/pages/developer/SandboxOverview.tsx` -- 182 lines, test credentials visible without login, test card/phone tables
- `src/pages/developer/AuthenticationOverview.tsx` -- 259 lines, OAuth 2.0 + PKCE flow with code
- `src/pages/developer/ApiExplorer.tsx` -- 308 lines, embedded Swagger UI loading from `/openapi.json`
- `src/pages/developer/SDKsPage.tsx` -- 409 lines, install commands + examples for 6 languages
- `src/pages/developer/GatewayWebhooksGuide.tsx` -- 430 lines, webhook events + signature verification
- `src/pages/developer/GatewayQuickstart.tsx` -- 254 lines, 10-minute tutorial
- `src/App.tsx` lines 837-963 -- 60+ routes correctly mapped under `<PublicDeveloperLayout>`
- `src/components/developer/PublicDeveloperLayout.tsx` -- full sidebar nav with 14 sections

All content exists. Zero content is rendered because of one file.

## Fix

### Step 1: Delete `public/developer/index.html`

This single deletion unblocks all 60+ developer documentation pages. The static HTML was originally a SEO fallback for non-JS crawlers, but it now blocks all users. Modern search engines render JavaScript; the SPA's `<Helmet>` tags provide SEO metadata.

### Step 2: Verify no other static HTML files shadow SPA routes

Check `public/` for any other `index.html` files in subdirectories that could shadow React Router routes.

### Step 3: Update the `navigateFallbackDenylist` in Vite PWA config

Remove the now-unnecessary `/developer/index.html` entry from the service worker denylist in `vite.config.ts` line 20, since the file no longer exists.

## Impact

| Metric | Before | After |
|--------|--------|-------|
| Unique content pages | 0 (all show stub) | 60+ (all React pages render) |
| Getting Started | Stub | 338-line step-by-step guide |
| Sandbox credentials | Hidden | Visible without login |
| API Explorer | Stub | Live Swagger UI |
| SDK docs | Stub | 6-language install + examples |
| Webhook guide | Stub | 52 events + signature code |
| Audit score | 12/100 | 85+/100 |

## Files Modified

| File | Change |
|------|--------|
| `public/developer/index.html` | **DELETE** |
| `vite.config.ts` | Remove `/developer/index.html` from denylist |




# Plan: Fix Developer Portal Blank Page for Non-JS Crawlers

## Problem

`/developer` (and all SPA routes) return an empty `<div id="root"></div>` when fetched without JavaScript. This is inherent to Vite SPAs — crawlers, `curl`, and accessibility tools see no content.

## Root Cause

The app is a client-side React SPA. `index.html` has no server-side rendering or pre-rendered HTML. All content is injected by JavaScript at runtime.

## Solution: Two-Layer Fix

### 1. Rich `<noscript>` block in `index.html`

Add a comprehensive `<noscript>` section inside `<body>` with:
- Developer Portal heading and description
- Links to all key developer pages (Getting Started, API Explorer, Examples, Webhooks, Quickstart)
- Links to downloadable OpenAPI specs (`/openapi.json`, `/openapi.yaml`)
- Structured text describing the API capabilities
- This ensures crawlers and no-JS agents see meaningful content on every route

### 2. Pre-rendered static HTML pages for key developer routes

Install `vite-plugin-prerender` (or use a post-build script) to generate static HTML snapshots for critical developer portal routes at build time:
- `/developer`
- `/developer/getting-started`
- `/developer/api-explorer`
- `/developer/examples/real-world`
- `/developer/gateway/quickstart`
- `/developer/gateway/webhooks`

**However**, `vite-plugin-prerender` requires a headless browser (Puppeteer) which may not work reliably in Lovable's build environment. So the more robust approach is:

### Revised approach: Static HTML fallback via `<noscript>` + enhanced `<head>` metadata

1. **`index.html`** — Add a `<noscript>` block with ~50 lines of semantic HTML covering the developer portal's key content, links, and API descriptions. This is what crawlers will index.

2. **`public/developer/index.html`** — Create a static HTML file specifically for `/developer` that contains full semantic content (headings, descriptions, navigation links, API feature list). Vite serves files from `public/` as-is, so `curl https://kangopenbanking.com/developer/` will return this file directly if the SPA hasn't loaded.

   **Important caveat**: Vite's SPA fallback (`navigateFallback` in service worker) may intercept this. The static file approach works for direct server hits but the service worker may override it. We'll configure the PWA plugin to exclude `/developer/index.html` from caching.

3. **E2E contract test** — Add a check in the e2e-contract-tests suite that fetches `/developer` and verifies HTML contains expected content strings.

## Files to modify

1. **`index.html`** — Add `<noscript>` block with developer portal content
2. **`public/developer/index.html`** — New static HTML page with full developer portal content (SEO-friendly, no JS required)
3. **`vite.config.ts`** — Ensure `public/developer/` is not interfered with by PWA plugin
4. **`supabase/functions/e2e-contract-tests/index.ts`** — Add SSR visibility check to Suite 11

## Technical detail

The `public/developer/index.html` trick works because most static hosts (including Lovable's deployment) serve `public/developer/index.html` when `/developer/` is requested. The SPA router then hydrates on top. For `curl` requests (no JS), the static HTML is returned as-is with full content.




# Plan: "Plug-and-Play" Developer Docs Infrastructure Hardening

## What exists today

| Surface | Route | Technology | Status |
|---------|-------|------------|--------|
| Developer Home | `/developer` | React SPA (DeveloperHome.tsx) | Working, JS-only |
| API Explorer (interactive) | `/developer/api-explorer` | swagger-ui-react, fetches `/openapi.json` | Working |
| API Explorer (static) | `/developer/api-explorer-static` | React page parsing openapi.json client-side | Working but still JS-rendered |
| Redoc | `/developer/redoc` | CDN redoc.standalone.js, loads `/openapi.json` | Working, has `<noscript>` fallback |
| Redoc Sandbox | `/developer/redoc-sandbox` | Same component | Working |
| Docs Health | `/developer/docs-health` | React health checker | Working |
| Documentation (legacy) | `/documentation` | React SPA with edge-function spec fetching | Working |
| Static spec files | `/openapi.json`, `/openapi.yaml`, `/openapi-sandbox.json`, `/openapi-sandbox.yaml` | Files in `/public/` | Present |
| Config | `src/config/api.ts` | Points to edge function for spec | Spec URL = edge function, not static file |

## What's missing for "plug-and-play"

1. **`API_CONFIG` still points to edge function** for OpenAPI spec — should also expose the local `/openapi.json` as a first-class constant so any component can use it without hardcoding paths.

2. **No centralized "Developer Docs Router" helper** — routes like `/developer/swagger`, `/developer/openapi`, `/developer/docs` are not wired. A developer or crawler trying obvious paths gets 404.

3. **`/documentation` page fetches spec from edge function** with fallback logic — should use the stable `/openapi.json` as primary, edge function as fallback (reversed priority).

4. **No `/developer/swagger` alias** — common convention; should redirect or render SwaggerUI.

5. **No `/developer/openapi` convenience route** — should redirect to `/openapi.json` download or show a landing page with format options.

6. **No `/developer/docs` alias** — many gateways use this; should redirect to `/developer/getting-started` or the developer home.

7. **Redoc `<noscript>` fallback is minimal** — only has download links, no actual endpoint listing in HTML.

8. **Missing SEO meta tags** on ApiExplorer and ApiExplorerStatic pages.

9. **No `data-testid` attributes** on key developer page elements for E2E testing.

## Implementation plan

### 1. Update `src/config/api.ts`
Add static spec URLs as constants:
```
OPENAPI_JSON: '/openapi.json',
OPENAPI_YAML: '/openapi.yaml',
OPENAPI_SANDBOX_JSON: '/openapi-sandbox.json',
OPENAPI_SANDBOX_YAML: '/openapi-sandbox.yaml',
```

### 2. Add convenience route aliases in `App.tsx`
- `/developer/swagger` → renders `ApiExplorer`
- `/developer/openapi` → renders a new lightweight `OpenApiDownloads` page (links to all 4 formats + copy URL buttons)
- `/developer/docs` → redirect to `/developer/getting-started`
- `/developer/reference` → renders `RedocPage`

These are additive routes — no existing routes change.

### 3. Create `src/pages/developer/OpenApiDownloads.tsx`
A small page with:
- Cards for JSON/YAML (prod + sandbox) with download buttons and "Copy URL" buttons
- Links to Swagger UI, Redoc, Static Reference
- SEO meta tags via `react-helmet-async`
- `<noscript>` block with plain download links

### 4. Update `src/pages/Documentation.tsx` fetch priority
Change the `useEffect` to try `/openapi.json` (static) first, then fall back to the edge function — reversing the current order. This makes the page work even if the edge function is cold/down.

### 5. Add SEO `<Helmet>` to `ApiExplorer.tsx` and `ApiExplorerStatic.tsx`
Both pages currently lack `<title>` and `<meta>` tags. Add them for crawlability.

### 6. Enhance `<noscript>` block in `RedocPage.tsx`
Expand the existing noscript block to include a short list of top-level endpoint groups (hardcoded from the known spec structure) so crawlers see meaningful content.

### 7. Add `data-testid` attributes
Add to key elements across developer pages:
- `data-testid="api-explorer-container"` on SwaggerUI wrapper
- `data-testid="redoc-container"` on Redoc wrapper
- `data-testid="spec-download-json"` / `yaml` on download buttons
- `data-testid="docs-health-results"` on health check table

### Files to modify
1. `src/config/api.ts` — add static spec constants
2. `src/App.tsx` — add 4 new route aliases
3. `src/pages/developer/OpenApiDownloads.tsx` — new file
4. `src/pages/Documentation.tsx` — reverse fetch priority
5. `src/pages/developer/ApiExplorer.tsx` — add Helmet + data-testid
6. `src/pages/developer/ApiExplorerStatic.tsx` — add Helmet + data-testid
7. `src/pages/developer/RedocPage.tsx` — enhance noscript + data-testid
8. `src/pages/developer/DocsHealth.tsx` — add new routes to health checks

No breaking changes. All existing routes and behaviors preserved.


# Developer Portal Hardening — SDKs, Prerender, Uptime

**Date:** 2026-05-02
**Type:** Documentation + tooling (no spec change; OpenAPI `info.version`
remains untouched per Standing Order 1).

## SDKs page (`/developer/guides/sdks`)

Officially published SDK list is now exactly:

| Language | Package | Status |
|---|---|---|
| Node.js | `@kangopenbanking/sdk` | Officially published |
| Python  | `kangopenbanking` | Officially published |
| PHP     | `kangopenbanking/sdk-php` | Officially published |
| Java    | (no package) | **Community implementation guide** |
| Go      | (no package) | **Community implementation guide** |
| Ruby    | (no package) | **Community implementation guide** |

Java, Go, and Ruby were previously listed alongside the published SDKs,
which sent integrators hunting for npm / PyPI / pkg.go.dev artifacts that
do not exist. They are now clearly labelled **"Community guide"** in a UI
alert at the top of each section, with inline reference snippets using
each language's standard library (`java.net.http.HttpClient`, `net/http`,
`Net::HTTP` + `OpenSSL`).

The portal home (`/developer`) quick-link list and the
`docs/DEVELOPER_PORTAL_CHECKLIST.md` were updated to match.

## Prerender bug fixes (`vite-plugin-prerender-docs.ts`)

- Removed the visible `<div id="ssr-fallback">` body injection that caused
  every developer page to render its content twice on first load.
  SEO fallback content is now wrapped only in `<noscript>` and is invisible
  to hydrated users.
- Replaced every remaining `YOUR_PROJECT.supabase.co/functions/v1`
  placeholder in the route content map with the public sandbox host
  `https://sandbox-api.kangopenbanking.com/v1`.

## New regression guards

| Guard | Trigger | Action on failure |
|---|---|---|
| `src/test/developer-portal-content.test.ts` | Every `npm test` / CI run | Build fails if `YOUR_PROJECT`, `supabase.co/functions/v1`, or visible `<div id="ssr-fallback"` reappear in `src/pages/developer/**`, `public/docs/**`, or the prerender plugin |
| `.github/workflows/developer-portal-uptime.yml` | Every 15 minutes via cron | Probes 11 portal + spec URLs; opens a GitHub issue tagged `portal-down` if any return non-200 or contain a forbidden marker |
| `supabase/functions/developer-portal-uptime-collector` | External scheduler | Records each probe into `developer_portal_health` for the admin `/healthz` dashboard |

## Standing-order citations

- **Order P1 (Public First)** — All probed URLs are anonymous-accessible.
- **Order P2 (Zero-404)** — Uptime workflow blocks any regression that
  would 404 or redirect a documented portal URL.
- **Order P5 (Working Code)** — Sandbox URL placeholder removal restores
  the working-code guarantee for every snippet on the portal.
- **Order P6 (Complete Content)** — Removing the duplicated body fixes the
  unique-content guarantee for every developer page.
- **Order P7 (Changelog)** — This entry is filed within 48h of the changes.
- **Standing Order 1 (Lock)** — No `operationId`, path, schema, security
  scheme, or component name was renamed or removed; `info.version`
  unchanged.
- **Standing Order 4 (Surgeon)** — All changes are additive (new tests,
  new workflow, new edge function, new table) or non-spec content fixes.

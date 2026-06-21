# Email CTA deep-link verification — 2026-06-21

## What changed
Previously `e2e/email-cta-routes.py` only asserted HTTP < 400 + "not 404".
That passes even if a CTA opens the wrong tab or silently re-routes to a
generic page.

New script `e2e/email-cta-deeplinks.py` asserts the **intent** of every CTA:

1. **HTTP status** < 400
2. **Final pathname** matches the intended route (or, for auth-gated routes,
   the public `/auth` bounce)
3. **Querystring/tab intent** — when a CTA targets a specific tab/section
   (`?tab=tips`, `?period=2026-05`) the expected key/value must survive
   navigation
4. **Visible marker** — a heading/body text, `[data-testid]`, or active Radix
   tab must be present after SPA hydration, proving the right content rendered

When a route is auth-gated and the run is anonymous, the bounce to `/auth`
is the correct intent and is treated as a pass (with a `auth-bounced`
marker note). Run signed-in (via `LOVABLE_BROWSER_SUPABASE_*` env) to
exercise the deep authenticated content.

## Result
`Total: 34  Passed: 34  Failed: 0` — every email CTA resolves to its
intended state, not just a 200.

## Run
```
python3 e2e/email-cta-deeplinks.py
# results.json + console PASS/FAIL written to /tmp/browser/email-cta-deeplinks/
```

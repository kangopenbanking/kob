

# Plan: Add Cache Headers for Static Spec Files

## Problem
The static OpenAPI spec files (`/openapi.json`, `/openapi.yaml`, etc.) are served with the default `cache-control: public, max-age=0, must-revalidate` header from the hosting platform. This is unnecessarily conservative for files that change infrequently.

## Solution
Create a `public/_headers` file (supported by the hosting platform) to set optimal cache headers for the spec files:

```
cache-control: public, max-age=300, stale-while-revalidate=86400
```

This caches for 5 minutes while allowing stale content to be served for up to 24 hours while revalidating in the background — reducing load and speeding up developer tooling.

## File to create

**`public/_headers`** — applies custom headers to specific paths:
- `/openapi.json` — 5min cache + 24h stale-while-revalidate
- `/openapi.yaml` — same
- `/openapi-sandbox.json` — same
- `/openapi-sandbox.yaml` — same
- `/apis.json` — same (API discovery file)

No other files changed. Fully additive.


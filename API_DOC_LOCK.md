# API Documentation Lock

> **Purpose:** prevent accidental, undocumented, or breaking changes to the
> live Kang Open Banking API specification and its public developer portal.
>
> This document is binding on every contributor and every AI-assisted edit
> session. Standing Orders 1–7 (Lock, Ratchet, Audit Trail, Surgeon, Dead
> Code, Version Gate, Five Roles) and Developer-Docs Standing Orders P1–P10
> remain in force at all times.

## Files that MUST NOT be modified without the formal API change process

- `public/openapi.json`
- `public/openapi.yaml`
- `public/openapi-sandbox.json`
- Any file under `public/api/` or `public/static/api/`
- `worker/src/index.ts`
- `worker/wrangler.toml` and `worker/wrangler.jsonc`
- The `PUBLIC_PATHS` set in the Cloudflare Worker
- Any Supabase Edge Function under `supabase/functions/` that backs a
  documented `/v1/*` route

## What the formal API change process means

1. Open a GitHub issue tagged `[api-change]` describing the change and the
   cited justification standard (FAPI 1.0 Adv §x.y, OBIE v4.0.1 §x.y, etc.).
2. Get explicit approval from at least one backend engineer **and** one
   integration partner.
3. Increment `info.version` in `public/openapi.json` according to the
   Version Gate (patch / minor / major).
4. Add an entry to `docs/governance/CHANGELOG-vX.Y.Z.md` and to
   `public/changelog.json` within 48 hours of deployment (Order P7).
5. Verify the updated spec renders correctly in the Swagger UI on
   `/developer/api-explorer`.
6. Only then merge and deploy.

## The rule: zero unannounced breaking changes

A breaking change is any of these:

- Removing an existing field from a response schema
- Changing a field type (e.g. `string` → `number`)
- Removing or renaming an existing endpoint
- Renaming an `operationId`, schema, security scheme, or parameter
- Renaming a required field
- Changing the HTTP method of an existing endpoint
- Removing an enum value or response code
- Removing a security scheme from an operation

## Non-breaking changes (always permitted under the Surgeon Rule)

- Adding new optional fields to a response
- Adding new endpoints
- Adding new enum values (with caution; document in changelog)
- Updating descriptions and examples
- Deprecating fields with `x-deprecated`, `Deprecation:` header, and
  `Sunset:` header

## Public-portal invariants (Standing Orders P1, P2, P4)

- The full developer documentation site at `/developer` and ALL its
  sub-routes are publicly accessible without authentication.
- `/openapi.json` and `/openapi.yaml` are served as raw, valid,
  machine-readable files — never gated.
- SDK packages and their documentation remain publicly accessible and
  downloadable.
- All published documentation URLs return their correct content; **no**
  developer-portal route may redirect to the homepage.
- These invariants must survive every deployment, refactor, and feature
  change. Routing files carry the comment block
  `// PERMANENT PUBLIC ROUTES — DO NOT REMOVE OR REDIRECT`.

## Internal URLs MUST NOT appear in developer-facing content

The internal Supabase project hostname
(`*.supabase.co/functions/v1`) is a backend implementation detail. It
must NEVER appear in:

- Any page under `/developer/*`
- Any rendered code example, diagram, or screenshot
- The OpenAPI spec
- The Postman collection
- Any prerendered HTML (`vite-plugin-prerender-docs.ts`)

The canonical public hostnames are:

- Production: `https://api.kangopenbanking.com/v1`
- Sandbox: `https://sandbox-api.kangopenbanking.com/v1`
- OpenAPI spec: `https://kangopenbanking.com/openapi.json`

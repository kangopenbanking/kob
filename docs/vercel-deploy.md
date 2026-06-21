# Vercel deployment (default)

Vercel is the default production deploy target for `kangopenbanking.com`.
Netlify remains available as a fallback (`netlify.toml` + `netlify-prod-deploy.yml`)
but Vercel is the path exercised by CI.

## Files

- `vercel.json` — build command, SPA rewrites (excludes raw public artifacts so
  `/openapi.json`, `/openapi.yaml`, `/postman/*`, `/.well-known/*` are served
  verbatim), and headers mirroring `public/_headers` (CORS, cache, robots).
- `.github/workflows/vercel-prod-deploy.yml` — production deploy workflow.
- `scripts/vercel-postdeploy-smoke.mjs` — post-deploy smoke test for
  `/developer/*`, `/openapi.json`, `/openapi.yaml`, `/apis.json`, etc.

## One-time setup

1. **Create the Vercel project**
   ```bash
   npx vercel login
   npx vercel link        # pick scope + project; writes .vercel/project.json
   ```
   `.vercel/` is git-ignored; only the IDs matter.

2. **Read the IDs**
   ```bash
   cat .vercel/project.json
   # { "orgId": "team_xxx", "projectId": "prj_xxx" }
   ```

3. **Add GitHub Actions secrets** (Settings → Secrets and variables → Actions):

   | Secret              | Where to get it                                        |
   |---------------------|--------------------------------------------------------|
   | `VERCEL_TOKEN`      | https://vercel.com/account/tokens                      |
   | `VERCEL_ORG_ID`     | `orgId` from `.vercel/project.json`                    |
   | `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json`                |
   | `VERCEL_PROD_URL`   | Optional. Defaults to `https://kangopenbanking.com`.   |

   The workflow's first step (`Guard — required secrets present`) fails fast
   and prints which secrets are missing.

4. **Add Vercel project env vars** that the build needs (the same ones the
   Netlify build uses): `EXPECTED_OPENAPI_VERSION` is auto-derived from
   `src/config/version.ts`; any `VITE_*` vars must be added to Vercel under
   Project Settings → Environment Variables.

## Deploy triggers

- Push to `main` touching version-bearing files (`src/**`, `vercel.json`,
  `public/openapi*.{json,yaml}`, `public/postman/**`,
  `docs/developer-portal/**`, etc.).
- Successful completion of `Auto-sync API version artifacts`.
- Manual `workflow_dispatch`.

## Post-deploy verification

Every successful deploy runs `scripts/vercel-postdeploy-smoke.mjs` against
`VERCEL_PROD_URL`. It asserts:

- `/developer`, `/developer/quickstart`, `/developer/api-reference`,
  `/developer/sdks`, `/developer/changelog` return `200 text/html`.
- `/openapi.json`, `/openapi-sandbox.json`, `/apis.json` return valid JSON.
- `/openapi.yaml` returns parseable YAML.
- `/changelog.json` and `/.well-known/ai-plugin.json` (optional) reachable.

Run it locally against any base URL:

```bash
node scripts/vercel-postdeploy-smoke.mjs https://kangopenbanking.com
```

## Standing-order coverage

- P1 (Public First) and P4 (Open Spec): smoke test fails if any developer
  page or spec file is gated/missing.
- P2 (Zero-404): smoke test asserts 200 on all permanent public routes.
- P10 (Living Docs): deploy auto-fires on `docs/developer-portal/**` and
  spec changes, so portal cannot drift more than one merge behind SSOT.

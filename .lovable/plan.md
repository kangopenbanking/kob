## Goal

Strengthen the developer-portal CI/CD pipeline by (1) smoke-testing the actual Netlify Deploy Preview on PRs, (2) reading the expected API version from a single TypeScript SSOT instead of duplicating it as a hardcoded env var, (3) hardening the Swagger UI smoke test, and (4) routing failures of the predeploy gate or smoke workflow to Slack/email.

---

## 1. Single source of truth for `EXPECTED_OPENAPI_VERSION`

**Problem:** The version `4.28.2` is hardcoded in `netlify.toml`, `developer-portal-smoke.yml`, `developer-portal-deep-audit.yml`, `developer-portal-uptime.yml`, `check-openapi-version.mjs`, and `predeploy.mjs` — a clear drift risk.

**Plan:**

- Create `scripts/lib/read-expected-version.mjs` — a tiny helper that parses `src/config/version.ts` with a regex (`/KOB_API_VERSION\s*=\s*["']([^"']+)["']/`) and returns the version string. No TS compile, no deps.
- Create `scripts/print-expected-version.mjs` — wrapper that prints the value to stdout (used by Netlify and GitHub Actions to export the env var).
- Update `scripts/check-openapi-version.mjs` and `scripts/predeploy.mjs` and `scripts/audit-public-access.mjs` to fall back to the helper when `EXPECTED_OPENAPI_VERSION` is unset, so callers no longer need to pass it.
- Update `netlify.toml`:
  - Remove the static `EXPECTED_OPENAPI_VERSION = "4.28.2"` line.
  - Prefix every build command with `export EXPECTED_OPENAPI_VERSION=$(node scripts/print-expected-version.mjs) &&`.
- Update all three GitHub workflows (`developer-portal-smoke.yml`, `developer-portal-deep-audit.yml`, `developer-portal-uptime.yml`) to drop the hardcoded `EXPECTED_OPENAPI_VERSION: '4.28.2'` and add a "Resolve expected version" step:
  ```yaml
  - id: ver
    run: echo "value=$(node scripts/print-expected-version.mjs)" >> "$GITHUB_OUTPUT"
  ```
  then reference `${{ steps.ver.outputs.value }}` wherever needed (or export it to `$GITHUB_ENV`).
- Add `npm run version:print` to `package.json` for convenience.

After this, bumping the API version requires editing only `src/config/version.ts`.

---

## 2. Run smoke tests against the Netlify Deploy Preview on PRs

**Problem:** Today, PRs only run the offline parity gate; the live preview is never exercised.

**Plan:**

- Switch `developer-portal-smoke.yml` to a `pull_request_target` trigger for the smoke job (so it can read PR metadata) **plus** keep `push` and `workflow_dispatch`.
- Add a new `preview-smoke` job, gated on `github.event_name == 'pull_request'`, that:
  1. Uses the official **`nwtgck/actions-netlify`** wait action — `jsmrcaga/action-netlify-deploy@v2.0.0` or `probablyup/wait-for-netlify-action@3.6.0` — to block until the PR's Deploy Preview reports `ready`. Inputs: `site_id` and `max_timeout: 300`. The action returns the preview URL (e.g. `deploy-preview-42--site.netlify.app`) as an output.
  2. Exports `SMOKE_BASE_URL` and `AUDIT_BASE` from that output.
  3. Runs `npm run audit:public` and `npm run smoke:portal` against it.
- Add two new GitHub Actions repository secrets the user will need to provide:
  - `NETLIFY_SITE_ID`
  - `NETLIFY_AUTH_TOKEN`
  We will document this in the workflow header comment and surface it after the change.
- Keep the existing parity job as a required pre-step.

---

## 3. Stronger Swagger UI smoke test

**Problem:** The current test only greps the static HTML for the substring `swagger`. SPA-rendered Swagger UI is invisible to a plain `fetch`, so this is a weak signal.

**Plan:**

- Add `playwright` (already in devDependencies) to `src/test/portal-smoke.test.ts`'s sibling: create `src/test/portal-swagger.spec.ts` as a tiny Playwright spec that:
  1. Navigates to `${BASE}/developer/api-explorer`.
  2. Waits for `network idle` and intercepts requests; asserts that a `GET /openapi.json` request resolved with status `200` and a JSON body whose `info.version` equals the SSOT version.
  3. Waits for the selector `.swagger-ui .opblock` (the rendered operation row) and asserts `count() >= 1`, proving at least one endpoint was rendered.
- Add `npm run smoke:swagger` → `playwright test src/test/portal-swagger.spec.ts --reporter=line`.
- Wire it into `developer-portal-smoke.yml` after the Vitest step (with `npx playwright install --with-deps chromium`).
- Keep the existing Vitest HTML check as a low-cost sanity test — it still catches dropped script tags.

---

## 4. Failure notifications (Slack + email)

**Plan (Slack-first, with email as a backup):**

- Add a reusable composite action at `.github/actions/notify-failure/action.yml` that:
  - Posts to Slack via Incoming Webhook (`SLACK_WEBHOOK_URL` secret) using `slackapi/slack-github-action@v1.27.0`.
  - Falls back to email via `dawidd6/action-send-mail@v3` if `SMTP_*` secrets are present and Slack secret is not.
  - Message includes: workflow name, job, commit SHA, PR link, run URL, and the failing step name.
- Append `if: failure()` notification steps to:
  - `developer-portal-smoke.yml` (both `parity` and `smoke`/`preview-smoke` jobs)
  - `developer-portal-deep-audit.yml`
  - `developer-portal-uptime.yml`
- For the **predeploy script** (which runs locally + on Netlify), wrap it: in `scripts/predeploy.mjs`, on non-zero exit, if `SLACK_WEBHOOK_URL` is set in `process.env` (Netlify build env), POST a JSON payload to it with the failing step name before calling `process.exit`. Local dev runs without the secret remain silent.
- Document the two new secrets (`SLACK_WEBHOOK_URL`, optional `SMTP_*`) in a small block at the bottom of `netlify.toml` and in a one-paragraph note in `docs/DEVELOPER_PORTAL_CHECKLIST.md`.

---

## Files to be created

- `scripts/lib/read-expected-version.mjs`
- `scripts/print-expected-version.mjs`
- `src/test/portal-swagger.spec.ts`
- `.github/actions/notify-failure/action.yml`

## Files to be edited

- `netlify.toml` — remove hardcoded version; export from SSOT; add Slack secret note.
- `package.json` — add `version:print`, `smoke:swagger` scripts.
- `scripts/check-openapi-version.mjs`, `scripts/audit-public-access.mjs`, `scripts/predeploy.mjs` — fallback to SSOT helper; Slack hook in predeploy.
- `.github/workflows/developer-portal-smoke.yml` — preview-smoke job, dynamic version, notify-failure step, Playwright run.
- `.github/workflows/developer-portal-deep-audit.yml` — dynamic version, notify-failure.
- `.github/workflows/developer-portal-uptime.yml` — dynamic version, notify-failure.
- `docs/DEVELOPER_PORTAL_CHECKLIST.md` — short note on the four new secrets.

## Required secrets the user will add (one-time)

- `NETLIFY_SITE_ID`
- `NETLIFY_AUTH_TOKEN`
- `SLACK_WEBHOOK_URL` (or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_TO` for email)

I'll surface these in the final response so you can paste them into GitHub → Settings → Secrets and into Netlify → Site settings → Environment variables.

# KOB End-to-End Test Harness (Playwright)

Phase 4 introduces a lightweight Playwright smoke suite that validates every
dashboard root loads without console errors.

## Scope

| Suite | Path | Purpose |
|-------|------|---------|
| Smoke | `e2e/smoke/dashboards.spec.ts` | One test per dashboard root (12 layouts). Verifies the route responds, the SPA shell renders, and no console errors fire. Auth-gated routes may redirect to `/auth` — that is treated as PASS. |

Future sub-suites (added per dashboard, not in this commit) will cover:

- Admin: KYB review queue approve/reject end-to-end.
- Merchant: API key creation + webhook delivery replay.
- Customer PWA: P2P transfer with PIN confirm.
- Bank / FI Portal: KYC review queue + customer onboarding.

## Running

```bash
# Install once
npx playwright install chromium

# Run against the published URL
npx playwright test

# Run against the local preview
PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test

# Filter
npx playwright test -g "Admin dashboard"
```

## CI

When wiring CI, set `PLAYWRIGHT_BASE_URL` to the preview URL of the build under
test. The suite is configured with `forbidOnly` and 2 retries when `CI=true`.

## Adding a new dashboard

1. Add an entry to the `DASHBOARDS` array in `e2e/smoke/dashboards.spec.ts`.
2. If the route is gated by `<RoleGuard>` set `authGated: true`.
3. Re-run the suite locally before opening a PR.

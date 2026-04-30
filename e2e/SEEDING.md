# E2E Test Seeding (Phase 4 follow-up)

The authenticated Playwright suites under `e2e/authenticated/` require seeded
test users with known credentials. Until those users are seeded, every test
in that directory is marked `test.skip()` so the smoke suite stays green.

## Required test accounts

| Role | Email pattern | Used by |
|------|---------------|---------|
| Admin | `e2e+admin@kob.test` | Admin queues, webhook-replay, KYB visibility |
| Merchant | `e2e+merchant@kob.test` | Merchant dashboard, webhook deliveries |
| Institution / Bank | `e2e+bank@kob.test` | FI Portal, customer KYC visibility |
| Consumer | `e2e+consumer@kob.test` | Loan apply, savings withdraw, piggybank cancel, njangi events |

Each account needs:
- A confirmed email (no link click required for the test user).
- A fixed password stored in CI as `E2E_PASSWORD` (single shared password is fine for test fixtures).
- The matching `user_roles` row.
- For the institution account, a linked `institutions` row + `staff_assignments`.
- For the merchant account, a `gateway_merchants` row in `kyb_status = 'approved'`.

## Required environment variables

```bash
PLAYWRIGHT_BASE_URL=https://kob.lovable.app
E2E_PASSWORD=<fixed test password>
E2E_ADMIN_EMAIL=e2e+admin@kob.test
E2E_MERCHANT_EMAIL=e2e+merchant@kob.test
E2E_BANK_EMAIL=e2e+bank@kob.test
E2E_CONSUMER_EMAIL=e2e+consumer@kob.test
```

## How to enable the authenticated suites

1. Provision the four accounts above (via the admin onboarding tools in
   the app or a dedicated `seed-e2e-users` Edge Function — see the
   pending Phase 4 follow-up).
2. Set the env vars listed above (locally in `.env.test` or in CI secrets).
3. Remove the `test.skip` guard at the top of each spec under
   `e2e/authenticated/` (or set `RUN_AUTHENTICATED_E2E=1` in the env).
4. Re-run: `npx playwright test e2e/authenticated`.

## Why this is gated

Workspace standing rule: forms must be E2E tested with no gaps and use real
authentication (`supabase.auth.getUser()`, never `getSession()`). Faking
sessions or storage state would violate that rule, so the authenticated
suites stay disabled until the seed users exist.

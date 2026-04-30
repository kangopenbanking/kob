# E2E Test Seeding (Phase 4 follow-up)

The authenticated Playwright suites under `e2e/authenticated/` require seeded
test users with known credentials. Until those users are seeded, every test
in that directory is marked `test.skip()` so the smoke suite stays green.

## Required test accounts

| Role | Email | Used by |
|------|-------|---------|
| Admin | `e2e+admin@kob.test` | Admin queues, webhook-replay, KYB visibility |
| Merchant | `e2e+merchant@kob.test` | Merchant dashboard, webhook deliveries |
| Institution / Bank | `e2e+institution@kob.test` | FI Portal, customer KYC visibility |
| Consumer | `e2e+consumer@kob.test` | Loan apply, savings withdraw, piggybank cancel, njangi events |

All four accounts share a **single fixed password** stored as the
`E2E_PASSWORD` runtime secret. Each is created with `email_confirm: true`
so no link click is required.

## Seeding via the `seed-e2e-users` Edge Function

A dedicated, idempotent Edge Function provisions all four accounts.
It can be re-run any number of times — existing users have their password
re-synced to `E2E_PASSWORD`, and role / institution / merchant rows are
upserted in place.

### Required runtime secrets (Lovable Cloud)

| Secret | Purpose |
|--------|---------|
| `E2E_PASSWORD` | Fixed password applied to all four seeded users (min 12 chars). |
| `E2E_SEED_TOKEN` | Shared bearer token sent in the `x-seed-token` header to authorize the call. |

Both are already registered as project secrets — set their values in
**Lovable Cloud → Settings → Edge Functions** before running the seed.

### Invoke the seed

```bash
curl -X POST \
  -H "x-seed-token: $E2E_SEED_TOKEN" \
  https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/seed-e2e-users
```

Successful response:

```json
{
  "ok": true,
  "password_set": true,
  "users": [
    { "email": "e2e+admin@kob.test",       "ok": true, "role": "admin" },
    { "email": "e2e+merchant@kob.test",    "ok": true, "role": "merchant",    "merchant_id": "..." },
    { "email": "e2e+institution@kob.test", "ok": true, "role": "institution", "institution_id": "..." },
    { "email": "e2e+consumer@kob.test",    "ok": true, "role": "personal" }
  ]
}
```

A `207` status with per-user errors indicates partial success — re-run
after fixing the underlying issue (the function is fully idempotent).

### What gets created / upserted

For every account:
- `auth.users` row with `email_confirm = true`, password = `E2E_PASSWORD`.
- `profiles` row keyed by `user_id`.
- `user_roles` row with the matching `app_role`.

Role-specific extras:
- **institution**: an `institutions` row (`institution_name = 'E2E Test Institution'`,
  `country = 'CM'`, `status = 'approved'`, `sandbox_access = true`).
- **merchant**: a `gateway_merchants` row (`status = 'active'`,
  `kyb_status = 'approved'`, `environment = 'test'`).

## Required Playwright environment variables

```bash
PLAYWRIGHT_BASE_URL=https://kob.lovable.app
E2E_PASSWORD=<same value used when seeding>
E2E_ADMIN_EMAIL=e2e+admin@kob.test
E2E_MERCHANT_EMAIL=e2e+merchant@kob.test
E2E_INSTITUTION_EMAIL=e2e+institution@kob.test
E2E_CONSUMER_EMAIL=e2e+consumer@kob.test
RUN_AUTHENTICATED_E2E=1
```

## How to enable the authenticated suites

1. Set `E2E_PASSWORD` and `E2E_SEED_TOKEN` runtime secrets in Lovable Cloud.
2. Run the `curl` above (or invoke from your CI bootstrap step).
3. Export the Playwright env vars listed above (locally in `.env.test`
   or in CI secrets), including `RUN_AUTHENTICATED_E2E=1`.
4. Re-run: `npx playwright test e2e/authenticated`.

## Why this is gated

Workspace standing rule: forms must be E2E tested with no gaps and use real
authentication (`supabase.auth.getUser()`, never `getSession()`). Faking
sessions or storage state would violate that rule, so the authenticated
suites stay disabled until the seed users exist.

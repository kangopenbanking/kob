# KYC/KYB Youverify E2E Coverage — 2026-06-21

Two new automated suites enforce Youverify primacy and status freshness.

## 1. Webhook → Status Sync (`e2e/kyc-status-webhook-sync.py`)

Validates the customer-facing KYC status page (and underlying tables) never
remains in an outdated state after Youverify notifies us of a decision.

Per case (identity + business × approved + rejected):

1. Service-role seeds a `pending` row in `kyc_verifications` /
   `business_kyc` with a synthetic `youverify_session_id`.
2. POSTs an HMAC-signed webhook (`x-youverify-signature`,
   `x-youverify-timestamp`) to `/functions/v1/youverify-webhook` matching the
   live verifier (`${timestamp}.${rawBody}` HMAC-SHA256).
3. Polls the row until `status` / `verification_status` flips to the expected
   value within 15 s — fails the case on stale.
4. Drives Playwright into `/app/kyc` as the seeded user, screenshots, and
   asserts the rendered DOM contains the new status label
   (`approved|verified` or `rejected|declined`).

Cleanup deletes the seeded rows even on failure.

## 2. No-Fallback Routing (`e2e/kyc-youverify-no-fallback.py`)

Invokes `unified-kyc-gateway` directly for both KYC (`kind=identity`) and KYB
(`kind=business`) and asserts:

* HTTP 200, response `provider === "youverify"`, `fallback_triggered === false`.
* `kyc_verification_audit` row for the `trace_id` shows
  `provider_used="youverify"`, `fallback_triggered=false`,
  `youverify_success=true`.
* `kyc_circuit_breaker_state.provider='youverify'` is `closed` (proving the
  happy path used the primary, not the half-open / open self-hosted fallback).

KYB case is skipped automatically if `TEST_INSTITUTION_ID` is not provided.

## Required environment

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | seeding & audit reads |
| `YOUVERIFY_WEBHOOK_SECRET` | HMAC for webhook simulation |
| `TEST_USER_ID`, `TEST_USER_JWT`, `TEST_USER_SESSION_JSON` | persona under test |
| `TEST_INSTITUTION_ID` (opt) | KYB routing target |
| `LOVABLE_BROWSER_SUPABASE_STORAGE_KEY`, `TEST_APP_BASE_URL` | UI assertion |

## Result

Both suites green against the current `unified-kyc-gateway` + `youverify-webhook`
deployment. Any future change that reintroduces a self-hosted code path on the
happy path, or that lets the status page lag the webhook, will fail CI.

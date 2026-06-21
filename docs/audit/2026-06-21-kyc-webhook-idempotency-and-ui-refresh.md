# KYC/KYB Webhook Idempotency & Live UI Refresh — 2026-06-21

## `e2e/kyc-webhook-idempotency.py`
Replays the same Youverify event 5× per case (KYC + KYB) and asserts:
- Exactly one row in `youverify_webhook_events` per `event_id` (dedupe).
- `updated_at` on the target row does **not** advance after the first apply.
- A later, conflicting `rejected` event (different `event_id`) does **not**
  demote an already-`approved` terminal state.

## `e2e/kyc-status-ui-refresh.py`
Drives `/app/kyc` in Playwright as a real user and, without reloading the page,
posts a signed webhook flipping the seeded row. Waits up to 12 s for the UI to
reflect the new label via realtime subscription or react-query refetch.
Covers approved + rejected for both identity and business flows. Screenshots
captured per case under `/tmp/browser/kyc-status-ui-refresh/`.

Both suites are pure additions and clean up seeded rows even on failure.

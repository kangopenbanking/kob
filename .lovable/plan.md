# Admin MFA Step-Up, Audit Viewer & Webhook Health

Four interlocking workstreams to close out audit items from the KYC/KYB hardening pass.

## 1. Step-Up MFA Challenge Flow (Admin Reviews)

**Goal:** When `admin-kyc-review`, `admin-kyb-verify`, or `admin-institution-approve` return `401 STEP_UP_REQUIRED`, the reviewer is prompted to complete MFA in-place and the original action is re-tried automatically.

- New `src/components/admin/StepUpChallengeDialog.tsx`:
  - Detects available factors via `supabase.auth.mfa.listFactors()`.
  - Calls `mfa.challenge({ factorId })`, prompts TOTP via shadcn `InputOTP`.
  - Calls `mfa.verify()` to elevate session to `aal2`.
  - On success, invokes a caller-supplied `onResolved()` to re-run the original mutation.
  - Handles "no factor enrolled" → links to `/security/mfa` enrolment page.
- New helper `src/lib/step-up-client.ts` exporting `withStepUp(fn)` — wraps an async action; if the response/exception matches `STEP_UP_REQUIRED`, opens the dialog and retries once on success.
- Wire into the three admin pages:
  - `src/pages/admin/KYCVerificationReview.tsx`
  - `src/pages/admin/BusinessKYCReview.tsx`
  - `src/pages/admin/InstitutionVerification.tsx` (+ `InstitutionDetailsDialog.tsx`)
- Surface a clear inline error if the user has no MFA factors and cannot escalate.

## 2. E2E Tests for STEP_UP_REQUIRED

New Playwright specs under `e2e/authenticated/`:
- `step-up-kyc-review.spec.ts` — admin without `aal2` clicks Approve, sees challenge dialog, cancel = no state change; success path stubbed via test-only factor.
- `step-up-kyb-verify.spec.ts` — same shape against `/admin/business-kyc`.
- `step-up-institution-approve.spec.ts` — same against `/admin/institution-verification`.
- Each spec asserts:
  - 401 surfaced as dialog (not a toast/redirect).
  - Cancel returns reviewer to queue with row unchanged.
  - Successful step-up triggers retry and produces `step_up` metadata in `audit_logs` (verified via supabase read).
- Add a new GitHub workflow `.github/workflows/step-up-e2e.yml` mirroring the existing kyc/kyb workflows (gated on `E2E_PASSWORD`).

## 3. Admin Audit Log Viewer

New route `/admin/audit-logs` (admin-only):
- `src/pages/admin/AuditLogsViewer.tsx` reading from `public.audit_logs`.
- Filters:
  - Event type quick-chips: `step_up_denied`, `manual_review`, `webhook_correlation_*`, `persist_yv_session`.
  - Free-text search across `institution_id`, `kyc_id`, `metadata->>'session_id'`, `metadata->>'verification_id'`.
  - Date range (last 24h / 7d / 30d / custom).
- Table columns: timestamp, actor, event, target ID, AAL/step-up badge, metadata JSON drawer.
- CSV export.
- Route registered in `src/App.tsx`, gated by `useUserRole('admin')`.
- Add link from existing admin sidebar.

## 4. Webhook Health Alerts & Dashboard

**Schema (one migration):**
- `webhook_health_snapshots` (rollup table, 1-min buckets): `bucket_start`, `source`, `total`, `success`, `manual_review`, `dedup_skipped`, `failed`.
- `admin_alert_rules` extension row for `step_up_denied_spike` + `webhook_manual_review_spike` thresholds (default: >10 in 15min).

**Edge functions:**
- `webhook-health-rollup` (cron, every minute) — aggregates `youverify_webhook_events` + `audit_logs` into snapshots, fires `admin_alerts` rows when thresholds exceeded.
- Cron via `pg_cron` insert (per cron-jobs-setup guide).

**UI:**
- `src/pages/admin/WebhookHealthDashboard.tsx` at `/admin/webhook-health`:
  - KPI cards: last-hour ingestion, success %, manual review %, dedupe %, p95 lag.
  - Sparkline (recharts) of last 24h buckets per source.
  - Active alerts list (from `admin_alerts` filtered to webhook rule types).
  - Idempotency stats from `kyc_gateway_idempotency` (hits, conflicts, oldest pending).

## Technical Details

- **Step-up retry contract**: edge functions already return `{ error: 'STEP_UP_REQUIRED', code: 'STEP_UP_REQUIRED' }` with 401. Client checks both `response.error?.code` and parsed body to detect.
- **Audit viewer perf**: index `audit_logs(event_type, created_at desc)` already exists; add partial index `WHERE event_type IN ('step_up_denied','manual_review')` if migration shows missing.
- **Alerts**: reuse existing `admin_alerts` table + existing notification fanout (no new email infra).
- **No backend behaviour changes** to the three admin functions — they already emit the right audit rows; this work consumes them.

## Out of Scope

- Re-enrolling MFA factors (link out to existing `/security/mfa`).
- Push/SMS step-up — TOTP only for v1.
- Backfilling historical webhook health buckets.

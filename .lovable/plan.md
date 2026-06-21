# Promise to Pay — Phase 2

Surgical, additive build on top of the existing PTP module. No renames, no schema removals.

## 1. Notifications & email alerts

**In-app (app_notifications):** insert a row from `ptp-ops` (create, reschedule, cancel) and `ptp-settle` (partial, kept, broken via sweep). Notification types: `ptp_created`, `ptp_partial`, `ptp_rescheduled`, `ptp_swept`, `ptp_broken`. Payload: `{ promise_id, loan_id, amount, currency, due_date, status }`. Wired into existing `useNotifications` hook — no UI changes required, badge updates automatically.

**Email alerts (app emails via Lovable Emails):**
- Prerequisite check: `email_domain--check_email_domain_status`. If no domain → show setup dialog and stop. If domain exists → continue.
- Run `setup_email_infra` if missing, then `scaffold_transactional_email` if missing.
- New React Email templates in `supabase/functions/_shared/transactional-email-templates/`:
  - `ptp-created.tsx` — confirmation + promised amount/date
  - `ptp-partial.tsx` — payment received, remaining balance
  - `ptp-rescheduled.tsx` — new date, credit impact note
  - `ptp-broken.tsx` — broken notice + credit penalty applied
  - `ptp-kept.tsx` — promise fulfilled, positive credit note
- Register in `registry.ts`.
- `ptp-ops` and `ptp-settle` invoke `send-transactional-email` with idempotency keys like `ptp-<event>-<promise_id>`.
- Respect `notification_preferences` (skip email if user opted out).

## 2. Admin backend screen

New route `/admin/promise-to-pay` (admin-only via `useIsAdmin`).

**Features:**
- Search by user email, loan ID, promise ID, status
- Filters: status (pending/kept/partial/broken/cancelled/rescheduled), date range, currency, amount range
- Sortable table: promise ID, customer, loan, amount, promised date, status, kept amount, created
- Row actions (with confirm dialog + reason field):
  - **Cancel promise** — sets status `cancelled`, no credit impact
  - **Reschedule** — new date picker, writes audit row
  - **Override credit event** — pick event type to reverse/insert (admin-only), writes to `credit_events` with `source='admin_override'` and reason
- Detail drawer: full event timeline from `promise_to_pay_events` + linked `credit_events`
- Every admin action writes to `promise_to_pay_events` AND `audit_logs` with admin user id, action, before/after, reason

**Edge function:** new `ptp-admin-ops` (verify admin role via `has_role`) handling cancel/reschedule/override-credit. Reuses existing `ptp-ops` logic where possible.

## 3. OpenAPI spec updates

Bump `info.version` per Standing Order 6 (minor: 4.49.0 → 4.50.0 — additive examples + new admin endpoints).

**Add to `public/openapi.yaml` (+ JSON mirror):**
- Full `requestBody` and `responses` examples for:
  - `POST /v1/loans/{id}/promises` (create) — request: amount, date, method, idempotency_key; response: full promise object
  - `GET /v1/loans/{id}/promises` (list)
  - `POST /v1/promises/{id}/reschedule` — request: new_date, reason
  - `POST /v1/promises/{id}/cancel`
  - Internal `POST /v1/promises/settle` (ptp-settle) — request: loan_payment_id, amount; response: matched promise + status
- Admin endpoints (tagged `Admin`):
  - `GET /v1/admin/promises` (search/filter)
  - `POST /v1/admin/promises/{id}/override-credit`
- New error codes in RFC 7807 catalogue: `ptp_amount_exceeds_outstanding`, `ptp_already_settled`, `ptp_not_found`.
- Cite standards in description: FAPI-1.0-ADV, RFC 7807.
- Snapshot history file + signatures via existing `snapshot-openapi-history.mjs` workflow.

## 4. Expanded E2E coverage

**New Deno tests in `supabase/functions/ptp-ops/index.test.ts` and new `ptp-settle/index.test.ts`:**
- Idempotency: same `idempotency_key` returns the same promise, no duplicates
- Reschedule chain: create → reschedule → reschedule again → assert `ptp_rescheduled_repeat` rule fires (-5)
- Multiple repayments same day: 3 partial payments → assert single `ptp_kept` (not 3) once cumulative ≥ promised
- Sweep + credit math: create overdue → run sweep → read `credit_scores` before/after → assert delta = -25 exactly
- Cancel after partial → asserts no broken event fires later

**New Playwright spec `e2e/authenticated/promise-to-pay-extended.spec.ts`:**
- Admin search/filter/cancel/override flow
- Notification badge appears after PTP create
- Email log row appears in `email_send_log` for each event

**New workflow `.github/workflows/ptp-e2e.yml`** running both suites on PR.

## Technical details

```text
Files created:
- supabase/functions/ptp-admin-ops/index.ts
- supabase/functions/ptp-admin-ops/index.test.ts
- supabase/functions/ptp-settle/index.test.ts
- supabase/functions/_shared/transactional-email-templates/ptp-{created,partial,rescheduled,broken,kept}.tsx
- src/pages/admin/PromiseToPayAdmin.tsx
- src/components/admin/ptp/{PtpTable,PtpFilters,PtpDetailDrawer,PtpActionDialog}.tsx
- e2e/authenticated/promise-to-pay-extended.spec.ts
- .github/workflows/ptp-e2e.yml

Files modified:
- supabase/functions/ptp-ops/index.ts (insert notifications + invoke email)
- supabase/functions/ptp-settle/index.ts (same)
- supabase/functions/_shared/transactional-email-templates/registry.ts
- src/App.tsx (admin route)
- src/pages/admin/AdminDashboard.tsx (nav link)
- public/openapi.yaml + public/openapi.json
- src/config/version.ts (4.50.0)

Migrations:
- None to existing PTP tables. Optional: add `admin_override` to credit_events source enum if not already present.
```

## Rollout order

1. Email prerequisite check → infra/scaffold if needed
2. Templates + registry
3. Wire notifications + email into existing edge functions
4. Admin edge function + DB grants check
5. Admin UI
6. OpenAPI bump + examples + history snapshot
7. Tests (Deno + Playwright) + workflow
8. Run linter + edge function tests

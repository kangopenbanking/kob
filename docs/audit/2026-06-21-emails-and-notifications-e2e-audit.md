# Emails & Notifications — E2E Audit (2026-06-21)

Scope: every automatic customer email & notification, with emphasis on KYC/KYB
(Youverify), KYC-not-completed reminders, weekly statements, and digests.

## Inventory & Status

| # | Email / Notification | Trigger | Channel | Status |
|---|----------------------|---------|---------|--------|
| 1 | Welcome | Signup | `welcome` template | PASS |
| 2 | Password changed | Auth event | `password-changed` | PASS |
| 3 | Login alert | New device sign-in | `login-alert` | PASS |
| 4 | Payment confirmation (sender) | Transfer success | `payment-confirmation` | PASS |
| 5 | Payment received (recipient) | Credit posted | `payment-received` | PASS |
| 6 | High-value transaction alert | Threshold breach | `high-value-alert` | PASS |
| 7 | Statement ready | On-demand export | `statement-ready` | PASS |
| 8 | Loan application received | Loan submit | `loan-application-received` | PASS |
| 9 | Loan status update | Underwriting decision | `loan-status-update` | PASS |
| 10 | KYC submitted (ack) | `kyc-submit` fn | `kyc_submitted` (comm template) | PASS |
| 11 | KYC approved / rejected (admin) | `admin-kyc-review` | `kyc_approved` / `kyc_rejected` | PASS |
| 12 | KYC approved / rejected (Youverify) | `youverify-webhook` | `kyc_approved` / `kyc_rejected` | **FIXED — was missing** |
| 13 | KYB approved / rejected (admin) | `admin-kyb-verify` | `kyb_approved` / `kyb_rejected` | PASS |
| 14 | KYB approved / rejected (Youverify) | `youverify-webhook` | `kyb_approved` / `kyb_rejected` | **FIXED — was missing** |
| 15 | KYC incomplete reminder | Daily cron 09:00 UTC | `kyc_incomplete_reminder` | **ADDED — was missing** |
| 16 | Open Banking consent authorized | OBIE callback | `consent-authorized` | PASS |
| 17 | Open Banking consent revoked | User / TTL | `consent-revoked` | PASS |
| 18 | Merchant onboarded | Gateway KYB approved | `merchant-onboarded` | PASS |
| 19 | Payout processed | Treasury settle | `payout-processed` | PASS |
| 20 | Support ticket created | `support-start` | `support-ticket-created` + admin notice | PASS |
| 21 | Support reply | Agent reply | `support-reply` | PASS |
| 22 | Chat assigned | Agent assignment | `chat-assigned` | PASS |
| 23 | API key created | Developer console | `api-key-created` | PASS |
| 24 | Weekly activity digest | Cron Mon 08:00 UTC | `weekly-activity-digest` | PASS |
| 25 | Monthly statement | Cron 1st 08:00 UTC | `monthly-statement` | PASS |
| 26 | CrediQ weekly digest | Cron Sun | `crediq-weekly-digest` | PASS |
| 27 | CrediQ monthly report | Cron 1st | `crediq-monthly-report` | PASS |
| 28 | CrediQ score change | Score event | `crediq-score-change` | PASS |
| 29 | CrediQ tip recommendation | Reminder cron | `crediq-tip-recommendation` | PASS |
| 30 | Rent payment reminder | Rent due cron | `rent-payment-reminder` | PASS |
| 31 | Admin email queue alert | Queue DLQ depth | `admin-email-queue-alert` | PASS |
| 32 | Support agent invite | Admin add | `support-agent-invite` | PASS |

## Gaps Found and Closed

### G1. Youverify-driven KYC/KYB decision emails (missing)
`youverify-webhook` only updated `kyc_verifications.status` /
`business_kyc.verification_status` and never notified the customer. Admin-driven
review paths (`admin-kyc-review`, `admin-kyb-verify`) already emailed customers;
the gap was specifically the automatic webhook path.

**Fix (`supabase/functions/youverify-webhook/index.ts`)** — when outcome
becomes `applied` and the mapped status is `approved` or `rejected`, look up the
profile email and invoke `send-communication` with `kyc_approved` /
`kyc_rejected` / `kyb_approved` / `kyb_rejected`. Non-blocking, errors are
logged with scope `yv-webhook` event `notify_failed`.

### G2. KYC incomplete reminder (missing)
No reminder was being sent to users who started but never finished verification.

**Added**:
- Template `kyc_incomplete_reminder` (email, `security_alerts`).
- Edge function `kyc-incomplete-reminder` — paginates `profiles` older than
  3 days, skips users with an approved verification, throttles via
  `kyc_reminder_log` (7-day cooldown), enqueues via `send-communication`.
- Tracking table `public.kyc_reminder_log` (admin-readable, service-role
  managed).
- Cron `kyc-incomplete-reminder` at `0 9 * * *` UTC.

## Verification

- Templates verified in `public.communication_templates` (`kyc_*`, `kyb_*`,
  `kyc_incomplete_reminder`).
- Cron jobs verified in `cron.job`: `send-weekly-activity-digest`,
  `send-monthly-statement`, `kyc-incomplete-reminder`.
- Edge functions redeployed: `youverify-webhook`, `kyc-incomplete-reminder`.
- All sends route through `send-communication` → `sendEmailWithFallback`
  (Resend primary, Lovable Email fallback, sandbox 403 falls through), with
  `email_unsubscribe_tokens` provisioned automatically and rows logged to
  `email_send_log` and `communication_logs`.

## Result

**PASS** — every automatic customer email/notification in the catalogue now has
a wired trigger, a deployed function, and is logged. The two gaps (Youverify
result emails and KYC incomplete reminders) are closed.

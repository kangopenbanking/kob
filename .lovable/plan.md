## Why the alert is firing

Critical bounce-rate alerts come from `email-queue-alerts` (threshold: >5% bounces+complaints of last 24h, min 20 sends). Every recent permanent bounce is an outbound "Complete your identity verification" email sent to a **synthetic address** created for phone-only signups:

- `*@phone.kob.cm` — phone-signup pseudo-emails
- `*@kang.id` — auto-generated placeholder IDs
- `*@example.com`, `*.local` — reserved/test domains
- Plus one user typo (`.con`).

None of these mailboxes exist, so Mailgun returns permanent bounces. Suppression works correctly *after* the bounce, but the emails should never have been enqueued.

## Fix

### 1. Block synthetic recipients at the sender (`send-transactional-email`)
Add a pre-flight guard that rejects (with a logged `suppressed` row, not `dlq`) any recipient whose address matches:
- ends with `@phone.kob.cm`, `@kang.id`, `@no-email.local`, `.local`
- domain is `example.com`, `example.org`, `example.net`, `test`, `invalid`, `localhost`
- fails a basic RFC-ish regex

Return `{ suppressed: true, reason: 'synthetic_recipient' }` so callers can tell it apart from a real send.

### 2. Guard the KYC verification trigger
Find the caller enqueuing the "Complete your identity verification" email (likely a cron or KYC-reminder function). Before invoking `send-transactional-email`, skip users whose `profiles.email` matches the synthetic patterns above OR whose email is already in `suppressed_emails`. Only email users with a verified, real address.

### 3. One-off cleanup
Insert the 6 currently-bouncing addresses into `suppressed_emails` explicitly with reason `synthetic_recipient` (they're already there from the bounce, but tag the metadata so the dashboard shows the true cause). Also add a suppression entry for the `.con` typo so retries stop.

### 4. Bounce-rate metric hygiene
Update `email-queue-alerts` bounce-rate calculation to **exclude** sends where `error_message` / suppression reason is `synthetic_recipient`. Real deliverability to real inboxes is what we want to monitor; synthetic-address bounces are a data-quality issue, not a reputation issue. Keep the 5% threshold.

### 5. Dashboard surfacing (optional but recommended)
On `/admin/email-provider-settings` (or the email dashboard), add a "Synthetic recipients blocked (24h)" stat next to bounce rate so admins can see the guard is working.

## Files to touch

- `supabase/functions/send-transactional-email/index.ts` — pre-flight synthetic-recipient guard
- `supabase/functions/email-queue-alerts/index.ts` — exclude synthetic bounces from rate
- KYC reminder trigger (to be located; likely `supabase/functions/kyc-*` or a cron) — filter recipients before enqueue
- One-shot SQL: tag existing 6 suppressed rows + add `.con` typo suppression
- Optional: `src/pages/admin/EmailProviderSettings.tsx` (or equivalent) — new stat card

## Verification

1. Deploy `send-transactional-email` and retry a KYC reminder run — no new synthetic bounces in `email_send_log`.
2. Query `email_send_log` bounce rate over next 24h → drops below 5%.
3. `email-queue-alerts` next scheduled run → no `email_bounce_rate_high` insert.
4. Confirm real users still receive KYC emails (send test to `kangopenbanking@gmail.com`).

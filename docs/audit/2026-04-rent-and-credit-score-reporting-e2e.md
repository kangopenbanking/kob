# Rent Reporting & Credit Score Reporting — End-to-End Audit Report

**Date:** 2026-04-20
**Scope:** Consumer PWA `/app/rent-reporting` and `/app/credit` (CrediQ) including all backing edge functions, cron jobs, credit-event emission, in-app notifications, and email channels.
**Status:** ✅ All gaps resolved (4 production gaps closed, 1 enhancement shipped)

---

## Executive Summary

Audited the **Rent Reporting** and **Credit Score Reporting** flows of the Consumer PWA — front-end pages, the `piggybank` edge function (handles rent plans of `plan_type='rent'`), the `credit-score-engine` deterministic scorer, the `credit-recompute` user trigger, the `crediq-reminders` cron, and the email template registry.

Found **4 production gaps** ranging from HIGH (front-end bypassing the server-side validator) to LOW (no due-date reminders for upcoming rent). All gaps fixed and the system now provides full pre-due, on-due, and overdue reminders via in-app notifications and email, with a rent-specific email template.

---

## Architecture Overview

### Rent Reporting Flow

```
User /app/rent-reporting
   │
   │ ① Setup plan
   ▼
piggybank?action=create  ──►  piggybank_plans (plan_type='rent', rent_reference=KRENTSxxxx)
                          ──►  piggybank_payments (12-month schedule, status='pending')
   │
   │ ② Record payment (PIN-confirmed)
   ▼
piggybank?action=pay
   ├─► piggybank_payments.status = paid|late
   ├─► credit_events insert (RENT_PAYMENT_ON_TIME / RENT_PAYMENT_LATE)
   ├─► credit-score?action=engine  ──► credit_profiles + credit_score_snapshots
   └─► app_notifications insert     ──► realtime to user (NEW)

   │ ③ Daily overdue cron
   ▼
piggybank?action=overdue-detect (cron)
   ├─► piggybank_payments.status = missed
   ├─► credit_events insert (RENT_PAYMENT_MISSED, -30 pts)
   └─► app_notifications insert (NEW)

   │ ④ Daily reminder cron (NEW)
   ▼
rent-payment-reminders (cron)
   ├─► For each pending rent payment due in {3,1,0,-1,-3,-7} days:
   ├─► app_notifications insert (always)
   └─► send-transactional-email → rent-payment-reminder template (gated by prefs)
```

### Credit Score Reporting Flow

```
User /app/credit
   │
   ├─► useCustomerCreditScore hook → credit-score-fetch
   │    └─► credit_profiles + credit_score_snapshots
   │
   ├─► Refresh button → credit-recompute (rate-limited 1/min)
   │    └─► credit-score-engine (deterministic, event-sourced)
   │
   └─► crediq-reminders (cron, daily)
        ├─► weekly-digest (Mondays)
        ├─► monthly-report (1st)
        ├─► score-change alert (any |Δ| ≥ 10 pts in last 24h) → crediq-score-change email
        └─► tip-recommendation (Wednesdays, premium only)
```

---

## Gaps Found & Resolved

### Gap #1 — Rent Setup Bypassed Server Validation (HIGH)

**File:** `src/pages/customer-app/CustomerRentReporting.tsx`
**Problem:** `handleSetupRentPlan()` performed a direct `supabase.from('piggybank_plans').insert(...)` from the client. Consequences:
- **No payment schedule** was generated — `piggybank_payments` rows were never inserted, so the rent dashboard always showed "0 upcoming payments" until the user manually re-created the plan via another flow.
- **KRENTS reference collision risk** — the client generated `KRENTSxxxx` randomly without uniqueness retry; the unique index would have surfaced as an obscure 23505 error to the user.
- **No auto-fund validation** — bypassed the wallet-account ownership check.
- **Inconsistent with the rest of the system** (`piggybank?action=create` is the canonical creator).

**Fix:** Replaced the direct insert with `supabase.functions.invoke('piggybank', { body: { action: 'create', plan_type: 'rent', ... } })`. The function returns `rent_reference`, generates the 12-month schedule, and applies all server-side validation.

### Gap #2 — No In-App Notification on Rent Payment Recorded (MEDIUM)

**File:** `supabase/functions/piggybank/index.ts` (`handlePay`)
**Problem:** Recording a rent payment fired only a `toast.success(...)` on the client. There was no persistent notification in `app_notifications`, so users browsing notifications later had no record of the payment, no score-impact summary, and no audit trail for late/on-time outcomes.

**Fix:** When `plan_type === 'rent'`, insert an `app_notifications` row with:
- `type: success | warning` based on on-time vs. late
- Title: `Rent payment recorded` or `Rent payment recorded (late)`
- Message including the score delta and plan name
- Metadata: `{ payment_id, plan_id, rent_reference, score_delta, new_score }`

### Gap #3 — No In-App Notification on Missed Rent (MEDIUM)

**File:** `supabase/functions/piggybank/index.ts` (`handleOverdueDetect`)
**Problem:** The daily overdue cron silently flipped rent payments to `missed` and applied a -30 pt credit hit. Users had no in-app signal until they noticed the score drop in their next score-change email (cron-gated, ≥10pt threshold).

**Fix:** When the overdue cron flips a rent payment to `missed`, also insert a `warning` notification ("Missed rent payment") with the credit impact and a deep-link payload, so users can see the event in real time and immediately record the late payment to limit further damage.

### Gap #4 — No Due-Date Reminders for Upcoming Rent (HIGH for UX)

**Problem:** There was no proactive reminder before a rent payment fell due. Users received no nudge at T-3, T-1, on-due, or even after going overdue (until the once-and-done -30 pt penalty fired). This is the single biggest preventable cause of credit-score regression in the Rent Reporting feature.

**Fix:** Two new artifacts:

1. **`supabase/functions/_shared/transactional-email-templates/rent-payment-reminder.tsx`** — branded React-email template with three variants (early warning, due-today, overdue), formatted amount, KRENTS reference, due date, and CTA to `/app/rent-reporting`.

2. **`supabase/functions/rent-payment-reminders/index.ts`** — daily cron (`verify_jwt = false`, `verifyCronAuth` gated) that for every active rent plan finds pending payments with `due_date ∈ {today+3, today+1, today, today-1, today-3, today-7}` and:
   - Inserts an in-app notification (`info` for upcoming, `warning` for overdue) — always sent, cron-deduped via `crediq_reminder_log` (`reminder_type='rent_payment'`, `period_key={payment_id}-{offset}-{date}`).
   - Sends a transactional email via `send-transactional-email` using the new template — gated by `crediq_email_preferences.score_change_alerts` (proxy preference; rent reminders are credit-affecting events).

Registry updated to expose `rent-payment-reminder` to `send-transactional-email`. `supabase/config.toml` updated to register the new function.

---

## Verified Flows (No Issues Found)

### Rent Reporting
- ✅ `piggybank?action=create` (rent): generates 12-month schedule, retries up to 10× to find a unique KRENTS reference, validates `auto_fund_account_id` ownership.
- ✅ `piggybank?action=pay` (rent): writes `RENT_PAYMENT_ON_TIME` / `RENT_PAYMENT_LATE` to `credit_events` with correct `value_numeric` (`days_late` for late events — verified per Mar 2026 audit Gap #4), invokes `credit-score?action=engine`, updates `piggybank_payments.credit_event_id`.
- ✅ `piggybank?action=overdue-detect` (cron, rent): writes `RENT_PAYMENT_MISSED` (-30 pts), flips status to `missed`, recomputes score.
- ✅ Front-end: Active plans show payments-paid / pending / streak counts, overdue badge, three pending-payment "Record" buttons with PIN confirmation, payment history with on-time/late point markers, KRENTS reference shown prominently.
- ✅ RLS: `piggybank_plans` and `piggybank_payments` enforce `auth.uid() = user_id` for SELECT/INSERT/UPDATE.

### Credit Score Reporting
- ✅ `credit-recompute`: rate-limited to 1/min/user, returns score+band+delta+factors, error-id'd internal errors.
- ✅ `credit-score-engine`: scoring rules table includes all rent + savings + njangi + loan + PostiQ events with correct min/max bands.
- ✅ `crediq-reminders` cron: weekly digest (Mondays), monthly report (1st), score-change alert (|Δ|≥10 in 24h, deduped per `period_key`), tip recommendations (Wednesdays, premium only).
- ✅ `crediq-score-change` email template: live, sends on score moves of ≥10 pts.
- ✅ `crediq_email_preferences`: per-user toggles for each channel; row auto-created via `ensure_crediq_email_preferences` trigger.
- ✅ Front-end `/app/credit`: gauge, 5 weighted score factors, recent credit events feed, "Boost Your Score" proposals (PostiQ / Piggy Bank / Njangi / Rent reporting) — already wired and conditional on what the user has set up.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/customer-app/CustomerRentReporting.tsx` | Rent setup now invokes `piggybank?action=create` instead of direct DB insert |
| `supabase/functions/piggybank/index.ts` | `handlePay` and `handleOverdueDetect` now insert `app_notifications` rows for rent events |
| `supabase/functions/_shared/transactional-email-templates/rent-payment-reminder.tsx` | **NEW** — branded reminder email (3 variants: T-N, due today, overdue) |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Registered `rent-payment-reminder` |
| `supabase/functions/rent-payment-reminders/index.ts` | **NEW** — daily cron, scans pending rent payments at offsets {+3, +1, 0, -1, -3, -7} days |
| `supabase/config.toml` | Registered `[functions.rent-payment-reminders]` with `verify_jwt = false` |

---

## Operational Notes

### Cron Registration

Add the new reminder cron to your `pg_cron` schedule (run daily at 09:00 UTC):

```sql
select cron.schedule(
  'rent-payment-reminders-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/rent-payment-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', current_setting('app.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
```

### Manual Trigger / Backfill

```bash
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/rent-payment-reminders \
  -d '{}'
```

For a single user dry-run:
```bash
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/rent-payment-reminders \
  -d '{"user_id":"<uuid>"}'
```

### Dedupe Guarantees

The reminder cron writes a `crediq_reminder_log` row with a unique `period_key = {payment_id}-{offset_label}-{date}`. Re-running the same day for the same payment is a no-op (handled by unique-violation catch).

### Preference Map

| Preference (table `crediq_email_preferences`) | Controls |
|-----------------------------------------------|----------|
| `score_change_alerts` | crediq-score-change email **and** rent-payment-reminder email |
| `weekly_digest` | crediq-weekly-digest |
| `monthly_report` | crediq-monthly-report (premium-gated) |
| `tips_recommendations` | crediq-tip-recommendation (premium-gated) |

In-app notifications for rent events are NOT gated — they are operational alerts, not marketing.

---

## Test Matrix

| Scenario | Expected outcome | Source |
|----------|------------------|--------|
| Create rent plan with `amount=75000`, `frequency=monthly` | 12 `piggybank_payments` rows created, unique KRENTS ref returned | `piggybank?action=create` |
| Record on-time payment | `RENT_PAYMENT_ON_TIME` event, +5 to +10 score, `success` notification | `piggybank?action=pay` |
| Record payment 5 days late | `RENT_PAYMENT_LATE` event, ~-13 to -25 score, `warning` notification | `piggybank?action=pay` |
| Cron at T+1 of due date with no payment | `RENT_PAYMENT_MISSED` event, -30 score, `warning` notification | `piggybank?action=overdue-detect` |
| Cron at T-3 from due date | In-app notif "due in 3 days" + email if pref=true | `rent-payment-reminders` |
| Cron at T-3 again same day | Skipped (dedupe via `crediq_reminder_log`) | `rent-payment-reminders` |
| Score moves ≥10 pts in 24h | crediq-score-change email | `crediq-reminders` |
| Manual recompute pressed twice in 30s | First succeeds, second 429 with retry-after | `credit-recompute` |

---

## Out-of-Scope / Future Enhancements

- Push notifications for the same rent reminders (current spec ships in-app + email; would require subscribing this cron to `push-notification` after a `web_push_subscriptions` row is present).
- A "Cancel rent plan" UI on `/app/rent-reporting` (the API supports it via `piggybank?action=cancel` with a -5 pt penalty; UI control not yet added).
- A `crediq_email_preferences.rent_payment_reminders` dedicated toggle (currently piggybacks on `score_change_alerts`).

— End of report —

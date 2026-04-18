# Phase 27 — Recurring Payments: Salary & P2P (Kang User) Audit

**Date:** 2026-04-18
**Scope:** Consumer App (`/app/recurring`)
**Status:** ✅ Complete — 5 critical gaps closed

## Executive Summary

The Consumer App's recurring payments feature stored payment definitions but
**never executed them**. The hourly cron (`recurring-payments-hourly`) was
already scheduled in `pg_cron`, but the target edge function did not exist —
all due payments were silently ignored. Additionally, the feature only
supported generic bill payments. There was no way to schedule salary/income
tracking or recurring P2P transfers to another Kang user.

## Findings & Fixes

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| **F1** | 🔴 Critical | `recurring-payments-cron` edge function was missing — `pg_cron` job called a non-existent endpoint hourly. Recurring payments never ran. | Created `recurring-payments-cron` that picks up all due active payments, routes by `payment_type`, and advances `next_payment_date`. |
| **F2** | 🟠 High | No "Salary" payment type. Users couldn't track expected income. | Added `salary` payment type. Cron generates a "Salary Expected" notification on each due date. Salary entries are tracked-only (no debit). |
| **F3** | 🟠 High | No P2P recurring transfers between Kang users. | Added `p2p` payment type. Includes recipient lookup (`search_profiles_by_name`), source/destination account selection, and execution via `api-transfers`. |
| **F4** | 🟡 Medium | No `payment_type` discriminator — cron couldn't route execution. | Added `payment_type` column with trigger validation (`bill | salary | p2p`). |
| **F5** | 🟡 Medium | No execution audit trail (last run, status, error). | Added `last_run_at`, `last_run_status`, `last_run_error`, plus `payments_made` increments. |

## Schema Changes

```sql
ALTER TABLE recurring_payments ADD COLUMN
  payment_type text DEFAULT 'bill',
  recipient_user_id uuid,
  recipient_name text,
  recipient_phone text,
  source_account_id uuid,
  destination_account_id uuid,
  last_run_at timestamptz,
  last_run_status text,
  last_run_error text,
  notes text;
```

- **Trigger** `validate_recurring_payment` enforces `payment_type` enum and
  requires `recipient_user_id` for `p2p`.
- **Indexes** on `(next_payment_date) WHERE is_active=true` and
  `(recipient_user_id)` for cron + recipient lookups.

## Cron Processor (`recurring-payments-cron`)

Runs hourly. For each due payment:
1. Auto-deactivates if past `end_date`.
2. **Bill** → notification only (user pays manually via existing flows).
3. **Salary** → "Salary Expected" notification (income tracking).
4. **P2P** → invokes `api-transfers` with stored source/destination accounts.
5. Advances `next_payment_date` per frequency, records `last_run_*`.

## UI Changes

`CustomerRecurring.tsx`:
- Step 1 selector: **Bill | Salary | Send to Kang user**
- For Salary: category becomes "Income"; no execution, only tracking.
- For P2P: recipient search by name, account picker for source.
- Existing Bill flow preserved (no regression).

## E2E Test Steps

1. **Bill**: Create "ENEO Electricity" Monthly → appears in list, cron logs notification on due date.
2. **Salary**: Create "Monthly Salary" 500,000 XAF Monthly → appears with "Income" category, due-date notification fires.
3. **P2P**: Search Kang user, pick source account → cron invokes `api-transfers`, recipient receives funds.
4. **Toggle**: Pause/resume works for all three types.
5. **End date**: Past `end_date` auto-deactivates entry on next cron tick.

## Files Touched

- `supabase/migrations/<timestamp>_phase27_recurring_payments.sql` (new)
- `supabase/functions/recurring-payments-cron/index.ts` (new)
- `supabase/functions/recurring-payment-create/index.ts` (extended)
- `src/pages/customer-app/CustomerRecurring.tsx` (extended UI)

## Compliance

- ✅ RLS unchanged — users only see their own entries.
- ✅ P2P transfers reuse audited `api-transfers` (atomic, ledger-backed).
- ✅ All money-moving operations log `last_run_status` for auditability.
- ✅ Notifications respect user `notify` flag.

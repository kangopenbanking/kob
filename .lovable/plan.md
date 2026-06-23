## Promise to Pay (PTP) — E2E Audit + Missed-Payment Fee Enhancement

### 1. Audit findings (current state)

**Working today**
- Tables: `promise_to_pay`, `promise_to_pay_events` (with RLS, status check constraints, idempotency_key, reschedule chain).
- Edge functions: `ptp-ops` (create/list/cancel/reschedule), `ptp-settle` (`mode=match` + `mode=sweep`), `ptp-admin-ops` (list/detail/cancel/reschedule/override-credit). Shared `ptp-notify.ts` + `ptp-webhook.ts`.
- Loan repayment path (`loan-ops`) calls `ptp-settle?mode=match` after every repayment — confirmed.
- Credit-score integration: `ptp_created / kept / partial / broken / rescheduled / rescheduled_repeat` events recorded (idempotent on promise_id).
- Admin dashboard (`/admin/promise-to-pay`), banking flow (`/app/bank/more/loans/promise`), customer summary (`/app/customer/promise-to-pay`) all wired.
- Deno tests exist for `ptp-ops` and `ptp-settle`.

**Gaps identified**
1. **No missed-payment fee anywhere.** Sweep marks promise `broken`, fires credit penalty (-25) and notification, but does NOT debit the customer / increase loan outstanding / record a `transaction_fees` or journal entry. Bank cannot configure a fee.
2. **No reminder dispatcher.** Event enum includes `reminder_sent` but nothing emits it (no T-3 / T-1 / due-day reminders).
3. **`loan_schedule` not linked.** PTP is free-form (amount + date) — no FK to a specific installment, so multiple PTPs for the same instalment can be created and the schedule isn't updated on `kept`.
4. **Currency mismatch.** Banking flow hard-codes `GBP`; rest of the platform uses `XAF` / loan account currency. Cosmetic but causes wrong symbols in totals.
5. **Sweep is not scheduled.** No `pg_cron` job calling `ptp-settle?mode=sweep` — overdue PTPs never auto-break.
6. **Customer/admin UIs don't surface fee, penalty, or remaining balance change.**
7. **No webhook event for `ptp.fee_charged`** (so external integrators miss the bank-side debit).

### 2. Enhancement — bank-configurable missed-payment fee

**Scope decision:** configure at the **loan_products** level (per-institution, per-product). This is the existing per-institution lending config table, keeps fees consistent across all loans of that product, and avoids a new top-level table. (Recommended — confirm or override.)

**Additive schema changes (backwards-compatible, no destructive ops)**

```sql
ALTER TABLE public.loan_products
  ADD COLUMN ptp_missed_fee_enabled  boolean        NOT NULL DEFAULT false,
  ADD COLUMN ptp_missed_fee_type     text           NOT NULL DEFAULT 'fixed'
    CHECK (ptp_missed_fee_type IN ('fixed','percentage')),
  ADD COLUMN ptp_missed_fee_value    numeric(18,4)  NOT NULL DEFAULT 0
    CHECK (ptp_missed_fee_value >= 0),
  ADD COLUMN ptp_missed_fee_cap      numeric(18,2),  -- optional max for % fees
  ADD COLUMN ptp_missed_fee_grace_days int NOT NULL DEFAULT 1;

ALTER TABLE public.promise_to_pay
  ADD COLUMN missed_fee_amount       numeric(18,2),
  ADD COLUMN missed_fee_currency     text,
  ADD COLUMN missed_fee_type         text,      -- snapshot of fixed/percentage
  ADD COLUMN missed_fee_charged_at   timestamptz,
  ADD COLUMN missed_fee_reference    text;      -- payment_reference of the debit
```

Plus extend the `promise_to_pay_events.event_type` CHECK to allow `fee_charged` and `fee_waived` (additive — Standing Order 4 Surgeon Rule).

### 3. Sequenced implementation steps

| # | Step | Test gate before moving on |
|---|------|----------------------------|
| 1 | Migration: add 5 cols to `loan_products`, 5 cols to `promise_to_pay`, expand events check, add `ptp.fee_charged` webhook event type. | `SELECT` confirms columns + check accepts new events. |
| 2 | Build shared helper `supabase/functions/_shared/ptp-fee.ts` — `computeMissedFee(product, missedAmount, currency)` returning `{amount, type, capped}`. Unit tested via deno. | New `ptp-fee.test.ts` passes 4 cases (disabled / fixed / percentage / capped). |
| 3 | Extend `ptp-settle?mode=sweep` (and the direct `broken` branch of `match`) to: (a) fetch loan + product, (b) compute fee, (c) insert `transaction_fees` row + bump `loan_accounts.penalty_charges` and `outstanding_balance` atomically, (d) write `promise_to_pay_events.fee_charged`, (e) update PTP `missed_fee_*` cols, (f) dispatch `ptp.fee_charged` webhook, (g) notify customer with fee included. Fee step is idempotent on `promise_id`. | Re-running sweep on the same promise does NOT double-charge. Existing `ptp-settle/index.test.ts` continues to pass. |
| 4 | Schedule pg_cron daily `ptp-settle?mode=sweep` (uses `insert` tool, project-specific) at 02:00 UTC. | `cron.job` row present; manual invoke green. |
| 5 | Admin UI: new "Fee policy" tab on `/admin/promise-to-pay` listing loan products with inline edit (enabled toggle, type, value, cap, grace days). Saves via tiny `loan-products-ops?action=update_ptp_fee` action (or extends existing loan-products edge function — check first, do not duplicate). | Toggling persists, reload shows value, RLS prevents non-admin write. |
| 6 | Banking PromiseToPay screen: show "Missed-payment fee" badge with the computed projected fee at the Review step (informational, before confirming). Fix GBP → loan account currency. | Manual: create PTP → review shows correct fee preview. |
| 7 | Customer PromiseToPay summary: when `missed_fee_amount IS NOT NULL`, add a "Late fee charged" line with amount + date and surface in History card. | Visible after sweep marks a test promise broken. |
| 8 | Sequential E2E test script `e2e/ptp-missed-fee.spec.ts` (Playwright + service-role seed) covering the 6-step flow: loan → schedule → PTP → miss → sweep → fee applied → UI reflects → webhook fired. Documented PASS/FAIL per step. | All 6 sub-tests PASS before declaring done. |

### 4. Guardrails enforced
- All schema changes additive; no `DROP`, no rename, no destructive ops on existing PTP / loan / payment rows.
- No edits to shared layouts, auth, profile, or unrelated modules.
- `loan-ops` is read but not modified (PTP-settle remains its only PTP touchpoint).
- Webhook event additions and event_type enum additions only ratchet forward (Standing Order 2).
- `ptp.fee_charged` added to `_shared/ptp-webhook.ts` type union, not renaming existing events.
- All new fee math goes through the shared helper — no duplicate logic.

### 5. Deliverables
1. This audit report (above).
2. SQL migration script (Step 1) — backwards-compatible.
3. Fee helper + extended sweep + cron — backend.
4. Admin fee-config UI + customer/banking display — frontend.
5. Sequential E2E test report with PASS/FAIL for each of the 6 stages.

### One decision needed before build
Scope of the fee configuration — please confirm **per loan_product** (recommended) or pick another scope:
- Per loan product (recommended): granular, lives next to interest/late-fee config you already have.
- Per institution: simpler, one rule for all products.
- Per individual loan account: most flexible, but creates ops overhead.

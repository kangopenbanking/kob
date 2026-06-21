
# Promise to Pay — Surgical Add-On to Loans + Credit Score

Adaptive, additive feature (Standing Order 4 — Surgeon Rule). No existing loan, credit, or payment columns are renamed or removed. All new objects are net-new.

## 1. Data model (new migration)

New tables under `public`, all with `GRANT` + RLS + `has_role`-scoped policies:

- `promise_to_pay`
  - `id uuid pk`, `user_id uuid`, `loan_account_id uuid references loan_accounts(id)`
  - `promised_amount numeric`, `promised_date date`, `currency text default 'GBP'`
  - `payment_method text` enum-check: `pay_by_bank | debit_card | bank_transfer | other`
  - `status text` enum-check: `scheduled | partially_kept | kept | broken | cancelled | rescheduled`
  - `kept_amount numeric default 0`, `kept_at timestamptz`, `broken_at timestamptz`
  - `reschedule_of uuid references promise_to_pay(id)` (chain when user "can't keep")
  - `created_at`, `updated_at`, `idempotency_key uuid unique`
- `promise_to_pay_events` — append-only audit (`created | reminder_sent | payment_matched | kept | partial | broken | rescheduled | cancelled`)
- New `credit_events.event_type` values used (table is free-form text): `ptp_created`, `ptp_kept`, `ptp_partial`, `ptp_broken`, `ptp_rescheduled`

Validation trigger (not CHECK) enforces `promised_date >= today` on insert and `promised_amount <= outstanding_balance + penalty_charges`.

## 2. Edge functions (additive)

- `ptp-ops` (new) — single router, `SECURITY DEFINER` helpers, `auth.getUser()`, idempotency keys, `FOR UPDATE` row locks:
  - `POST /create` — creates promise, emits `ptp_created` credit event (no score delta yet).
  - `POST /cancel` — within grace window only.
  - `POST /reschedule` — closes original as `rescheduled`, creates child row, links via `reschedule_of`.
  - `GET /list`, `GET /:id`.
- `ptp-settle` (new, called by existing payment webhooks): when a `loan_payments` row lands while an open promise exists for that loan, atomically match it:
  - amount ≥ promised on/before `promised_date` → `kept`
  - 0 < amount < promised → `partially_kept`
  - none by EOD `promised_date+grace` → `broken`
- `ptp-cron-sweep` (new, scheduled daily via `cron-auth.ts`): finds overdue promises, marks `broken`, emits credit event.
- Hook into existing `pay-by-bank`, `payment-router-charge`, `loan-ops` repayment paths: after successful repayment they call `ptp-settle` (no schema changes to those tables).

All new functions deployed via `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1` per Direct Backend Mandate.

## 3. Credit score integration

Extend `credit-score-engine` rule set additively — new rule rows in `credit_scoring_rules`:

| Event | Delta | Cap |
|---|---|---|
| `ptp_kept` (on time, in full) | +3 | +15 / rolling 90 days |
| `ptp_partial` | +1 | +5 / 90d |
| `ptp_broken` | -25 | uncapped (matches existing missed-payment severity) |
| `ptp_rescheduled` (first time, before due date) | 0 | n/a |
| `ptp_rescheduled` (repeat within 30d) | -5 | -15 / 90d |

Re-uses existing `credit-recompute` pipeline; no change to score range (300–850) or formula weights.

## 4. Consumer app UI (mobile-first, design language: Professional Natural, no gradients, no emojis, outline icons)

Routes under `/app/loans/:loanId/repay`:

1. **Make a payment hub** — mirrors uploaded "All due amounts / Return to credit limit / Statement balance / You decide the amount" cards. Each card is a soft, animated `Card` with chevron, contrast-correct text.
2. **What this payment won't do** — informational sheet (image 1 layout).
3. **Pay by Bank** — primary CTA → triggers existing `pay-by-bank` PISP flow. "Other ways to pay" → debit card / bank transfer (existing rails).
4. **Enter other amount** — keypad screen, numeric input, Continue button (image 3 layout).
5. **Set a Promise to Pay** — date + amount + method picker → confirms with summary sheet.
6. **My Promises** — list of active/past promises with status chips and "I can't keep to my promise" sheet (image 8 layout): Reschedule, Pay now, or Call support.
7. **Credit impact banner** — surfaced on every confirmation, copy: "Keeping this promise can improve your credit. Missing it can harm it." Links to `CreditScore.tsx`.

All flows are smooth multi-step transitions (existing `framer-motion` patterns), Lucide outline icons, no purple/indigo gradients, white-on-pink button text matches existing accent.

## 5. OpenAPI / SDK (Standing Orders 1, 2, 6)

- Bump `info.version` minor (e.g. `4.x.y → 4.(x+1).0`) — additive endpoints only.
- New paths `/v1/loans/{id}/promises`, `/v1/promises/{id}`, `/v1/promises/{id}/reschedule`, `/v1/promises/{id}/cancel`. New `PromiseToPay` schema. Cite **CBP Vulnerable Customer Treatment + FCA CONC 7** in change log.
- Regenerate typed SDKs (Node/Python/PHP) via existing `scripts/generate-typed-sdks.mjs`.
- Update Postman collection + changelog within the 48 h window (Order P7).
- Developer docs page `/developer/guides/promise-to-pay` with cURL + Node + Python examples runnable against sandbox (Order P5, P6, P9).

## 6. E2E coverage (full functionality, no gaps)

Added to CI:

- `e2e/authenticated/promise-to-pay.spec.ts` (Playwright):
  1. Create promise from loan detail screen
  2. Pay full amount on time → status `kept`, credit event recorded, score delta visible
  3. Pay partial → `partially_kept`, +1 event
  4. Skip payment, run `ptp-cron-sweep` → `broken`, -25 event
  5. Reschedule flow + "I can't keep my promise" sheet
- `scripts/ptp-e2e-runner.mjs` — API-level: create → settle → score recompute against sandbox.
- Reuses existing `step-up-e2e` MFA gate for create/cancel.
- New workflow `.github/workflows/ptp-e2e.yml` (mirrors `raas-e2e.yml`).

## 7. Safety / Guardrails

- All financial mutations go through edge functions with idempotency keys + `FOR UPDATE` (project memory: Financial Safety).
- RLS: customer reads/writes only own promises; admin reads via `has_role('admin')`.
- No emoji, no gradient, contrast-correct buttons, consistent fonts (workspace knowledge).
- No changes to `loan_accounts`, `credit_scores`, or existing repayment columns — purely additive.
- Permanent public docs route comment block preserved.

## 8. Rollout order

1. Migration (tables + grants + RLS + trigger)
2. `ptp-ops`, `ptp-settle`, `ptp-cron-sweep` edge functions
3. Wire `pay-by-bank` + `loan-ops` repayment success → `ptp-settle` (single added call each)
4. `credit_scoring_rules` rows + recompute test
5. Consumer UI screens
6. OpenAPI + SDKs + docs + changelog
7. E2E suite green, then publish

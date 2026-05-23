# Budget App — End-to-End Audit & Round-Up Enhancements

Date: 2026-05-23
Owner: Smart Budgeting + Round-Up Savings
Scope: `/app/budget` page, `budgeting-ops` edge function, round-up engine, integration with KOB bank-sourced transactions and CrediQ credit-score engine.

---

## 1. Gap analysis — pre-audit state

| # | Area | Gap | Status |
|---|------|-----|--------|
| 1 | Budget summary | `transaction_count` and `top_merchant` per category were always 0 / null | Fixed |
| 2 | Goal progress | `round_up_total_this_month` always returned 0 | Fixed |
| 3 | Analytics | `/analytics/merchants` returned `[]` (stub) | Fixed — aggregates from `transactions.merchant_details` |
| 4 | Analytics | `/analytics/monthly` returned `[]` (stub) | Fixed — buckets by month + category from `transactions` |
| 5 | Njangi | `/njangi/schedule` returned `[]` (stub) | Fixed — reads `njangi_contributions` |
| 6 | Round-up | `/roundup/process` accepted wallet-only inputs; no bank source attribution | Fixed — added `source_kind`, refactored to `processRoundup()` |
| 7 | Round-up | No filter to gate which sources qualify | Fixed — `roundup_settings.source_filter` (wallet / bank / both) |
| 8 | Round-up | No automatic ingestion of real KOB bank transactions | Fixed — `POST /roundup/process-bank-tx` |
| 9 | Credit score | Round-ups did not feed the credit-score engine | Fixed — emits `credit_events` row with new `SAVINGS_ROUNDUP` event type |
| 10 | RoundupSettingsSheet | No UI for source filter or credit boost preference | Fixed |

---

## 2. Database changes (migration `20260523_roundup_bank_credit`)

- `credit_event_type` enum: added `SAVINGS_ROUNDUP`
- `roundup_transactions`: `source_kind`, `source_account_id`, `bank_id`, `merchant_name`, `credit_event_id`
- `roundup_settings`: `source_filter` (CHECK in {wallet, bank, both}), `credit_boost_enabled`
- Indexes: `(consumer_id, created_at DESC)` and `(source_kind, source_account_id)` on `roundup_transactions`

All new columns have safe defaults so existing rows continue to work without backfill. RLS posture unchanged (owner-scoped).

---

## 3. Bank-sourced transaction → round-up flow

```text
KOB Bank Connector
        │  (file / DB / queue / API mode)
        ▼
bank_sourced_transactions  ──►  POST /v1/budgeting/roundup/process-bank-tx
                                          │
                                          ▼
                          resolve account → bank_customer
                          authorize: bank_customer.user_id == auth.uid()
                                          │
                                          ▼
                                 processRoundup()
                                  ├─ source_filter gate
                                  ├─ engine.calculateRoundUp()
                                  ├─ classifySkip() (low_balance, daily_cap, …)
                                  ├─ INSERT roundup_transactions  (source_kind='bank')
                                  ├─ atomic credit savings_goals.current_amount
                                  ├─ INSERT credit_events (SAVINGS_ROUNDUP) ◄── credit boost
                                  └─ INSERT roundup_events (SAVE_SUCCESS)
```

Key safety properties:
- **Idempotent** on `(consumer_id, source_tx_id)` where `source_tx_id = 'bank:<uuid>'`.
- **Authorization** verifies that the bank account ultimately belongs to the calling consumer via `bank_sourced_accounts → bank_customers.user_id`.
- **Debit-only**: refuses if `credit_debit != 'DEBIT'`.

---

## 4. Credit score hook

When `roundup_settings.credit_boost_enabled = true` and a round-up succeeds:

```ts
INSERT INTO credit_events (
  user_id, event_type='SAVINGS_ROUNDUP',
  value_numeric=<roundup_xaf>,
  metadata={ roundup_transaction_id, source_kind, bank_id, goal_id },
  source='budgeting-ops/roundup'
)
```

The existing `credit-score-engine` already aggregates `credit_events` by type → adding `SAVINGS_ROUNDUP` to the enum and emitting events is the only contract change required. Scoring weights are owned by the engine and can be tuned independently (per CrediQ governance: max contribution capped via existing rule table).

Opt-out: a consumer can turn off credit boost in the round-up settings sheet at any time. Existing events are not deleted (audit trail), but no further events are emitted.

---

## 5. Endpoints — verified contract

| Method | Path | Notes |
|--------|------|-------|
| GET | `/budgets/current` | Now returns category counts and top merchants |
| POST | `/budgets` | Unchanged |
| PATCH | `/budgets/:id/categories/:catKey` | Unchanged |
| GET | `/alerts`, PATCH `/alerts/:id/dismiss` | Unchanged |
| GET / POST | `/goals` | Unchanged |
| GET | `/goals/:id/progress` | `round_up_total_this_month` now real |
| GET | `/njangi/schedule` | Live data |
| GET | `/insights`, POST `/insights/ask` | Unchanged |
| GET | `/analytics/merchants` | Live aggregation |
| GET | `/analytics/monthly` | Live aggregation |
| GET / PATCH | `/roundup/settings` | + `source_filter`, `credit_boost_enabled` |
| POST | `/roundup/preview` | Unchanged |
| POST | `/roundup/process` | Accepts optional `source_kind`, `merchant_name` |
| POST | `/roundup/process-bank-tx` | **NEW** — KOB bank-sourced ingestion |
| GET | `/roundup/transactions` | Unchanged |
| POST | `/roundup/transactions/:id/retry` | Unchanged |
| POST | `/roundup/pause` and `/resume` | Unchanged |

---

## 6. Frontend changes

- `useRoundup.ts` — types updated; new `useProcessBankTx()` hook.
- `RoundupSettingsSheet.tsx` — new **Transaction sources** segmented control and **Credit score boost** toggle.
- `CustomerBudget.tsx` — no behavioural change; existing `RoundupCard` already surfaces the new state via the shared query keys.

---

## 7. Remaining non-blocking items (tracked, not in scope today)

- `transactions.metadata.budget_category` is the assumed merchant→category bridge. A dedicated `merchant_category_map` table would let us classify legacy rows that have no metadata tag.
- Background worker to subscribe to `bank_sourced_transactions` realtime inserts and auto-invoke `process-bank-tx` (currently caller-driven). This is the natural next-phase enhancement once the bank-connector wave-6 is live.
- Add an admin replay button under `/developer/guides/roundup` that reruns the last 24h of skipped round-ups.

All items above are additive and do not block the production rollout of the current change.

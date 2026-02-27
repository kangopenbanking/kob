

## Plan: Loans & Savings ↔ Credit Score Linkage (Non-Breaking Enhancement)

### Current State Audit

**What EXISTS:**
- Full loan lifecycle: `loan-apply`, `loan-approve`, `loan-disburse`, `loan-repay` edge functions with ledger integration
- Full savings lifecycle: `savings-create`, `savings-deposit`, `savings-withdraw`, `savings-accrue-interest` with ledger integration
- Credit scoring engine: `credit-score-calculate` (component-based, writes to `credit_scores` + `credit_score_history` + `credit_monitoring_alerts`)
- CrediQ ecosystem: baseline score generation, action plans, health metrics, email notifications
- DB tables: `loan_products`, `loan_applications`, `loan_accounts`, `loan_schedule`, `loan_repayments`, `loan_events`, `savings_products`, `savings_accounts`, `savings_transactions`, `interest_accruals`, `credit_scores`, `credit_score_history`
- Institutions, user_roles, ledger with journal entries

**What is MISSING:**
1. **Immutable `credit_events` table** -- no event-sourced credit trail exists; scoring is computed from raw data each time
2. **Automatic credit event emission** from loan-repay, savings-deposit, savings-withdraw
3. **On-time vs late detection** in loan-repay (no comparison of `paid_at` vs `due_date`)
4. **Overdue detection cron job** -- no scheduled job marks overdue installments or creates missed-payment events
5. **Credit profile API endpoints** (GET profile, GET events, GET explain, POST recompute)
6. **`credit_score_snapshots`** with explainability factors
7. **Deterministic scoring from events** -- current engine reads raw tables, not events
8. **Changelog files** (`docs/changelog.md`, `docs/changelog.json`)
9. **Audit/gap documentation** under `docs/loans-savings-credit/`

---

### Implementation Steps

#### Step 1: Database Migration -- Credit Events & Profiles Tables
Create migration adding:
- `credit_events` (immutable): `id`, `user_id`, `institution_id`, `event_type` (enum: `LOAN_REPAYMENT_ON_TIME`, `LOAN_REPAYMENT_LATE`, `LOAN_INSTALLMENT_MISSED`, `LOAN_DEFAULTED`, `LOAN_CLOSED`, `SAVINGS_DEPOSIT`, `SAVINGS_WITHDRAWAL`, `SAVINGS_BALANCE_STABLE`), `event_time`, `value_numeric`, `metadata`, `source`, `created_at`
- `credit_profiles`: `id`, `user_id` (unique), `institution_id`, `current_score`, `score_band`, `last_computed_at`, `created_at`, `updated_at`
- `credit_score_snapshots`: `id`, `user_id`, `institution_id`, `score`, `score_band`, `factors_json`, `computed_at`
- `credit_scoring_rules`: `id`, `institution_id`, `rule_key`, `weight`, `enabled`, `created_at`, `updated_at`
- Add `missed_event_created` boolean to `loan_schedule` for dedupe
- RLS: users read own data, service_role writes
- Enable realtime on `credit_events`

#### Step 2: Credit Scoring Engine Edge Function
Create `credit-score-engine/index.ts`:
- Accepts `user_id`, reads `credit_events` for that user
- Applies deterministic rules: on-time repayment +5-15, late -10-40 (scaled by days), missed -50, defaulted -150-250, loan closed +15, deposit +1-3 (capped monthly), withdrawal 0, stable balance +2
- Baseline: 500, range: 300-850
- Writes to `credit_profiles`, creates `credit_score_snapshots` with `factors_json` (top 3 drivers)
- Returns `{ score, band, delta, factors }`

#### Step 3: Hook loan-repay to Emit Credit Events
Update `loan-repay/index.ts`:
- After allocating payment, compare `paid_at` vs schedule item `due_date` (+ 3-day grace)
- Insert `credit_events` row: `LOAN_REPAYMENT_ON_TIME` or `LOAN_REPAYMENT_LATE` with `days_late` in `value_numeric`
- If loan completed, insert `LOAN_CLOSED` event
- Invoke `credit-score-engine` to recompute
- Add optional `credit_score: { previous, current, delta }` to response

#### Step 4: Hook savings-deposit and savings-withdraw
Update `savings-deposit/index.ts`:
- After recording transaction, insert `SAVINGS_DEPOSIT` credit event with amount
- Invoke score recompute

Update `savings-withdraw/index.ts`:
- Insert `SAVINGS_WITHDRAWAL` event (small or zero weight)

#### Step 5: Overdue Detection Cron Job
Create `loan-overdue-detect/index.ts`:
- Query `loan_schedule` where `due_date < today - 3 days` AND `status IN ('pending','partial')` AND `missed_event_created = false`
- For each: insert `LOAN_INSTALLMENT_MISSED` credit event, set `missed_event_created = true`, update status to `overdue`
- Recompute affected users' scores
- Register as pg_cron daily job

#### Step 6: Credit Profile API Endpoints
Create 4 edge functions:
- `credit-profile-get`: GET own `credit_profiles` + latest snapshot
- `credit-events-list`: GET own `credit_events` with pagination/filters (from, to, type)
- `credit-explain`: GET latest `credit_score_snapshots.factors_json` with summary
- `credit-recompute`: POST trigger recompute (admin or self in sandbox)

#### Step 7: Documentation & Changelog
Create:
- `docs/loans-savings-credit/audit.md` -- current state summary
- `docs/loans-savings-credit/gap-report.md` -- what was missing
- `docs/loans-savings-credit/route-inventory.md` -- all loan/savings/credit routes
- `docs/changelog.md` + `docs/changelog.json` with entries for each feature
- Update `docs/loans-guide.md` with "How repayments impact credit score" section
- Update `docs/savings-guide.md` with "How savings behavior contributes" section

#### Step 8: E2E Tests
Create `src/test/credit-scoring-e2e.test.ts`:
- Flow A: On-time repayment increases score from baseline
- Flow B: Late repayment decreases score
- Flow C: Savings deposit modestly increases score
- Flow D: Overdue job dedupe correctness

### Technical Details

```text
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ loan-repay   │────▶│ credit_events    │────▶│ credit-score-     │
│ savings-dep  │     │ (immutable)      │     │ engine            │
│ savings-wth  │     └──────────────────┘     │ (deterministic)   │
│ overdue-job  │                              └───────┬───────────┘
└─────────────┘                                       │
                                              ┌───────▼───────────┐
                                              │ credit_profiles   │
                                              │ credit_snapshots  │
                                              └───────────────────┘
```

**Scoring Rules (MVP defaults):**
| Event | Points | Cap |
|---|---|---|
| `LOAN_REPAYMENT_ON_TIME` | +5 to +15 | per installment |
| `LOAN_REPAYMENT_LATE` | -10 to -40 | scaled by days_late |
| `LOAN_INSTALLMENT_MISSED` | -50 | per missed |
| `LOAN_DEFAULTED` | -150 to -250 | once |
| `LOAN_CLOSED` | +15 | once per loan |
| `SAVINGS_DEPOSIT` | +1 to +3 | max 10/month |
| `SAVINGS_WITHDRAWAL` | 0 | no impact |
| `SAVINGS_BALANCE_STABLE` | +2 | once/month |

**New Edge Functions:** `credit-score-engine`, `loan-overdue-detect`, `credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute`

**Modified Edge Functions:** `loan-repay`, `savings-deposit`, `savings-withdraw`

**Zero breaking changes:** All new tables, new endpoints, and optional response fields only.


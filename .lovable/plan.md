

## Plan: Piggy Bank, Njangi (Money Pot) & Rents — Credit Score Integration

### New Features Summary

Three new modules in the multi-tenant banking app (`/bank/:institutionId/`), each feeding credit events into the existing event-sourced scoring engine.

---

### Step 1: Database Migration

**New tables:**

- **`piggybank_plans`**: `id`, `user_id`, `institution_id`, `plan_name`, `plan_type` (enum: `savings`, `rent`), `target_amount`, `schedule_frequency` (enum: `daily`, `weekly`, `monthly`), `installment_amount`, `payment_method` (text), `start_date`, `end_date`, `status` (enum: `active`, `paused`, `completed`, `cancelled`), `rent_reference` (varchar, unique, nullable — format `KRENTS` + 4 random digits), `landlord_user_id` (uuid, nullable), `created_at`, `updated_at`

- **`piggybank_payments`**: `id`, `plan_id` (FK → piggybank_plans), `user_id`, `amount`, `due_date`, `paid_at` (nullable), `status` (enum: `pending`, `paid`, `missed`, `late`), `credit_event_id` (uuid, nullable), `created_at`

- **`njangi_groups`**: `id`, `name`, `institution_id`, `creator_id`, `contribution_amount`, `frequency` (enum: `weekly`, `monthly`), `payout_method` (enum: `random`, `manual`), `late_interest_rate` (numeric, default 0), `max_members`, `status` (enum: `forming`, `active`, `completed`, `dissolved`), `current_cycle`, `created_at`, `updated_at`

- **`njangi_members`**: `id`, `group_id` (FK), `user_id`, `joined_at`, `status` (enum: `active`, `removed`), `has_received_payout` (boolean, default false)

- **`njangi_contributions`**: `id`, `group_id` (FK), `member_id` (FK → njangi_members), `user_id`, `cycle_number`, `amount`, `due_date`, `paid_at` (nullable), `status` (enum: `pending`, `paid`, `missed`, `late`), `late_interest_amount` (numeric, default 0), `credit_event_id` (uuid, nullable), `created_at`

- **`njangi_payouts`**: `id`, `group_id` (FK), `recipient_member_id` (FK), `cycle_number`, `amount`, `paid_at`, `selection_method` (enum: `random`, `manual`), `created_at`

**Extend `credit_event_type` enum** with: `PIGGYBANK_PAYMENT_ON_TIME`, `PIGGYBANK_PAYMENT_MISSED`, `PIGGYBANK_PAYMENT_LATE`, `NJANGI_CONTRIBUTION_ON_TIME`, `NJANGI_CONTRIBUTION_MISSED`, `NJANGI_CONTRIBUTION_LATE`, `RENT_PAYMENT_ON_TIME`, `RENT_PAYMENT_MISSED`, `RENT_PAYMENT_LATE`

**RLS**: Users read/write own plans, own memberships, own contributions. Service role writes credit events.

---

### Step 2: Edge Functions — Piggy Bank

- **`piggybank-create`**: Create a plan (savings or rent type). For rent type: auto-generate unique `KRENTS` + 4 random digits reference. Show credit impact disclaimer before creation. Set `institution_id`.

- **`piggybank-pay`**: Record a payment against a due installment. Compare `paid_at` vs `due_date` → emit `PIGGYBANK_PAYMENT_ON_TIME` or `PIGGYBANK_PAYMENT_LATE` credit event. Invoke `credit-score-engine` to recompute.

- **`piggybank-overdue-detect`**: Cron job (daily). Find `piggybank_payments` where `due_date < today` and `status = pending` → mark as `missed`, emit `PIGGYBANK_PAYMENT_MISSED` credit event. For rent plans, same logic with `RENT_PAYMENT_*` event types.

- **`piggybank-generate-schedule`**: Called after plan creation. Generates all `piggybank_payments` rows based on frequency and date range.

---

### Step 3: Edge Functions — Njangi

- **`njangi-create`**: Create group with contribution amount, frequency, late interest rate, payout method. Creator becomes first member.

- **`njangi-join`**: Join an existing group (up to `max_members`).

- **`njangi-contribute`**: Record contribution for current cycle. Compare timing → emit `NJANGI_CONTRIBUTION_ON_TIME` or `NJANGI_CONTRIBUTION_LATE` credit event. Apply late interest if applicable. Invoke score engine.

- **`njangi-payout`**: When all contributions for a cycle are collected, select recipient (random from those who haven't received, or manual). Record payout. Advance cycle.

- **`njangi-overdue-detect`**: Cron job (daily). Find missed contributions → emit `NJANGI_CONTRIBUTION_MISSED` credit events.

---

### Step 4: Edge Functions — Rent

Rent is handled as a `plan_type = 'rent'` within Piggy Bank. Additional logic:
- `piggybank-create` with `plan_type: 'rent'` auto-assigns `KRENTS****` reference
- `piggybank-pay` for rent type transfers funds to `landlord_user_id`'s account
- Only `status = 'paid'` (successful) payments are reported to credit score
- Uses `RENT_PAYMENT_ON_TIME` / `RENT_PAYMENT_MISSED` / `RENT_PAYMENT_LATE` event types

---

### Step 5: Credit Score Engine Updates

Add scoring rules to `credit-score-engine/index.ts`:

| Event | Points |
|---|---|
| `PIGGYBANK_PAYMENT_ON_TIME` | +3 to +5 |
| `PIGGYBANK_PAYMENT_LATE` | -5 to -15 |
| `PIGGYBANK_PAYMENT_MISSED` | -20 |
| `NJANGI_CONTRIBUTION_ON_TIME` | +3 to +5 |
| `NJANGI_CONTRIBUTION_LATE` | -5 to -15 |
| `NJANGI_CONTRIBUTION_MISSED` | -25 |
| `RENT_PAYMENT_ON_TIME` | +5 to +10 |
| `RENT_PAYMENT_LATE` | -10 to -25 |
| `RENT_PAYMENT_MISSED` | -30 |

Update `BankCreditScore.tsx` `eventTypeLabel` and `eventTypeColor` maps for new event types.

---

### Step 6: Monthly Credit Report Notification

- **`credit-monthly-report`**: Cron job (1st of each month). For each user with piggybank/njangi/rent activity: compute summary (on-time %, missed count, score delta for month), send push notification via existing `push-notification` function, send email via existing notification infrastructure. Include advice: "You made 4/4 payments on time. Your score improved by +18 this month."

---

### Step 7: Frontend — Banking App Pages

**`BankPiggyBank.tsx`** (`/bank/:institutionId/more/piggybank`):
- List active savings & rent plans with progress bars
- "New Plan" button → creation form with plan type selector (Savings / Rent)
- For Rent: show `KRENTS****` reference, landlord setup, credit impact disclaimer
- Payment schedule view with status indicators (paid/due/missed)
- Deposit button for manual payments

**`BankNjangi.tsx`** (`/bank/:institutionId/more/njangi`):
- List groups user belongs to
- "Create Group" → form with contribution amount, frequency, late interest rate, payout method (random/manual), max members
- Group detail view: members list, current cycle, contribution status per member
- "Contribute" button for current cycle
- Payout history & next recipient indicator
- Share/invite link for joining

**`BankRentSetup.tsx`** — integrated into PiggyBank creation flow as a plan type, with:
- Credit impact warning dialog shown before setup
- Landlord selection (user ID or account)
- Auto-generated KRENTS reference display

---

### Step 8: Hooks & Data Layer

Add to `src/hooks/useBankingData.ts`:
- `usePiggyBankPlans()` — fetch user's plans
- `usePiggyBankPayments(planId)` — fetch schedule for a plan
- `useCreatePiggyBankPlan()` — mutation
- `usePiggyBankPay()` — mutation
- `useNjangiGroups()` — fetch user's groups
- `useNjangiGroupDetail(groupId)` — members, contributions, payouts
- `useCreateNjangiGroup()` — mutation
- `useJoinNjangiGroup()` — mutation
- `useNjangiContribute()` — mutation

---

### Step 9: Navigation & Routing

- Add routes in `App.tsx`:
  - `more/piggybank` → `BankPiggyBank`
  - `more/piggybank/new` → create form
  - `more/njangi` → `BankNjangi`
  - `more/njangi/new` → create group form
  - `more/njangi/:groupId` → group detail

- Add menu items in `BankMore.tsx`:
  - Piggy Bank (icon: PiggyBank) under Financial Services
  - Njangi (icon: Users) under Financial Services

---

### Step 10: Documentation & Changelog

- Update `docs/changelog.md` with Piggy Bank, Njangi, and Rent features
- Update `docs/loans-savings-credit/route-inventory.md` with new endpoints
- Add credit impact disclaimer text as a constant for reuse

---

### Technical Details

```text
┌───────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ piggybank-pay     │────▶│ credit_events    │────▶│ credit-score-    │
│ njangi-contribute │     │ (immutable)      │     │ engine           │
│ *-overdue-detect  │     └──────────────────┘     └────────┬─────────┘
└───────────────────┘                                       │
                                                    ┌───────▼─────────┐
                                                    │ credit_profiles │
                                                    │ snapshots       │
                                                    └─────────────────┘
                                                            │
                                              ┌─────────────▼─────────┐
                                              │ credit-monthly-report │
                                              │ (push + email)        │
                                              └───────────────────────┘
```

**New edge functions (8):** `piggybank-create`, `piggybank-pay`, `piggybank-generate-schedule`, `piggybank-overdue-detect`, `njangi-create`, `njangi-join`, `njangi-contribute`, `njangi-payout`, `njangi-overdue-detect`, `credit-monthly-report`

**Modified:** `credit-score-engine` (9 new event types), `BankCreditScore.tsx` (labels), `BankMore.tsx` (nav items), `App.tsx` (routes)

**New frontend pages (2):** `BankPiggyBank.tsx`, `BankNjangi.tsx`

**Zero breaking changes.** All additive.




# Referral System Audit & Fee Management Gaps

## Audit Findings

### Referral System

**What exists:**
- **Customer-facing UI** (`CustomerRewards.tsx`): Referral tab with link sharing, stats, and history
- **Backend** (`rewards-process-cashback/index.ts`): Edge function handling `referral` action — validates code (first 8 chars of user_id), prevents self-referral and duplicate referrals, credits 500 XAF to both users
- **Database**: `customer_referrals` table with RLS (users can view own, admins can manage all), `customer_rewards` table for bonus tracking
- **Hardcoded values**: Referral bonus (500 XAF), cashback rate (1%), min transfer (10,000 XAF) — not configurable by admin

**Gaps identified:**
1. **No Admin Rewards/Referral Management page** — admins cannot view, search, or manage referrals or rewards. No route, no page, no nav entry.
2. **No configurable referral settings** — bonus amounts, cashback rates, min transfer amounts are hardcoded in both the edge function and the customer UI. Admin should be able to configure these via `system_config`.
3. **Referral code lookup is inefficient** — queries all profiles and filters in JS (`profiles.find(p => p.id.slice(0,8) === code)`), will not scale.
4. **No fee charge for referral processing** — referral bonuses are disbursed but not tracked in `transaction_fees`.

### Fee Management Gaps

**Missing transaction types** not in `TX_TYPE_META`, `TRANSACTION_TYPES`, `CHANNEL_TO_TX_TYPE`, or `FALLBACK_RATES`:
- `overdraft_fee` — overdraft facility charges
- `loan_processing_fee` — upfront loan origination fee
- `atm_withdrawal` — ATM cash withdrawal fee
- `standing_order` — standing order / recurring payment fee
- `dormancy_fee` — account inactivity fee

These are common fintech fee types missing from all three fee system files.

---

## Implementation Plan

### Task 1: Build Admin Rewards & Referral Management page

Create `/admin/rewards-management` with:
- **Referrals tab**: Table of all `customer_referrals` (referrer email, referred email, bonus amount, status, date). Search/filter by status. Ability to void/reverse a referral.
- **Rewards tab**: Table of all `customer_rewards` (user, type, amount, status, date). Filter by reward_type (cashback, referral_bonus). Ability to credit manual rewards.
- **Settings tab**: Read/write `system_config` rows for `referral_bonus_amount`, `cashback_rate`, `cashback_min_transfer`. These replace the hardcoded values in the edge function and customer UI.
- Add route to `App.tsx`, nav entry to `admin-navigation-config.ts`.

### Task 2: Make referral/cashback config dynamic

- **Edge function** (`rewards-process-cashback`): Read `system_config` for `referral_bonus_amount`, `cashback_rate`, `cashback_min_transfer` instead of hardcoded values.
- **Customer UI** (`CustomerRewards.tsx`): Fetch these config values via a lightweight query or edge function call so the displayed rates match admin settings.
- **DB migration**: Insert default `system_config` rows for these three keys.

### Task 3: Add missing fee types to Fee Management

Update three files in parallel:
- **`CreateFeeStructureForm.tsx`** `TRANSACTION_TYPES` array — add `overdraft_fee`, `loan_processing_fee`, `atm_withdrawal`, `standing_order`, `dormancy_fee`
- **`FeeStructuresTable.tsx`** `TX_TYPE_META` — add the same 5 types with appropriate icons and categories
- **`useFeeEstimate.ts`** `CHANNEL_TO_TX_TYPE` and `FALLBACK_RATES` — add mappings and sensible defaults

Add a new "Banking" category to `CATEGORY_ORDER` and `CATEGORY_STYLES` for `atm_withdrawal`, `standing_order`, `dormancy_fee`. Put `overdraft_fee` and `loan_processing_fee` under existing "Lending".

### Task 4: Update API docs and changelog

- **`public/openapi.json`**: Add referral management endpoints under admin section
- **`public/changelog.json`**: Add entry for v3.9.0 covering admin referral management and new fee types
- **`public/apis.json`**: Bump version

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/pages/admin/RewardsManagement.tsx` |
| Edit | `src/App.tsx` (add route + lazy import) |
| Edit | `src/components/admin/admin-navigation-config.ts` (add nav item) |
| Edit | `supabase/functions/rewards-process-cashback/index.ts` (dynamic config) |
| Edit | `src/pages/customer-app/CustomerRewards.tsx` (dynamic config display) |
| Edit | `src/components/fee-management/CreateFeeStructureForm.tsx` (5 new types) |
| Edit | `src/components/fee-management/FeeStructuresTable.tsx` (5 new types + Banking category) |
| Edit | `src/hooks/useFeeEstimate.ts` (5 new mappings + fallbacks) |
| Edit | `public/changelog.json` |
| Edit | `public/apis.json` |
| Migration | Insert `system_config` rows for referral/cashback settings |


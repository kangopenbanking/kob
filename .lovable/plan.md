

# Auto-Payout System Upgrade — Implementation Plan

## Build Error
The `vite: command not found` error is a transient sandbox PATH issue — `node_modules/.bin/vite` exists. No code fix needed; it resolves on rebuild.

## Confirmed Gaps (all validated in code)

1. **Fee bug**: `totalDebit = amount` on line 131 of `gateway-process-withdrawal` — fee never debited
2. **Retry only Flutterwave**: `gateway-retry-payout` hardcodes `createFlutterwavePayout` for all providers
3. **Admin dashboard wrong table**: `PayoutManagement.tsx` queries `payouts` (institution settlements), not `gateway_payouts`
4. **No compliance screening**: Neither withdrawal function calls `gateway-compliance-screen`
5. **No webhook deduplication**: `gateway-payout-webhook` has no `webhook_inbox` check
6. **No consumer velocity limits**: No daily/monthly caps in `gateway-process-withdrawal`
7. **No auto-withdrawal rules**: No `payout_schedules` table or cron anywhere
8. **No atomic locking**: Consumer balance debit is race-condition vulnerable
9. **No consumer-to-wallet withdrawal**: Only merchants can withdraw to KOB wallet
10. **No unified payout_methods**: Separate tables for consumer vs merchant destinations

---

## Phase 1: Critical Fixes (7 files, no new tables)

### 1a. Fix consumer fee debit
**File**: `supabase/functions/gateway-process-withdrawal/index.ts`
- Line 131: `totalDebit = amount` → `totalDebit = amount + fee`
- Balance check on line 134 already uses `totalDebit`, so it will correctly require `amount + fee`

### 1b. Fix retry-payout multi-provider routing
**File**: `supabase/functions/gateway-retry-payout/index.ts`
- Import `createFlutterwaveMomoPayout`, `createPayPalPayout` from gateway-adapters
- Route based on `payout.provider`: flutterwave (bank), flutterwave_momo, paypal, stripe
- Add Stripe refund retry path for card payouts

### 1c. Fix Admin PayoutManagement dashboard
**File**: `src/pages/admin/PayoutManagement.tsx`
- Query `gateway_payouts` joined with `gateway_merchants` instead of `payouts`
- Add tabs: "All", "Consumer", "Merchant"
- Add provider, channel, fee columns
- Wire retry button to invoke `gateway-retry-payout` edge function
- Wire reverse button to invoke `gateway-admin-reverse-withdrawal`

### 1d. Add compliance screening to withdrawals
**Files**: `gateway-process-withdrawal/index.ts`, `gateway-request-payout/index.ts`
- Before provider execution, invoke `gateway-compliance-screen` with user/merchant details
- If result is `denied`, reject with 403 and notify admin
- If result is `review`, create payout in `pending_review` status and alert admin

### 1e. Add webhook deduplication
**File**: `supabase/functions/gateway-payout-webhook/index.ts`
- Before processing, compute `dedupe_hash` from provider + providerRef
- Check `webhook_inbox` for existing hash; skip if found
- Insert into `webhook_inbox` on successful processing

---

## Phase 2: Limits & Safety (1 migration + 2 file edits)

### 2a. Consumer velocity limits
**File**: `supabase/functions/gateway-process-withdrawal/index.ts`
- Import `sumUsageForPeriod` from `_shared/limits-enforcement.ts`
- Sum daily and monthly withdrawal totals from `gateway_payouts` for the user
- Enforce configurable daily (500,000 XAF) and monthly (5,000,000 XAF) caps
- Return clear error with remaining allowance

### 2b. Atomic balance debit (new DB function)
**Migration**: Create `atomic_consumer_withdrawal_debit` PL/pgSQL function
- Uses `SELECT ... FOR UPDATE` on the balance row
- Validates sufficient funds atomically
- Debits in same transaction
- Returns success/failure — prevents race conditions
- Update `gateway-process-withdrawal` to call this RPC instead of separate read + update

---

## Phase 3: Auto-Withdrawal Engine (1 migration + 2 new functions + 2 UI updates)

### 3a. New `payout_schedules` table
**Migration**:
```sql
CREATE TABLE public.payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('consumer','merchant')),
  owner_id UUID NOT NULL,
  destination_id UUID NOT NULL,
  destination_type TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily','weekly','monthly','threshold')),
  schedule_config JSONB NOT NULL DEFAULT '{}',
  amount_mode TEXT NOT NULL DEFAULT 'sweep_all',
  amount_value NUMERIC DEFAULT 0,
  min_balance_to_keep NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: owner can CRUD own rules, admins can read all
```

### 3b. CRUD edge function
**New file**: `supabase/functions/gateway-auto-withdrawal-rules/index.ts`
- POST: create rule, validate destination ownership, compute `next_run_at`
- GET: list user's rules
- PUT: update rule, recompute `next_run_at`
- DELETE: soft-disable rule

### 3c. Cron executor
**New file**: `supabase/functions/gateway-auto-withdrawal-cron/index.ts`
- Cron-auth guarded, runs every 5 minutes via pg_cron
- Query `payout_schedules` where `next_run_at <= now() AND is_enabled`
- For each: check balance, invoke existing withdrawal logic, update `last_run_at`/`next_run_at`
- Auto-disable after 3 consecutive failures, notify user + admin

### 3d. Consumer Auto Cash Out UI
**File**: `src/pages/customer-app/CustomerCashOut.tsx`
- Add "Auto Cash Out" collapsible section below manual withdrawal
- Rule builder: schedule type picker, amount mode, destination dropdown, enable toggle
- List active rules with edit/delete

### 3e. Business Auto-Withdraw UI
**File**: `src/pages/business-app/BusinessWallet.tsx`
- Add "Auto-Withdraw Rules" tab
- Same rule builder pattern as consumer

---

## Phase 4: Admin Oversight

### 4a. Admin auto-withdrawal management
**File**: `src/pages/admin/PayoutManagement.tsx` (extend)
- Add "Auto-Withdraw Rules" tab showing all rules across users/merchants
- Admin can disable suspicious rules
- Show execution history per rule

---

## Execution Order

1. Phase 1 (critical fixes) — all additive, no breaking changes
2. Phase 2 (limits + atomic locking) — 1 migration + edge function updates
3. Phase 3 (auto-withdrawal) — 1 migration + 2 new functions + UI
4. Phase 4 (admin oversight) — UI only

All changes are non-breaking and additive. Existing manual withdrawal flows remain unchanged.


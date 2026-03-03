

# Fix: Customer App Data Leaking Into Banking App

## Root Cause

The Kang Customer App and the Banking App at `/bank/f493095b-...` share the **same `institution_id`** (`KANG_PLATFORM_ID`). The Customer App auto-creates wallet accounts tagged with this institution ID (via `useEnsureWalletAccount`), and all Customer App transactions (funding, withdrawals, bill payments) are also tagged with it.

When a user opens the Banking App at this institution, `useBankAccounts()` and `useBankTransactions()` fetch everything with `institution_id = f493095b-...`, which includes all Customer App wallet data.

## Fix Strategy

Add a **`source` column** to the `accounts` table to distinguish between `customer_wallet` (Kang app) and `banking` (Banking app) accounts. Then filter by source in the appropriate hooks.

However, the simpler and less invasive approach is to filter based on the existing `account_id` prefix pattern (`KANG-*`) which is already used by `useEnsureWalletAccount`:

### Changes

1. **`src/hooks/useBankingData.ts` — `useBankAccounts()`**
   - Add filter: `.not('account_id', 'like', 'KANG-%')` to exclude Customer App wallet accounts from Banking App views.

2. **`src/hooks/useBankingData.ts` — `useBankTransactions()`**
   - After fetching account IDs for the institution, exclude accounts where `account_id LIKE 'KANG-%'`.
   - This ensures Customer App deposits, withdrawals, and bill payments don't appear in the Banking App transaction list.

3. **`src/hooks/useRealtimeBalanceSync.ts`**
   - Add the same `KANG-` exclusion when building the `accountIds` list for realtime subscriptions, so Customer App balance changes don't trigger Banking App cache invalidations.

4. **`supabase/functions/_shared/funding-scope-creditor.ts`**
   - Add `metadata.source: 'customer_app'` to transactions inserted by the funding flow, providing a secondary filter for future-proofing.

### Why This Works
- The `KANG-` prefix on `account_id` is deterministic and only set by `useEnsureWalletAccount` for Customer App wallets.
- No database migration needed — it uses existing data patterns.
- Banking App institutions that happen to share the Kang platform ID will correctly exclude consumer wallet data.
- The Customer App hooks (`useCustomerData.ts`) remain unchanged since they should see all user accounts across institutions.

### Files to Edit
- `src/hooks/useBankingData.ts` (2 functions)
- `src/hooks/useRealtimeBalanceSync.ts` (1 filter addition)
- `supabase/functions/_shared/funding-scope-creditor.ts` (metadata tag)


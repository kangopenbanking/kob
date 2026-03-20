

# Global Payment Priority: Linked Accounts → KOB Partners → External Providers

## Problem Summary

The payment system has inconsistent bank selection across 6 pages. The edge function defaults to "Afriland First Bank" when no bank is specified. Several pages don't offer bank selection for `bank_transfer` at all, and those that do don't pass `bank_source` to enable KOB partner instant-credit logic.

## Gap Report

| Page | BankSelector? | Sends bank_code? | Sends bank_source? | Linked Accounts? |
|---|---|---|---|---|
| `MerchantFundWallet` | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes (via BankSelector) |
| `CustomerFundAccount` | ❌ No | ❌ No | ❌ No | ❌ No |
| `InstitutionFundAccount` | ❌ No | ❌ No | ❌ No | ❌ No |
| `BankFundAccount` (Banking PWA) | ❌ No | ❌ No | ❌ No | ❌ No |
| `CustomerFundWallet` (Consumer PWA) | ✅ Custom | ❌ Partial | ❌ No | ❌ No (uses linked_accounts table) |
| `BankTransferForm` (Payments/BankingOps) | ✅ Custom | ✅ Yes | ❌ No | ❌ No |

## Fixes

### 1. Edge Function — Remove Afriland Default
**File:** `supabase/functions/gateway-create-funding-intent/index.ts`
- Line 232-233: Change fallback from `'Afriland First Bank'` to empty/generic. Use `bank_source` to determine `is_kob_partner`.
- Accept `bank_source` from request body (already partially handled via line 234).

### 2. Add BankSelector to 3 Missing Pages

**`CustomerFundAccount.tsx`** — Add BankSelector import + state + UI when `method === 'bank_transfer'`. Pass `bank_code`, `bank_name`, `bank_source` in the funding intent body.

**`InstitutionFundAccount.tsx`** — Same pattern: add BankSelector + state + pass bank params.

**`BankFundAccount.tsx`** (Banking PWA) — Add a mobile-friendly bank selection step when `method === 'bank_transfer'`. Import BankSelector or inline a styled version matching the PWA design.

### 3. Pass `bank_source` from All Pages
Update the `gateway-create-funding-intent` invocation in:
- `MerchantFundWallet.tsx` — add `bank_source` from the selected bank's source
- `CustomerFundWallet.tsx` — add `bank_source` from `selectedBank.source`
- `BankTransferForm.tsx` — track bank source and pass it

### 4. Update BankSelector to Expose Source
Modify `BankSelector`'s `onBankChange` callback to also return the bank's `source` property: `onBankChange: (code: string, name: string, source: string) => void`. This lets all consumers pass `bank_source` to the edge function.

### 5. Update BankTransferForm with Linked Accounts
Add linked account fetching (Priority 1) to `BankTransferForm.tsx`, matching the pattern already in `BankSelector.tsx`. Show source badges (Linked/Partner/External).

## Files Summary

| File | Action |
|---|---|
| `supabase/functions/gateway-create-funding-intent/index.ts` | Modify (remove Afriland default, use bank_source) |
| `src/components/funding/BankSelector.tsx` | Modify (expose `source` in callback) |
| `src/pages/CustomerFundAccount.tsx` | Modify (add BankSelector + bank params) |
| `src/pages/institution/InstitutionFundAccount.tsx` | Modify (add BankSelector + bank params) |
| `src/pages/banking-app/BankFundAccount.tsx` | Modify (add bank selection for bank_transfer) |
| `src/pages/merchant/MerchantFundWallet.tsx` | Modify (pass bank_source) |
| `src/pages/customer-app/CustomerFundWallet.tsx` | Modify (pass bank_source) |
| `src/components/payments/BankTransferForm.tsx` | Modify (add linked accounts, pass bank_source, show badges) |
| **Total** | 1 edge function + 7 components modified |


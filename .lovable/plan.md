

# Merchant Withdrawal & Linked Accounts Implementation

## Current State
- **BusinessWallet.tsx**: Has a "Request Payout" button that blindly picks the first settlement account with no amount input, no account selection, and no Consumer wallet option.
- **MerchantSettlementAccounts.tsx** (Merchant Portal): Full 5-rail settlement account management (Bank, MoMo, PayPal, Card, RTGS) but no "KOB Wallet" option.
- **gateway-request-payout**: Backend already handles PIN verification, balance checks, and atomic wallet debits.
- **Bug**: BusinessWallet queries `gateway_settlement_accounts` (wrong table) instead of `gateway_merchant_settlement_accounts`.

## What We Will Build

### 1. Professional Withdrawal Flow (Business App)
Replace the current blind "Request Payout" button with a full **Withdraw Sheet** on `/biz/wallet`:

- **Amount Input**: Custom amount entry with "Max" quick-fill, showing available balance and fee estimate
- **Account Selector**: Card-based selection of linked withdrawal accounts (max 2)
- **Two destination types**:
  - **Bank Account / MoMo**: Withdraw to configured settlement accounts
  - **KOB Consumer Wallet**: Transfer to the merchant owner's Consumer app wallet (if they have an account)
- **PIN Confirmation**: Existing `PinConfirmDialog` for final authorization
- **Receipt/Success**: Confirmation card after submission

### 2. Add "KOB Wallet" as a Settlement Account Type
Extend the settlement account system to support a `kob_wallet` type:

- Add `kob_wallet` option to `ACCOUNT_TYPES` in both **MerchantSettlementAccounts.tsx** and the new **BusinessWithdraw** flow
- The account_number stores the user's Consumer account ID
- Auto-detect: check if the merchant owner has an `accounts` table entry (Consumer wallet)

### 3. Linked Account Management (Business App)
Create a **BusinessLinkedAccounts** section (accessible from Settings or Wallet page):

- Display up to **2 linked withdrawal accounts** (enforced limit)
- Add account flow: bottom Sheet with method selection → details entry (reuse MerchantSettlementAccounts form patterns)
- Support: Bank Transfer, Mobile Money, and KOB Consumer Wallet
- Set default, remove functionality

### 4. Backend: KOB Wallet Transfer Support
Update **gateway-request-payout** edge function:

- When `channel === 'kob_wallet'`, instead of calling Flutterwave, perform an internal ledger transfer:
  - Debit merchant wallet (already done)
  - Credit the merchant owner's Consumer `account_balances` record
  - Insert a `transactions` record for the Consumer (triggers `notify_new_transaction`)
- Mark payout as `completed` immediately (internal transfer)

### 5. Merchant Portal Parity
Add the same withdrawal flow to **MerchantPayouts.tsx** with a "New Withdrawal" button opening a dialog with amount + account selection.

## File Changes

| File | Action |
|------|--------|
| `src/pages/business-app/BusinessWallet.tsx` | Major rebuild: add Withdraw Sheet with amount input, account selector, KOB wallet detection |
| `src/pages/business-app/BusinessSettings.tsx` | Add "Linked Accounts" settings link |
| `src/pages/merchant/MerchantSettlementAccounts.tsx` | Add `kob_wallet` account type option |
| `src/pages/merchant/MerchantPayouts.tsx` | Add "New Withdrawal" button with same flow |
| `supabase/functions/gateway-request-payout/index.ts` | Add `kob_wallet` channel handling for internal transfers |
| `src/App.tsx` | No new routes needed (flows are Sheet-based) |

## Technical Details

### KOB Wallet Detection Logic
```typescript
// Check if merchant owner has a Consumer wallet
const { data: consumerAccount } = await supabase
  .from('accounts')
  .select('id')
  .eq('user_id', user.id)
  .limit(1)
  .maybeSingle();
```

### Internal Transfer (Edge Function)
```typescript
if (channel === 'kob_wallet') {
  // Credit consumer account balance
  await supabase.from('account_balances').upsert({
    account_id: consumerAccountId,
    credit_debit_indicator: 'Credit',
    type: 'ClosingAvailable',
    amount: currentBalance + payoutAmount,
    currency: 'XAF'
  });
  // Insert transaction record (triggers notification)
  await supabase.from('transactions').insert({
    account_id: consumerAccountId,
    amount: payoutAmount,
    currency: 'XAF',
    credit_debit_indicator: 'Credit',
    status: 'Booked',
    transaction_information: 'Business wallet withdrawal',
  });
  // Mark payout completed immediately
}
```

### 2-Account Limit Enforcement
The UI enforces max 2 linked accounts. When 2 accounts exist, the "Add Account" button is disabled with a message: "Maximum 2 linked accounts allowed."

### Fix: Wrong Table Name
BusinessWallet currently queries `gateway_settlement_accounts` — will be corrected to `gateway_merchant_settlement_accounts`.


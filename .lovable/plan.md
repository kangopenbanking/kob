

## Plan: Add Account Funding to Banking PWA

### Overview
Add a "Fund Account" feature to the banking app PWA (`/bank/:institutionId/fund`) that lets bank customers add money via Mobile Money, Card (Stripe), PayPal, and Bank Transfer. Reuses existing shared funding components.

### Step 1: Create `BankFundAccount.tsx` page
New file: `src/pages/banking-app/BankFundAccount.tsx`

- Mobile-first design matching PWA aesthetic (rounded-2xl cards, motion animations, bank color tokens)
- Uses `useBankAccounts()` hook to get institution-scoped accounts
- Reuses `PaymentMethodSelector`, `AmountInput`, `FundingResult`, `FundingHistory`, `MobileMoneyConfirm` components
- Calls `gateway-create-funding-intent` with `funding_scope: "end_user"` and the selected account
- Phone/email conditional inputs for Mobile Money and Card/PayPal
- Back navigation via PWATopBar or inline back button

### Step 2: Add route in `App.tsx`
- Import `BankFundAccount` 
- Add route inside the `BankingAppLayout` nested routes: `<Route path="fund" element={<BankFundAccount />} />`
- No FeatureGate needed (funding is a core feature)

### Step 3: Add "Fund Account" entry point in BankHome quick actions
File: `src/pages/banking-app/BankHome.tsx`
- Add a "Fund" quick action with `Wallet` icon to the `allQuickActions` array, pointing to `fund`

### Step 4: Add "Fund Account" to BankPayments page
File: `src/pages/banking-app/BankPayments.tsx`
- Add a "Fund Account" payment option with `Wallet` icon, path `../fund`, description "Add money via MoMo, Card, PayPal"

### Step 5: Add "Fund Account" to BankMore page
File: `src/pages/banking-app/BankMore.tsx`
- Add entry in the Financial Services section: icon `Wallet`, label "Fund Account", path `fund`

### Technical Notes
- All existing shared components (`PaymentMethodSelector`, `AmountInput`, `FundingResult`, `FundingHistory`, `MobileMoneyConfirm`, `StripeCardConfirm`) are reused without modification
- The page uses `useParams()` for `institutionId` and `useBankAccounts()` for institution-scoped account selection
- Currency defaults to XAF with the same `fmt` formatter used across the platform
- No database changes needed — uses existing `funding_intents`, `accounts`, and gateway edge functions


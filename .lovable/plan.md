

## Plan: Enhanced Registration, PIN Login & Transaction PIN Confirmation

### Overview
Three interconnected features: (1) a comprehensive multi-step registration form with PIN setup, (2) PIN-based login for returning users (no OTP needed), and (3) a reusable PIN confirmation dialog before any money movement.

---

### Technical Details

**Database Migration Required:**
- Add columns to `profiles`: `date_of_birth TEXT`, `gender TEXT`, `city TEXT`, `address TEXT`, `occupation TEXT`, `account_type TEXT DEFAULT 'savings'`, `institution_id UUID` (nullable FK to institutions)
- These fields capture the full registration data currently missing from the profiles table

**Backend:**
- The `pin-code-set`, `phone-auth-pin-login`, and `pin-code-verify` edge functions already exist and work correctly with salted SHA-256
- The `pin-code-set` edge function currently expects `pin_code` but `BankSettings.tsx` sends `pin` -- needs frontend alignment
- `phone-auth-pin-login` requires `captcha_session_id` -- the auth form already has captcha infrastructure

---

### Implementation Steps

#### 1. Add profile columns via migration
Add `date_of_birth`, `gender`, `city`, `address`, `occupation`, `account_type`, and `institution_id` to `profiles` table.

#### 2. Rebuild `AccountApplication.tsx` as a multi-step wizard
- **Step 1 - Personal Info**: Full name, date of birth, gender (Male/Female/Other card selector), nationality (defaulting to Cameroon)
- **Step 2 - Contact & Address**: Phone number (with country code picker), city, address
- **Step 3 - Account Setup**: Account type selector (Savings/Current/Business cards), occupation field
- **Step 4 - Security**: 6-digit PIN setup with confirmation (enter twice), password creation
- **Step 5 - Review & Submit**: Summary of all entered data
- Uses `framer-motion` for smooth step transitions, progress indicator at top
- On submit: calls Supabase `auth.signUp` with all metadata, then calls `pin-code-set` to store PIN hash, then updates profile with extended fields
- On success: auto-login (no OTP required since account was just created) and redirect to home

#### 3. Update `MobileAuthForm.tsx` with PIN login option
- Add a third tab or a conditional flow: when user enters phone number, call `phone-auth-check-pin` to detect if PIN is set
- If PIN exists, show "Login with PIN" option -- renders 6-digit PIN input (InputOTP)
- On PIN submit: call `phone-auth-pin-login` edge function with phone, PIN, and captcha session
- On success: use returned `magic_link` to establish Supabase session via `verifyOtp`, then navigate to home
- Keep existing OTP flow as fallback ("Forgot PIN? Use OTP instead")

#### 4. Create reusable `PinConfirmDialog` component
- New file: `src/components/pwa/PinConfirmDialog.tsx`
- A `Dialog` with 6-digit InputOTP, title "Enter Transaction PIN", and Confirm button
- Props: `open`, `onOpenChange`, `onConfirmed` callback, `loading` state
- Internally calls `pin-code-verify` edge function using the current user's phone number
- On success: calls `onConfirmed()` to proceed with the transaction
- Shows remaining attempts and lock status on failure
- Includes sound feedback from `src/lib/sounds.ts`

#### 5. Integrate PIN confirmation into all money-movement pages
- **`BankSendMoney.tsx`**: After "Confirm & Send" click, open PinConfirmDialog; on confirmed, execute `sendTransfer.mutate()`
- **`BankMobileMoney.tsx`**: After "Send" click, open PinConfirmDialog; on confirmed, execute `momoCharge.mutate()`
- **`BankBills.tsx`**: After "Confirm & Pay" click, open PinConfirmDialog; on confirmed, execute bill payment
- **`BankFundAccount.tsx`**: After fund confirmation, open PinConfirmDialog before processing
- **`BankLoans.tsx`**: Before loan repayment submission, require PIN
- **`BankPiggyBank.tsx`**: Before making a payment, require PIN
- **`BankNjangi.tsx`**: Before contributing, require PIN

#### 6. Fix `BankSettings.tsx` PIN dialog
- Change from 4-digit to 6-digit PIN to match backend validation
- Fix the edge function call to send `pin_code` instead of `pin`
- Add PIN confirmation (enter twice) before setting


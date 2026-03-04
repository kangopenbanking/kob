

# End-to-End Authentication Audit & Fix Plan — Customer App & Banking App

## Issues Identified

After thorough review of both authentication flows, here are all gaps found:

---

### BUG 1: Email Signup Does Not Redirect to Login After Success

**File**: `src/pages/customer-app/CustomerAuth.tsx` (line 170-177)
**Problem**: After `supabase.auth.signUp()` succeeds via email, the code shows a toast ("Account created! Check your email to verify") but does nothing else. The user is left stranded on the same form. They should be transitioned to a confirmation state telling them to check their email, with a link back to sign-in.

**Fix**: After email signup success, switch to a new `mode = 'email-sent'` that shows a confirmation screen with "Check your email" messaging and a "Back to Sign In" button. Same fix needed in `MobileAuthForm.tsx` (line 212-219).

---

### BUG 2: Email Verification Not Sending

**Problem**: `emailRedirectTo` is set to `API_CONFIG.SITE_URL` which is `https://kangopenbanking.com`. This is the marketing site, not the app. For the Customer App, verified users should land at the app's auth page. Additionally, auto-confirm may be disabled but the Supabase project's email configuration needs verification.

**Fix**: Set `emailRedirectTo` to `window.location.origin + '/app/auth'` for Customer App and `window.location.origin + '/bank/${institutionId}/auth'` for Banking App. This ensures the verification link brings users back to the correct app.

---

### BUG 3: Walkthrough Displays Every Time App Opens

**File**: `src/pages/customer-app/CustomerSplash.tsx` and `src/pages/banking-app/BankSplash.tsx`
**Problem**: `CustomerSplash` always starts at `phase = 'splash'`. There is no localStorage check for "has this user already seen the walkthrough?". The `PWAInstallPrompt` does have a `wasInstalled()` check, but the splash and walkthrough phases have no persistence. So every visit shows Splash -> Walkthrough -> Install Prompt.

**Fix**: On mount, check `localStorage` for `walkthrough_seen_kang-customer` (or `walkthrough_seen_bank-{institutionId}`). If found, skip directly to auth/session check. Only show walkthrough on first visit. Mark as seen after completion. Apply same fix to Banking App `BankSplash.tsx`.

---

### BUG 4: Logged-Out Users See Walkthrough Instead of Sign-In

**Problem**: When a user closes and reopens the app at `/app`, they always hit `CustomerSplash` which shows the full Splash -> Walkthrough -> Install flow. If they've already been onboarded, they should go directly to `/app/auth` (if logged out) or `/app/home` (if logged in).

**Fix**: In `CustomerSplash`, before showing any splash phase, check:
1. Has walkthrough been seen? (localStorage)
2. Is there an active session? -> Navigate to `/app/home`
3. No session but walkthrough already seen? -> Navigate to `/app/auth`

Same fix for `BankSplash`.

---

### BUG 5: PWA Install Button Not Working

**File**: `src/components/pwa/PWAInstallPrompt.tsx`
**Problem**: The `Install App` button calls `handleInstall()` which relies on `deferredPrompt` being captured from the `beforeinstallprompt` event. This event only fires on Android/Chrome when the PWA criteria are met (valid manifest, service worker, HTTPS). On iOS, it shows a guide. On desktop browsers or when criteria aren't met, `deferredPrompt` is null and `isIOS` is false, so the button does nothing (no `else` case for non-iOS desktop/unsupported browsers).

**Fix**: Add a fallback for when `deferredPrompt` is null and not iOS — show a generic instruction or just call `onContinue()`. Also ensure the button label reflects the actual capability.

---

### BUG 6: Payment Checkout Missing PayPal Option

**File**: `src/pages/PaymentCheckout.tsx` (line 293-301)
**Problem**: The payment channel select only has: Mobile Money, Card Payment, Bank Transfer, USSD. PayPal is missing.

**Fix**: Add `<SelectItem value="paypal">PayPal</SelectItem>` to the payment channel options. The gateway already supports PayPal via Flutterwave.

---

### BUG 7: Customer Registration Does Not Include All Required Fields

**File**: `src/pages/customer-app/CustomerRegister.tsx`
**Problem**: Registration wizard is well-structured (8 steps) and does include PIN creation (step 5). However:
- Email collected in step 4 is not linked back to the auth user (it's just stored in profile but not used for verification)
- The registration page is only accessible after auth, so users who signed up via email already have an account -- the flow is correct but confusing since CustomerAuth calls it "Create Account" but the actual profile setup is in CustomerRegister

This is architecturally sound but the messaging needs clarification.

---

### BUG 8: CustomerPayLinks Missing Card/PayPal in Create Form

**File**: `src/pages/customer-app/CustomerPayLinks.tsx`
**Problem**: The "Create Pay Link" form has no payment method selector at all. It only creates a link with name, description, amount, and expiry. When a payer visits the link, they see the PaymentCheckout page which does have Card/MoMo/Bank options. The user's concern seems to be about the payment methods available when paying, not when creating.

**Fix**: Already partially addressed by Bug 6. Additionally, the CustomerPayLinks create form could optionally add an "Accepted Methods" multi-select for link creators.

---

## Implementation Plan (6 Tasks)

### Task 1: Fix Walkthrough Persistence & Session-Aware Routing
**Files**: `CustomerSplash.tsx`, `BankSplash.tsx`

- Add `walkthrough_seen_{appKey}` localStorage check on mount
- If walkthrough already seen:
  - Check active session -> navigate to home
  - No session -> navigate to auth
- After walkthrough completes, set localStorage key
- This fixes both "walkthrough shows every time" and "logged-out users don't go to sign-in"

### Task 2: Fix Email Signup Post-Action Flow
**Files**: `CustomerAuth.tsx`, `MobileAuthForm.tsx`

- Add `mode = 'email-sent'` state to CustomerAuth
- After successful email signup, transition to confirmation screen showing: "Verification email sent to {email}. Please check your inbox." with "Back to Sign In" button
- Fix `emailRedirectTo` to use `window.location.origin + '/app/auth'` for Customer App
- Same fix in MobileAuthForm for Banking App: use `window.location.origin + '/bank/${institutionId}/auth'`

### Task 3: Fix PWA Install Button Fallback
**File**: `PWAInstallPrompt.tsx`

- When `deferredPrompt` is null and not iOS: show "Your browser doesn't support automatic installation" with manual instructions, or just skip to `onContinue()`
- Update button label to reflect actual capability

### Task 4: Add PayPal to Payment Checkout
**File**: `PaymentCheckout.tsx`

- Add PayPal as a payment channel option
- Add accepted payment methods display

### Task 5: Add Accepted Methods to Pay Link Creation
**File**: `CustomerPayLinks.tsx`

- Add optional multi-select for accepted payment methods (Mobile Money, Card, Bank Transfer, PayPal, USSD)
- Default to all methods enabled

### Task 6: Banking App Auth Flow Verification
**Files**: `MobileAuthForm.tsx`, `BankAuth.tsx`

- Apply same email signup confirmation flow fix
- Verify `emailRedirectTo` uses correct Banking App URL with institutionId
- Ensure consistent behavior between Customer and Banking auth flows


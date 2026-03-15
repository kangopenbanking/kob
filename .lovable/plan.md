

# Add PIN Login Option to Firebase Auth Path

## Problem
The Firebase auth method (the "One Time Code" option, which is the **Recommended** default for Cameroon) goes: captcha → phone entry → send OTP → verify OTP. It never checks if the user has a PIN set, so users who already have a PIN are forced to use OTP even though PIN login is faster and already fully implemented.

The "Standard" path correctly auto-detects PIN via `checkIfUserHasPIN()` and routes to the PIN step, but the Firebase path bypasses this entirely.

## Solution
Add a PIN check to the Firebase auth path. After the user enters their phone number on the `firebase-otp` step (before sending OTP), check if they have a PIN. If they do, show a "Login with PIN instead" button. Clicking it navigates to the existing `pin` login step, which already handles everything (auto-captcha, session creation, single-session enforcement).

## Changes to `src/pages/Auth.tsx`

### 1. Add PIN check to Firebase phone entry
In the `firebase-otp` step, after the phone number input and before the "Send Code" button, call `checkIfUserHasPIN()` when the user clicks "Send Code". If PIN exists, offer a choice. Alternatively (simpler UX), add a persistent "Login with PIN" link below the Send Code button that:
- Calls `checkIfUserHasPIN()` 
- If user has PIN → sets `loginStep` to `'pin'`
- If no PIN → shows toast "No PIN set for this number"

### 2. Update `loginGoBack` 
When navigating back from `pin` step, check which auth method was selected and return to the correct step (`firebase-otp` or `phone`).

### Implementation detail
- Add a "Login with PIN" ghost button in the `firebase-otp` phone entry UI (below "Send Code")
- Add "Forgot Password?" and "Reset PIN?" links to match the standard path
- Update `loginGoBack` for `pin` step to return to `firebase-otp` when `authMethod === 'firebase'`

### File: `src/pages/Auth.tsx`
| Area | Change |
|------|--------|
| Lines ~720-735 (firebase-otp phone entry) | Add "Login with PIN" button + "Forgot Password" / "Reset PIN" links |
| Line ~563 (loginGoBack for pin) | Route back to `firebase-otp` when `authMethod === 'firebase'` |


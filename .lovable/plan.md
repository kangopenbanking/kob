

## Plan: Add Firebase Phone OTP Authentication

### Overview
Add Firebase Phone Authentication as an additional login option across the banking app, all PWA apps, and the main authentication page. For Cameroon (+237), Firebase OTP will be the recommended default method.

### Technical Details

#### 1. Firebase SDK Integration
- Install `firebase` npm package
- Create `src/lib/firebase.ts` configuration module that initializes Firebase app with credentials from environment
- Store Firebase config values (API key, auth domain, project ID, etc.) as backend secrets using the secrets tool
- Firebase Phone Auth uses its own invisible reCAPTCHA verifier -- this will be integrated into the OTP flow

#### 2. Firebase Auth Edge Function: `firebase-phone-verify`
- New backend function that receives the Firebase ID token after successful phone verification
- Validates the Firebase token server-side
- Creates or looks up the user in the existing auth system (linking by phone number via the `profiles` table)
- Issues a session via `admin.generateLink()` (same pattern as `phone-auth-pin-login`)
- This bridges Firebase Phone Auth into the existing authentication infrastructure

#### 3. Update `MobileAuthForm` Component (Banking App + All PWAs)
- Add a tab/toggle UI: **"Email"** | **"Phone (Recommended)"**
- Phone tab shows:
  - Country code selector (defaulting to +237 Cameroon)
  - Phone number input
  - "Send Code" button that triggers Firebase `signInWithPhoneNumber()`
  - 6-digit OTP input (using existing `InputOTP` component)
  - "Verify" button that confirms the Firebase OTP, gets the ID token, and calls `firebase-phone-verify` edge function
- For Cameroon country codes, the phone tab is shown first with a "Recommended" badge
- Email tab retains the current email/password flow unchanged

#### 4. Update Main Auth Page (`src/pages/Auth.tsx`)
- Add a new "One Time Code (Recommended)" section/button alongside the existing captcha > phone > PIN/OTP flow
- This option uses Firebase Phone Auth instead of the Vonage/WhatsApp OTP pipeline
- For users with Cameroon country code (+237), this is pre-selected and marked as "Recommended for Cameroon"
- The existing Vonage/WhatsApp OTP flow remains available as an alternative

#### 5. Shared Firebase Phone Auth Hook
- Create `src/hooks/useFirebasePhoneAuth.ts` with reusable logic:
  - `sendOTP(phoneNumber)` -- sets up reCAPTCHA verifier and calls `signInWithPhoneNumber`
  - `verifyOTP(code)` -- confirms the verification code, gets Firebase ID token
  - `linkToSupabaseSession(idToken)` -- calls the edge function to create a backend session
  - State management: loading, error, step tracking
- This hook is consumed by both `MobileAuthForm` and `Auth.tsx`, ensuring consistent behavior across all apps

#### 6. Secrets Required
The following Firebase credentials will need to be stored as backend secrets:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY` (for server-side token verification in the edge function)

The client-side Firebase config (API key, auth domain, project ID) will also be stored as `VITE_`-prefixed env vars or embedded in the firebase config module since they are publishable keys.

#### 7. Files to Create/Modify

**New files:**
- `src/lib/firebase.ts` -- Firebase app initialization
- `src/hooks/useFirebasePhoneAuth.ts` -- Shared phone auth hook
- `supabase/functions/firebase-phone-verify/index.ts` -- Backend token verification + session creation

**Modified files:**
- `src/components/pwa/MobileAuthForm.tsx` -- Add phone tab with Firebase OTP alongside email
- `src/pages/Auth.tsx` -- Add "One Time Code (Recommended)" option using Firebase
- `package.json` -- Add `firebase` dependency

#### 8. Security Considerations
- Firebase ID tokens are verified server-side using Firebase Admin SDK (via the service account key)
- Rate limiting inherited from Firebase's built-in phone auth protection
- Phone numbers are linked to profiles table for cross-auth-method consistency
- The edge function uses `verify_jwt = false` in config.toml with manual token validation


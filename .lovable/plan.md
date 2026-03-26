

# Fix: SMS OTP Login Not Redirecting to Dashboard

## Root Cause

The `firebase-phone-verify` edge function returns a `magic_link` (raw URL), and the client in `useFirebasePhoneAuth.ts` tries to parse the token from the URL query params and call `supabase.auth.verifyOtp()` client-side. This approach fails because:

1. The `action_link` URL contains a raw `token`, but `verifyOtp` expects a `hashed_token` (PKCE-compatible flow)
2. No Supabase session is ever established client-side
3. When `navigateAfterAuth()` calls `getUser()`, it gets `null` — and redirects to `/app/register` instead of the dashboard

**Evidence:** Auth logs show repeated `403: invalid claim: missing sub claim` errors on `/user` endpoint from `kob.lovable.app`, confirming no valid session exists after OTP verification.

## Fix (2 files)

### 1. Update `firebase-phone-verify` edge function
Follow the same proven pattern used by `phone-auth-pin-login` and `staff-pin-login`:
- After `generateLink`, use `hashed_token` to call `supabase.auth.verifyOtp()` **server-side**
- Return `{ success: true, user_id, session: { access_token, refresh_token } }` instead of `magic_link`

### 2. Update `useFirebasePhoneAuth.ts`
- Instead of parsing `magic_link` and calling `verifyOtp` client-side, use `supabase.auth.setSession()` with the returned `access_token` and `refresh_token`
- This mirrors how `handlePinLogin` in `CustomerAuth.tsx` (line 182-185) already works

### Flow After Fix

```text
Firebase OTP confirmed
  → Edge function verifies Firebase token
  → Edge function generates magic link + verifies OTP server-side
  → Returns session tokens (access_token, refresh_token)
  → Client calls setSession() → session established
  → navigateAfterAuth() finds user → redirects to /app/home
```

## Files Changed
1. `supabase/functions/firebase-phone-verify/index.ts` — verify OTP server-side, return session
2. `src/hooks/useFirebasePhoneAuth.ts` — use `setSession` with returned tokens

## No Database Changes Required


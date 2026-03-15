

# E2E Auth Audit — Gaps Found & Fix Plan

## Critical Issues Discovered

### Issue 1: `identity-register` NOT in `config.toml` (ROOT CAUSE of registration failure)
The `identity-register` edge function is missing from `supabase/config.toml`. This means it defaults to `verify_jwt = true`. During registration, the user is NOT authenticated yet, so the function returns a **401 Unauthorized** — the "edge function error" you're experiencing.

**Fix:** Add `[functions.identity-register]` with `verify_jwt = false` to `config.toml`, then redeploy.

### Issue 2: Wrong column name in `identity-register`
The function queries `.eq('phone', phone)` on the `profiles` table, but the actual column is `phone_number`. This means phone-based registration would always create duplicate users instead of finding existing ones.

**Fix:** Change `.eq('phone', phone)` → `.eq('phone_number', phone)` in `identity-register/index.ts`.

### Issue 3: `phone-auth-verify-otp` uses deprecated import
Uses `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'` instead of `Deno.serve`. Can cause deployment/runtime instability.

**Fix:** Replace with `Deno.serve`.

### Issue 4: No OTP via Email
Currently only SMS (Vonage) and WhatsApp (Meta) are supported. No email delivery channel exists.

**Fix:** Add `email` as a delivery method in `phone-auth-send-otp`. Use the platform's existing `managed-send-email` edge function to send OTP codes via email. Update Auth.tsx to offer email as a delivery option.

---

## Implementation Plan

### Step 1: Fix `config.toml` — Add `identity-register`
Add the missing entry so the function can be called without JWT.

### Step 2: Fix `identity-register` column bug
Change `.eq('phone', phone)` to `.eq('phone_number', phone)`.

### Step 3: Modernize `phone-auth-verify-otp`
Replace deprecated `serve` import with `Deno.serve`.

### Step 4: Add email OTP delivery to `phone-auth-send-otp`
- Add `sendViaEmail()` function that calls the `managed-send-email` edge function internally
- Accept `email_address` parameter alongside `phone_number`
- Support `delivery_method: 'email'` option
- Store email delivery status in `phone_otp_codes` table

### Step 5: Update Auth.tsx for email OTP option
- Add email delivery toggle in both login and registration flows
- Allow users to receive OTP via email when phone delivery fails or as preference

### Step 6: Deploy and test all affected edge functions

### Files to modify
| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.identity-register]` with `verify_jwt = false` |
| `supabase/functions/identity-register/index.ts` | Fix `.eq('phone', phone)` → `.eq('phone_number', phone)` |
| `supabase/functions/phone-auth-verify-otp/index.ts` | Replace deprecated `serve` with `Deno.serve` |
| `supabase/functions/phone-auth-send-otp/index.ts` | Add `sendViaEmail()` delivery method using managed email |
| `src/pages/Auth.tsx` | Add email OTP delivery option in login/registration UI |


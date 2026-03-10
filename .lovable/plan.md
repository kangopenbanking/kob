

## Health Check & Audit Plan

### Critical Issue: Login "Connection Error"

**Root Cause Identified — Two problems:**

1. **The `phone-auth-check-pin` function may not be deployed with the latest CAPTCHA-optional fix.** The previous code change made CAPTCHA optional, but the function may still be running the old mandatory-CAPTCHA version. The curl test with the service role key succeeds (returns 200), but client-side calls fail with a non-2xx status, suggesting the deployed version differs from the codebase.

2. **Response field mismatch in `Auth.tsx` (line 192).** Even after the function is fixed, the login flow on `/auth` will still break:
   - The edge function returns `{ check_complete, has_pin }` 
   - But `Auth.tsx` line 192 reads `data.user_exists` — a field that **does not exist** in the response
   - This means `userExists` is always `false`, causing the app to say "Account Not Found" for every user
   - The other callers (`MobileAuthForm.tsx`, `CustomerAuth.tsx`) correctly use only `data?.has_pin` and work fine

### Fixes Required

**Fix 1 — Redeploy `phone-auth-check-pin`**
Ensure the deployed version matches the current code (CAPTCHA optional).

**Fix 2 — Fix `Auth.tsx` response field mismatch**
In `src/pages/Auth.tsx` line 192, change `data.user_exists` to `data.check_complete`:
```typescript
const userExists = data.check_complete === true;
```
This aligns with the edge function's actual response shape.

**Fix 3 — Add `verify_jwt = false` for all pre-auth edge functions**
The `config.toml` currently has no function-level configurations. Per the platform's authentication pattern (memory: `edge-function-authentication-pattern`), all edge functions should have `verify_jwt = false` and handle auth internally. The following pre-auth functions particularly need this since they are called before the user is logged in:
- `phone-auth-check-pin`
- `phone-auth-send-otp`
- `phone-auth-verify-otp`
- `phone-auth-pin-login`
- `captcha-generate`
- `captcha-verify`
- `firebase-phone-verify`
- All other public-facing functions (OIDC, JWKS, health, etc.)

All ~200 functions should be registered with `verify_jwt = false` in `config.toml` as the platform convention dictates.

### Security Scan Status

All previously identified security findings are resolved or marked as acceptable:
- `otp_brute_force` — Fixed (rate limiting + attempt tracking)
- `otp_plaintext_storage` — Fixed (SHA-256 hashing)  
- `otp_logged_plaintext` — Fixed (redacted)
- `sandbox_accounts_all_authenticated_readable` — Fixed (owner-scoped RLS)
- `service_role_overprivileged` — Accepted (infrastructure constraint)
- `SUPA_extension_in_public` — Accepted (infrastructure constraint)
- `firebase_api_key_public` — Accepted (by design)
- `client_role_checks` — Accepted (defense in depth)

No new actionable findings.

### Implementation Order

1. Update `config.toml` with `verify_jwt = false` for all edge functions
2. Fix the `Auth.tsx` `user_exists` → `check_complete` field mismatch
3. Redeploy `phone-auth-check-pin` (and all functions via publish)
4. Verify the login flow works end-to-end


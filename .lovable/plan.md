

## E2E Audit: Business Registration Flow — Findings & Fix Plan

### Root Cause Analysis

I traced the full registration journey and found a critical **dual-identity bug** that causes the edge function error and wrong dashboard redirect.

**What happens step-by-step:**

```text
1. User selects "Business Account" on /auth
2. Identity step: Firebase OTP verifies phone → creates Supabase session
   → Auth user A (e.g. 59eacf4d) with email "447534652305@phone.kob.cm"
   → NO profile created (handle_new_user trigger not firing)

3. Details step: user submits → calls identity-register edge function
   → Function checks profiles table for phone → finds NOTHING
   → Creates NEW auth user B (e.g. 8a094db4) with phone "447534652305"
   → Assigns 'merchant' role to user B
   → Tries to insert gateway_merchants for user B
   → Fails or succeeds for user B, but...

4. Active session is still user A (Firebase user)
   → User A has NO merchant role, NO merchant record
   → PIN setup runs for user A
   → /dashboard routes user A → /credit-score (personal)
```

**Evidence from database:**
- User `8a094db4` (identity-register): has `merchant` role, 0 gateway_merchants, NO profile
- User `59eacf4d` (Firebase): no merchant role, no profile, same phone number
- Two separate auth users for the same phone `+447534652305`

### Issues Found (5 gaps)

| # | Issue | Severity | Component |
|---|-------|----------|-----------|
| 1 | `identity-register` ignores the active session and creates a duplicate auth user | **Critical** | Edge Function |
| 2 | `firebase-phone-verify` does not create profiles for new users (trigger missing/broken) | **High** | Edge Function |
| 3 | `identity-register` profile UPDATE silently no-ops when profile doesn't exist | **High** | Edge Function |
| 4 | No profile reconciliation between Firebase auth users and identity-register users | **High** | Edge Function |
| 5 | `/biz/register` sets `status: 'DRAFT'` (uppercase) vs DB convention `'draft'` | **Low** | Frontend |

### Fix Plan

#### Fix 1: `identity-register` — Use authenticated user when available

Modify the edge function to:
1. Check the `Authorization` header first. If a valid JWT is present, extract the user ID and **reuse that user** instead of creating a new one.
2. If no auth header, fall back to checking `auth.users` (not just profiles) for existing users by phone/email before creating.
3. Ensure a profile row exists via UPSERT (not just UPDATE).

```text
identity-register flow (fixed):
  1. Extract auth header → getUser(token)
  2. If authenticated user found → userId = existing user ID
  3. If not authenticated → check auth.users by phone/email
  4. If still no user → createUser()
  5. UPSERT profile (not UPDATE)
  6. Assign role + create merchant record
```

#### Fix 2: `firebase-phone-verify` — Ensure profile exists

After user creation or lookup, perform a profile UPSERT to guarantee the profile row exists with the phone number set.

#### Fix 3: `identity-register` — Profile UPSERT instead of UPDATE

Change line 90-93 from `.update()` to an upsert pattern:
```typescript
await adminClient.from('profiles').upsert({
  id: userId,
  full_name: full_name || undefined,
  phone_number: phone || undefined,
}, { onConflict: 'id' });
```

#### Fix 4: `/biz/register` — Normalize status casing

Change `status: 'DRAFT'` to `status: 'draft'` in `BusinessRegister.tsx` to match the DB convention used everywhere else.

#### Fix 5: Update Auth.test.tsx

Update the existing test to reflect the current UI (some assertions reference old labels that have been changed).

### Files to Modify

1. `supabase/functions/identity-register/index.ts` — Major refactor of user resolution logic
2. `supabase/functions/firebase-phone-verify/index.ts` — Add profile UPSERT
3. `src/pages/business-app/BusinessRegister.tsx` — Fix status casing
4. `src/pages/__tests__/Auth.test.tsx` — Update test assertions

### Technical Details

**Why no profile trigger?** The `handle_new_user()` function exists but the query for triggers on `auth.users` returned empty. This means the `ON INSERT` trigger may have been dropped during a migration. Rather than reinstalling the trigger (which touches `auth` schema — forbidden), the fix ensures edge functions explicitly create profiles.

**RLS consideration:** The `gateway_merchants` INSERT policy requires `auth.uid() = user_id`. The `identity-register` function uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS, so this is not the issue. However, `/biz/register` uses the client SDK (RLS applies), so the authenticated user must match `user_id` — this works correctly.

**Dashboard routing verification:** `DashboardRouter` checks `has_role(merchant)` → navigates to `/merchant`. The `RoleGuard` on `/merchant` also checks `has_role(merchant)`. Once the fix ensures the correct user gets the merchant role, routing will work.


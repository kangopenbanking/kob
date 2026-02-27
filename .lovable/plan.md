

## Feature 1: Independent Card Colors

**Current state:** The `SectionStyle` interface has `bg_color` and `text_color` at the section level, but individual cards within sections (e.g., each quick action, each financial service card, each account carousel card) share the same hardcoded colors. There's no per-card color override.

**Approach:** Extend `app_config` with a `card_colors` map that lets admins set individual background and text colors for specific cards within each section.

### Changes

**`src/components/pwa/TenantProvider.tsx`**
- Add `CardColorOverride` interface: `{ bg_color?: string; text_color?: string }`
- Add `card_colors` to `TenantBranding`: `Record<string, CardColorOverride>` keyed by card identifier (e.g., `"quick_action_send"`, `"financial_savings"`, `"account_XAF"`)
- Parse `app_config.card_colors` from DB and expose in context

**`src/pages/banking-app/BankHome.tsx`**
- In `renderQuickActions`, `renderFinancialServices`, and `renderAccountCarousel`: look up per-card color overrides from `tenant.cardColors[cardKey]` and apply as inline styles, falling back to existing hardcoded colors

**`src/pages/admin/BankingAppManagement.tsx`**
- Add a new **"Card Colors"** sub-section inside the Section Styles card
- For each visible section (Quick Actions, Financial Services, Account Carousel), list the individual cards with color pickers for bg and text color
- Cards identified by keys like `quick_action_send`, `quick_action_receive`, `financial_savings`, etc.
- Add clear buttons to reset to defaults
- Update live preview to reflect per-card colors

---

## Feature 2: Single Session Enforcement

**Current state:** Users can sign in on multiple devices/tabs simultaneously with no restriction. The `MobileAuthForm` and Supabase auth have no session deduplication.

**Approach:** Track active sessions in a `user_active_sessions` table. On each login, invalidate all other sessions for that user by calling `auth.admin.deleteSession` via an edge function.

### Changes

**Database migration:**
- Create `user_active_sessions` table:
  - `id uuid PK`
  - `user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE`
  - `session_id text NOT NULL UNIQUE` (from Supabase auth session)
  - `device_info text`
  - `created_at timestamptz DEFAULT now()`
  - `last_active_at timestamptz DEFAULT now()`
- RLS: users can only read/delete their own sessions
- Index on `user_id`

**New edge function: `supabase/functions/enforce-single-session/index.ts`**
- Receives `{ session_id, device_info }` from client after login
- Uses service role to:
  1. Look up all existing sessions for this user in `user_active_sessions`
  2. For each old session, call `auth.admin.signOut(old_session_id, 'global')` or delete it
  3. Insert the new session record
- Returns success

**`src/hooks/useSingleSession.ts`** (new)
- Custom hook used in the PWA app shell
- After auth state changes to signed-in, calls the `enforce-single-session` edge function with the current session ID
- Listens on `onAuthStateChange` for `SIGNED_OUT` events triggered server-side (another device signed in), shows a toast "You were signed out because another session was started" and redirects to login

**`src/components/pwa/MobileAuthForm.tsx`**
- After successful email login or OTP verification, invoke the single-session enforcement before calling `onAuthSuccess()`

**`src/pages/banking-app/BankAuth.tsx`**
- Wrap with the `useSingleSession` hook to detect forced sign-outs

**Admin auth pages** (existing login flows at `/auth`)
- Add same `useSingleSession` hook to detect and handle concurrent login invalidation


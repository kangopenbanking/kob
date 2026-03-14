

# Rebuild /auth Page — Unified Multi-Account Registration & Login

## Problem

The current `/auth` page has critical gaps:
1. **All registrations land on /dashboard which routes to /credit-score (personal)** — no account-type-aware onboarding
2. **No KYC/KYB enforcement** during or after registration for any account type
3. **Signup only creates a phone-authenticated user** with no role assignment, no entity creation, and no proper routing
4. **Account type selection is decorative** — the "Or register as" cards just navigate to separate pages that require pre-authentication, creating a broken flow
5. **No visual differentiation** between account types — no colour coding, no contextual guidance
6. **Business registration requires signing in first at /auth, then navigating to /merchant-register** — a fragmented two-page flow

## Solution

Rebuild `/auth` as a **unified multi-step registration & login hub** that handles all four account types inline with proper role assignment, entity creation, PIN setup, and dashboard routing — matching the quality of the Customer App (`/app/auth`) flow.

## Architecture

```text
/auth Flow:

STEP 1: Account Type Selection (colour-coded cards)
  │
  ├─ Login → Phone/Email auth → PIN verify → DashboardRouter
  │
  └─ Register → STEP 2: Identity (phone/email + name + PIN)
                  → STEP 3: Account-specific details
                    ├─ Personal: Country, DOB → creates profile, assigns 'personal' role
                    ├─ Business: Business name, type, email → creates gateway_merchant, assigns 'merchant' role
                    ├─ Institution: Name, type, reg number → creates institution, assigns 'institution' role
                    └─ Developer: Org name, use case → creates developer_org, assigns 'developer' role
                  → STEP 4: Mandatory PIN setup (if not set during phone signup)
                  → STEP 5: Success + redirect to correct dashboard
```

## Design Specifications

- **No gradients, no emojis** — clean white/card backgrounds with subtle muted borders
- **Account type colour palette** (used for card accents, icons, progress bars):
  - Personal: `blue-600` — User icon
  - Business: `emerald-600` — Building2 icon  
  - Institution: `amber-600` — Landmark icon
  - Developer: `violet-600` — Code icon
- **Outline icons** throughout (strokeWidth 1.5)
- **Professional notes** under each account type explaining requirements (e.g., "Requires KYC verification", "KYB documents needed for production access")
- **framer-motion** step transitions matching existing codebase patterns
- **Split layout**: Form left, contextual hero right (desktop) — reuses `useAuthPageConfig` admin-managed content

## Key Correctness Fixes

1. **Role assignment on registration** — call `identity-register` edge function OR insert into `user_roles` + create entity (merchant/institution/developer_org) during signup
2. **DashboardRouter-aware routing** — after auth, navigate to `/dashboard` which already handles role-based redirection correctly
3. **PIN enforcement** — mandatory 6-digit PIN setup inline before completion
4. **Login mode** — single login flow (phone PIN / OTP / email+password) that routes through DashboardRouter to the correct portal
5. **Account-type-specific validation** — business requires business name + email, institution requires name + type + reg number, developer requires org name

## Files

| Action | File | Description |
|--------|------|-------------|
| Rewrite | `src/pages/Auth.tsx` | Complete rebuild with multi-step account-type-aware registration, login, PIN setup, and proper entity creation + role assignment |

All backend infrastructure (edge functions, DashboardRouter, RoleGuard, useAuthPageConfig) remains unchanged — this is purely a frontend rebuild that correctly uses the existing backend.

## Step-by-Step UI Flow

### Login Mode
1. Show Phone/Email tabs (same as now but cleaner)
2. Phone: captcha → check PIN → PIN entry or OTP → navigate `/dashboard`
3. Email: email + password → navigate `/dashboard`

### Registration Mode  
1. **Account Type Selection** — 4 colour-coded cards with outline icons, professional descriptions, and requirement notes. Each card shows what the account type unlocks.
2. **Identity Step** — Phone number + country selector + full name (+ email for business/institution/developer). Uses Firebase OTP for verification.
3. **Account Details Step** — Dynamic form based on selected type:
   - Personal: minimal (DOB, country — optional)
   - Business: business name, type, country, business email, business phone
   - Institution: institution name, type (bank/microfinance/fintech/etc), registration number, country
   - Developer: organization name, use case description, country
4. **PIN Setup** — Mandatory 6-digit PIN with confirmation
5. **Success** — Confirmation with what happens next (KYC required, pending approval, sandbox access, etc.) and auto-redirect to correct dashboard

### Entity Creation
On final submit, the page calls the `identity-register` edge function (already exists) which handles user creation, role assignment, and entity record creation atomically. For login, the existing phone-auth and email auth flows are preserved.


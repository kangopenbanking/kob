

# Remove Merchant Staff Login from /auth — Clean Professional Approach

## Analysis

The `/auth` page is the **public-facing personal account** login for end-users (banking, payments, personal finance). Having a "Merchant Staff Login" button with a dashed border and Bus icon here is:

1. **Confusing** — Personal users don't need to see staff-specific entry points
2. **Unprofessional** — Mixes audience concerns (consumer vs. business staff)
3. **Redundant** — Staff already have a dedicated `/staff-login` route and the Business PWA at `/biz` has its own Staff PIN login flow

The correct professional pattern (used by Stripe, Square, Shopify) is: **each audience gets its own clean entry point**, not a cluttered mega-login.

## What Changes

### 1. Remove the Merchant Staff Link from Auth.tsx
- Delete the dashed-border "Merchant Staff Login" button (lines 480-496)
- Remove the `Bus` icon import if no longer used elsewhere
- This keeps `/auth` clean and focused on personal account authentication

### 2. Improve the /staff-login page (StaffLogin.tsx)
The existing `/staff-login` page is functional but visually dated compared to the modernized `/auth`. Upgrade it to match the new design language:
- Add the same glassmorphism card style, `framer-motion` transitions, and trust badges
- Add a proper branded header with logo from `useAuthPageConfig`
- Add a "Not staff? Sign in here" link back to `/auth`
- Keep both auth methods (Email+Password, Phone+PIN) in polished tab UI

### 3. Add subtle cross-links in the right places only
- On the `/auth` hero panel (desktop right side), keep the existing account type cards (Personal, Business, Institution, Developer) — these already route to the correct registration pages
- On `/staff-login`, add a small "Personal account? Sign in here" link to `/auth`
- No staff entry point polluting the personal login form

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Remove Merchant Staff Link block (lines 480-496), clean up unused `Bus` import |
| `src/pages/merchant/StaffLogin.tsx` | Modernize UI to match Auth.tsx design language with motion, glassmorphism, branded header, trust badges, and back-link to `/auth` |


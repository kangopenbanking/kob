

# Frontend Audit & E2E Test Suite for Updated Pages

## Audit Summary

Reviewed all recently created/updated pages across the platform. Here is the status and what needs to happen:

### Pages Audited

| Page | Status | Issues Found |
|------|--------|--------------|
| `OnboardingManagement.tsx` | Functional | Dialog state bug: `setSelectedApp` called on button click but Dialog manages its own open state — review notes not tied to correct app |
| `RewardsManagement.tsx` | Functional | Uses `(supabase as any)` casts for type safety bypass; otherwise solid |
| `GettingStartedByType.tsx` | Functional | Clean, no issues |
| `IdentityGuide.tsx` | Static docs | No data persistence needed, clean |
| `OnboardingGuide.tsx` | Static docs | Clean |
| `RolesPermissions.tsx` | Static docs | Clean |
| `FeeManagement.tsx` | Functional | All 5 new fee types integrated correctly |
| `CreateFeeStructureForm.tsx` | Functional | 35 transaction types including 5 new Banking/Lending types |
| `FeeStructuresTable.tsx` | Functional | All types mapped with icons/categories |
| `useFeeEstimate.ts` | Functional | All fallback rates present for new types |
| `SecuritySettings.tsx` | Functional | MFA section present but no TOTP enrollment UI yet |
| `MerchantRegister.tsx` | Functional | Multi-step form, persists to `gateway_merchants` |
| `Auth.tsx` | Functional | 877-line auth flow with captcha + OTP + PIN |
| `Register.tsx` | Functional | Institution registration with edge function |
| `TPPRegistration.tsx` | Functional | DCR registration flow |

### Bug Found: OnboardingManagement Dialog State

The `setSelectedApp(app)` is called inside the `onClick` of the `DialogTrigger` button, but the `Dialog` component manages its own open/close state independently. When the dialog closes, `selectedApp` is not cleared, and `reviewNotes` persists across different app reviews. This needs fixing.

---

## Implementation Plan

### Task 1: Fix OnboardingManagement Dialog Bug
- Wrap Dialog in controlled mode (`open` + `onOpenChange`)
- Clear `reviewNotes` when opening a new application
- Ensure `selectedApp` is set before dialog opens

### Task 2: Create Comprehensive E2E Test Suite

Create test files for each key page/component covering rendering, form interactions, and submission flows:

**Test files to create:**

1. **`src/pages/__tests__/OnboardingManagement.test.tsx`**
   - Renders page title and stats cards
   - Renders filter controls (status, type, search)
   - Shows "No applications found" when empty
   - Opens review dialog and submits approve/reject

2. **`src/pages/__tests__/RewardsManagement.test.tsx`**
   - Renders all 3 tabs (Referrals, Rewards, Settings)
   - Referrals tab: renders table, search, void button
   - Rewards tab: renders manual credit dialog, form submission
   - Settings tab: renders config cards, save button

3. **`src/pages/__tests__/GettingStartedByType.test.tsx`**
   - Renders all 4 account type cards
   - Each card shows features, steps, and Get Started button
   - Navigation to correct auth paths on click
   - Sign In link navigates to /auth

4. **`src/pages/__tests__/FeeManagement.test.tsx`**
   - Renders fee management tabs
   - All 35 transaction types present in form
   - New Banking category types (ATM, standing order, dormancy) render correctly
   - Fee structure creation form validates and submits

5. **`src/pages/__tests__/IdentityGuide.test.tsx`**
   - Renders all 4 tabs (Auth, MFA, Sessions, Security)
   - Content renders for each tab

6. **`src/pages/__tests__/OnboardingGuide.test.tsx`**
   - Renders status flow diagram
   - All 4 account type tabs render with content

7. **`src/pages/__tests__/RolesPermissions.test.tsx`**
   - Renders all role categories
   - Permission scopes displayed

8. **`src/pages/__tests__/MerchantRegister.test.tsx`**
   - Multi-step form renders
   - Step navigation works
   - Form fields populate correctly
   - Submit triggers API call

9. **`src/pages/__tests__/SecuritySettings.test.tsx`**
   - Auth redirect when not logged in
   - Renders security tabs when authenticated

All tests will mock `supabase`, `react-router-dom`, and `sonner` consistently. Each test file will verify:
- Component renders without crashing
- Key UI elements present (headings, buttons, form fields)
- User interactions (tab switches, form fills, button clicks)
- Data persistence calls (supabase queries/mutations fire correctly)
- Error states handled

### Task 3: Minor UI Polish
- Add loading skeleton to OnboardingManagement stats cards
- Ensure consistent `toast` usage (some pages use `sonner.toast`, others `useToast` hook)

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Fix | `src/pages/admin/OnboardingManagement.tsx` (dialog state bug) |
| Create | `src/pages/__tests__/OnboardingManagement.test.tsx` |
| Create | `src/pages/__tests__/RewardsManagement.test.tsx` |
| Create | `src/pages/__tests__/GettingStartedByType.test.tsx` |
| Create | `src/pages/__tests__/FeeManagement.test.tsx` |
| Create | `src/pages/__tests__/IdentityGuide.test.tsx` |
| Create | `src/pages/__tests__/OnboardingGuide.test.tsx` |
| Create | `src/pages/__tests__/RolesPermissions.test.tsx` |
| Create | `src/pages/__tests__/MerchantRegister.test.tsx` |
| Create | `src/pages/__tests__/SecuritySettings.test.tsx` |

Each test file will follow the established pattern from `Auth.test.tsx` — mocking supabase, router, and toast before testing rendering and interactions.


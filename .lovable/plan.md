

# Admin Account-Type Suspension/Deletion + Mandatory PIN on Registration

## Two Requirements

### 1. Admin Suspend/Delete for All Account Types (Banks, Merchants, Developers)

**Current state:** `admin-manage-user` edge function only handles individual user profiles. It does not handle entity-level suspension/deletion for institutions, merchants, or developer (TPP) registrations. `MerchantManagement.tsx` has basic status toggling but no full delete with cascade or notification emails.

**Plan:**

**A. Extend `admin-manage-user` edge function** to support entity-scoped actions:
- Add actions: `suspend_institution`, `delete_institution`, `suspend_merchant`, `delete_merchant`, `suspend_developer`, `delete_developer`
- For institution suspend: update `institutions.status = 'suspended'`, ban the owner user, cascade to all staff via `staff_assignments`
- For institution delete: cascade delete across `accounts`, `transactions`, `staff_assignments`, `fee_structures`, `transaction_fees`, `institution_invoices`, `api_clients`, then the institution row and owner profile
- For merchant suspend/delete: update `gateway_merchants.status`, cascade `gateway_charges`, `gateway_refunds`, `gateway_merchant_wallets`, `merchant_staff_roles`, `pos_*` tables
- For developer suspend/delete: deactivate `tpp_registrations`, revoke `client_certificates`, remove `api_clients`
- After each action, send notification email via `managed-send-email` edge function with appropriate template (suspension notice, account deletion confirmation)
- Send push notification via `app_notifications` table insert

**B. Add email templates** to `managed-send-email`:
- `account_suspended` — notify the account holder with reason and contact info
- `account_deleted` — confirm permanent deletion
- `account_unsuspended` — reinstatement notice

**C. Update Admin UI pages:**
- **`UserManagement.tsx`**: Already has suspend/delete — keep as-is for individual users
- **`MerchantManagement.tsx`**: Add "Suspend" and "Delete" actions to the merchant action buttons (currently only has status toggle). Add confirmation dialogs with reason input. Add email/push notification trigger.
- **Create `InstitutionManagement.tsx`**: New admin page for managing banks/FIs with suspend/delete/unsuspend actions (currently no dedicated page exists for this)
- **`TPPRegistrationReview.tsx`**: Add suspend/delete actions for developer accounts

### 2. Mandatory PIN Setup on Registration (Priority)

**Current state:** 
- `/auth` (standard flow): Signup via `phone-auth-send-otp` → `phone-auth-verify-otp` already accepts `pin_code` during signup and hashes it to `profiles.pin_code_hash`. The PIN field exists in the signup form.
- `CustomerAuth.tsx`: Signup goes through Firebase OTP — **no PIN setup during registration**
- `MobileAuthForm.tsx` (Banking): Same pattern — signup via Firebase OTP, **no PIN collection**
- `MerchantRegister.tsx`: Multi-step form — **no PIN setup**
- `Register.tsx` (Institution): Registration form — **no PIN setup**
- `TPPRegistration.tsx`: Developer registration — **no PIN setup**

**Plan:**

**A. Add mandatory PIN step to all registration flows:**

- **`CustomerAuth.tsx`**: After successful Firebase OTP verification during signup, before navigating away, show a mandatory PIN setup screen. Call `pin-code-set` edge function to persist the PIN.
- **`MobileAuthForm.tsx`** (Banking app): Same pattern — after OTP verify on signup, gate navigation behind PIN setup.
- **`MerchantRegister.tsx`**: After successful merchant registration submission, redirect to PIN setup (or embed PIN fields in the form).
- **`Register.tsx`** (Institution): After institution registration, redirect to PIN setup.
- **`TPPRegistration.tsx`**: After developer registration, prompt PIN setup.

**B. Create a reusable `<MandatoryPinSetupStep />` component:**
- 6-digit PIN input with confirmation
- Calls `pin-code-set` edge function
- Shows success then redirects to destination
- Used across all registration flows for consistency

**C. Enforce PIN at the route level:**
- Update `useMandatoryPin` hook to check `profiles.pin_code_hash IS NOT NULL` directly (instead of the current phone-based check which is fragile)
- The existing `MandatoryPinSetup.tsx` page already handles the flow — wire it into post-registration redirects

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/components/auth/MandatoryPinSetupStep.tsx` (reusable PIN setup component) |
| Modify | `src/pages/customer-app/CustomerAuth.tsx` (add PIN step after signup OTP) |
| Modify | `src/components/pwa/MobileAuthForm.tsx` (add PIN step after signup OTP) |
| Modify | `src/pages/merchant/MerchantRegister.tsx` (add PIN step after submission) |
| Modify | `src/pages/Register.tsx` (add PIN step after institution registration) |
| Modify | `src/pages/TPPRegistration.tsx` (add PIN step after developer registration) |
| Modify | `supabase/functions/admin-manage-user/index.ts` (add entity-level actions + email notifications) |
| Modify | `src/pages/admin/MerchantManagement.tsx` (add suspend/delete dialogs with notifications) |
| Modify | `src/pages/admin/TPPRegistrationReview.tsx` (add suspend/delete actions) |
| Create | `src/pages/admin/InstitutionManagement.tsx` (new admin page for bank/FI management) |
| Modify | `src/hooks/useMandatoryPin.ts` (check pin_code_hash directly from profiles) |

## Database Changes

- Add `status` column to `tpp_registrations` if not present (for suspend/unsuspend)
- No other schema changes needed — `profiles.pin_code_hash`, `institutions.status`, `gateway_merchants.status` already exist

## Execution Order (PIN first as requested)

1. Create `MandatoryPinSetupStep` reusable component
2. Wire PIN setup into all 5 registration flows
3. Update `useMandatoryPin` hook
4. Extend `admin-manage-user` for entity operations + notifications
5. Update admin UI pages with suspend/delete for all account types
6. Create `InstitutionManagement.tsx`




# E2E Data-Flow & Consistency Audit — Prioritized Fix Plan

## Audit Summary: Critical Gaps Found

After tracing all four account-type workflows (Institution, Merchant, Developer, Personal), I identified **7 systemic gaps** where user actions succeed but downstream views/alerts fail silently.

---

## Gap Analysis

### Gap 1: NO Admin Notifications on ANY KYB/KYC Submission (ROOT CAUSE of "admin never sees it")
**Severity: CRITICAL**

All submit functions (`business-kyc-submit`, `gateway-merchant-kyb`, `gateway-merchant-kyb-review`, `kyc-submit`) write DB records and audit logs but **never create an `app_notifications` entry for admin users**. The admin must manually check the review pages — there is no push, no badge, no email alert.

- `business-kyc-submit/index.ts` — no admin notification
- `gateway-merchant-kyb/index.ts` — no admin notification  
- `gateway-merchant-kyb-review/index.ts` — no admin notification on submit action
- `kyc-submit/index.ts` — no admin notification
- `identity-onboarding/index.ts` — no admin notification on submit

### Gap 2: Merchant KYB Review Bypasses Edge Function (Direct DB Update)
**Severity: HIGH**

`MerchantManagement.tsx` (line 80-91) performs KYB approve/reject via **direct Supabase client update** instead of calling `gateway-merchant-kyb-review`. This means:
- No audit log
- No email notification to merchant
- No validation of state transitions
- No RBAC enforcement at the backend level

### Gap 3: Merchant KYB Submit Swallows Errors Silently
**Severity: HIGH**

`MerchantKYB.tsx` (line 158-168): If `gateway-merchant-kyb` edge function fails, it falls back to a direct client-side DB update setting `kyb_status: "submitted"`. This bypasses all server-side validation and audit logging.

### Gap 4: TPP/Developer Review — No Audit Log, No Notification
**Severity: MEDIUM**

`TPPRegistrationReview.tsx` (line 49-58) does a direct DB update (`tpp_registrations.is_active = true/false`). No audit log, no notification to the developer, no edge function call.

### Gap 5: Onboarding Applications Not Linked to KYB Submissions
**Severity: MEDIUM**

The `identity-register` function creates an `onboarding_applications` record, but `business-kyc-submit` does NOT update it. So `OnboardingManagement.tsx` shows the application in "submitted" state but the actual KYB documents are in a separate `business_kyc` table with no cross-reference in the admin view.

### Gap 6: No Admin In-App Notification Badge for Pending Reviews
**Severity: MEDIUM**

The `NotificationCenter` component and `useNotifications` hook exist but no submission workflow inserts admin-targeted `app_notifications`. Admins have zero badge count even with pending items.

### Gap 7: Deprecated `serve` Import in Multiple Edge Functions
**Severity: LOW**

`admin-kyb-verify`, `gateway-merchant-kyb`, `gateway-merchant-kyb-review`, `business-kyc-submit` all use the deprecated `serve` import.

---

## Implementation Plan (Prioritized)

### Phase 1: Admin Notification Pipeline (Fixes Gaps 1 & 6)

**Create a shared helper** `supabase/functions/_shared/admin-notify.ts`:
- Accepts `event_type`, `entity_type`, `entity_id`, `title`, `message`, `metadata`
- Queries all admin users from `user_roles` where `role = 'admin'`
- Inserts `app_notifications` for each admin with icon mapping
- Optionally triggers email via `managed-send-email` for high-priority events

**Update these edge functions** to call the helper after successful submission:
- `business-kyc-submit/index.ts` — add admin notification after insert
- `gateway-merchant-kyb/index.ts` — add admin notification after submit action
- `gateway-merchant-kyb-review/index.ts` — add admin notification after submit action
- `kyc-submit/index.ts` — add admin notification after insert
- `identity-onboarding/index.ts` — add admin notification on submit action

**Also notify on approval/rejection** (user-facing):
- `admin-kyb-verify/index.ts` — add `app_notifications` insert for the user (already sends email, but no in-app notification)
- `gateway-merchant-kyb-review/index.ts` — add user notification on review action

### Phase 2: Fix Merchant KYB Review to Use Edge Function (Fixes Gap 2)

**Modify `src/pages/admin/MerchantManagement.tsx`**:
- Replace direct DB `update` in `kybMutation` with `supabase.functions.invoke('gateway-merchant-kyb-review', { body: { action: 'review', merchant_id, decision, reason } })`
- This ensures audit logs, notifications, state validation all fire

### Phase 3: Fix Merchant KYB Submit Error Swallowing (Fixes Gap 3)

**Modify `src/pages/merchant/MerchantKYB.tsx`**:
- Remove the fallback direct DB update on edge function failure
- Instead, show the actual error to the user
- The edge function (`gateway-merchant-kyb`) already handles everything correctly

### Phase 4: Fix TPP Review to Add Audit + Notification (Fixes Gap 4)

**Modify `src/pages/admin/TPPRegistrationReview.tsx`**:
- Add audit log insert after status update
- Add `app_notifications` insert for the developer user
- Add email notification via `managed-send-email`

### Phase 5: Link Onboarding Applications to KYB (Fixes Gap 5)

**Modify `supabase/functions/business-kyc-submit/index.ts`**:
- After inserting `business_kyc`, update the user's `onboarding_applications` record to status `submitted` with metadata linking to the KYB ID
- This ensures `OnboardingManagement.tsx` reflects the actual state

### Phase 6: Modernize Deprecated Imports (Fixes Gap 7)

Update all affected edge functions to use `Deno.serve` instead of the deprecated `serve` import from `std/http/server.ts`:
- `admin-kyb-verify/index.ts`
- `gateway-merchant-kyb/index.ts`
- `gateway-merchant-kyb-review/index.ts`
- `business-kyc-submit/index.ts`

---

## Files to Create
| File | Purpose |
|------|---------|
| `supabase/functions/_shared/admin-notify.ts` | Shared helper to notify all admins on submission events |

## Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/business-kyc-submit/index.ts` | Add admin notification + link onboarding_applications + modernize import |
| `supabase/functions/gateway-merchant-kyb/index.ts` | Add admin notification + modernize import |
| `supabase/functions/gateway-merchant-kyb-review/index.ts` | Add admin + user notifications + modernize import |
| `supabase/functions/kyc-submit/index.ts` | Add admin notification |
| `supabase/functions/admin-kyb-verify/index.ts` | Add in-app notification for user + modernize import |
| `supabase/functions/identity-onboarding/index.ts` | Add admin notification on submit |
| `src/pages/admin/MerchantManagement.tsx` | Use edge function for KYB review instead of direct DB update |
| `src/pages/merchant/MerchantKYB.tsx` | Remove error-swallowing fallback on submit |
| `src/pages/admin/TPPRegistrationReview.tsx` | Add audit logging + notifications |

## Deployment
All modified edge functions will be redeployed after changes.

## Security
- No new tables needed — uses existing `app_notifications` and `audit_logs`
- Admin notification helper uses `service_role` key (already available in edge functions)
- No RLS changes needed — edge functions already bypass RLS via service role
- No breaking changes to any existing endpoint contract


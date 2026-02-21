

# Staff Role-Based Access Control for FI Portal

## Overview

This plan adds a **staff access role system** to the FI Portal, allowing institution owners and admins to assign granular portal section access to staff members (e.g., a teller can only see Accounts and Transactions, while a branch manager can see everything in their branch). It also includes end-to-end testing of the institution and developer registration flows.

---

## Part 1: Staff Role & Access Control System

### 1.1 Database Changes

**New table: `staff_portal_permissions`**

Stores which FI Portal sections each staff member can access.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| staff_assignment_id | uuid (FK -> staff_assignments) | Links to the staff member |
| section_key | text | Portal section identifier (e.g., `accounts`, `branches`, `loans`) |
| can_view | boolean | Read access |
| can_manage | boolean | Write/edit access |
| granted_by | uuid | User who granted the permission |
| granted_at | timestamptz | When granted |

**New app_role enum value: `staff`**

Add `staff` to the `app_role` enum so staff members can log in and be routed to the FI Portal with restricted access.

**New security definer function: `get_staff_portal_sections`**

Returns the list of section_keys a staff user is allowed to access for their institution.

**RLS Policies on `staff_portal_permissions`:**
- Institution owners and admins can SELECT/INSERT/UPDATE/DELETE
- Staff members can SELECT their own permissions

### 1.2 Frontend Changes

**A. Update `InstitutionStaff.tsx` - Staff Assignment Dialog**
- Add a multi-select checklist of portal sections when assigning staff
- Section options: `dashboard`, `analytics`, `accounts`, `customer-onboarding`, `branches`, `loans`, `savings`, `customers`, `transactions`, `payments`, `settlement`, `beneficiaries`, `ledger`, `billing`, `exchange-rates`, `staff`, `incidents`, `alerts`, `api-clients`, `webhooks`, `credit-api`, `woocommerce`, `consents`, `audit`, `compliance`, `regulatory`, `messaging`, `profile`, `team`, `settings`
- Predefined role templates: Teller (accounts, transactions, customers), Branch Manager (all branch operations), Compliance Officer (regulatory, audit, compliance, incidents), Loan Officer (loans, customers, accounts)

**B. Update `InstitutionLayout.tsx` - Sidebar Filtering**
- Add a `useStaffPermissions` hook that:
  1. Checks if the current user is the institution owner (full access)
  2. If not, fetches their `staff_portal_permissions` and filters the sidebar navigation to only show permitted sections
- Greyed-out or hidden menu items for sections without access
- Redirect to dashboard if user navigates to a restricted section

**C. Create `src/hooks/useStaffPermissions.ts`**
- Fetches current user's staff assignment and portal permissions
- Returns `{ isOwner, allowedSections, loading, canAccess(sectionKey) }`
- Used by InstitutionLayout to filter navigation and by individual pages for access guards

**D. Update `FIPortal.tsx` (Dashboard)**
- Staff users see a filtered dashboard with only their permitted quick action cards
- Metrics cards filtered based on section access

### 1.3 Edge Function: `staff-assign`

A secure edge function that:
1. Validates the caller is the institution owner or admin
2. Creates the staff_assignment record
3. Assigns the `staff` role to the user via `user_roles`
4. Creates `staff_portal_permissions` entries based on selected sections
5. Logs an audit event

This replaces the current client-side direct insert to properly handle the `staff` role assignment (which requires service role access).

---

## Part 2: End-to-End Registration Testing

### 2.1 Institution Registration Flow
Test the complete flow:
1. Sign up a new user at `/auth`
2. Navigate to `/register`
3. Select institution type (Bank)
4. Fill all required fields (name, registration number, phone in `+237XXXXXXXXX` format, address)
5. Submit and verify redirect to `/pending-approval`
6. Verify database records: `institutions` (status=pending), `user_roles` (role=institution), `audit_logs`

### 2.2 Developer Registration Flow
Test the complete flow:
1. Sign up a new user at `/auth`
2. Navigate to `/register`
3. Select "Developer / Third Party"
4. Fill all required fields
5. Submit and verify redirect to `/pending-approval`
6. Verify database records

### 2.3 Staff Access Flow (Post-Implementation)
1. Log in as institution owner
2. Navigate to Staff Management
3. Assign a staff member with specific section permissions
4. Log in as the staff member
5. Verify sidebar shows only permitted sections
6. Verify direct URL access to restricted sections is blocked

---

## Technical Details

### Migration SQL Summary

```text
-- Add 'staff' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Create staff_portal_permissions table
CREATE TABLE public.staff_portal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_assignment_id uuid REFERENCES staff_assignments(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  can_view boolean DEFAULT true,
  can_manage boolean DEFAULT false,
  granted_by uuid,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(staff_assignment_id, section_key)
);

-- Enable RLS + policies
-- Security definer function for fetching staff sections
```

### Files to Create
- `src/hooks/useStaffPermissions.ts` - Staff permission hook
- `supabase/functions/staff-assign/index.ts` - Secure staff assignment edge function

### Files to Modify
- `src/pages/institution/InstitutionStaff.tsx` - Add section permission UI to assignment dialog
- `src/components/institution/InstitutionLayout.tsx` - Filter sidebar based on staff permissions
- `src/pages/FIPortal.tsx` - Filter quick actions for staff users
- Each institution sub-page - Add access guard using `useStaffPermissions`

### Predefined Role Templates

| Template | Sections |
|----------|----------|
| Teller | accounts, transactions, customers, payments |
| Branch Manager | dashboard, accounts, customer-onboarding, branches, loans, savings, customers, transactions, payments, staff, incidents |
| Compliance Officer | dashboard, regulatory, audit, compliance, incidents, customers, consents |
| Loan Officer | dashboard, loans, customers, accounts, ledger |
| IT / API Manager | dashboard, api-clients, webhooks, credit-api, woocommerce, settings |


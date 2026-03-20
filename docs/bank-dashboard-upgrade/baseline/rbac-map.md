# Bank Connector Kit — RBAC Map

## Role Matrix

| Action | Institution Owner | Staff (connector section) | Platform Admin |
|---|---|---|---|
| View Overview | ✅ | ✅ | ✅ |
| Upload Files | ✅ | ✅ (if granted) | ✅ |
| View Imports | ✅ | ✅ | ✅ |
| Create/Edit Mappings | ✅ | ❌ (view only) | ✅ |
| Create Batch Payments | ✅ | ✅ (if granted) | ✅ |
| Generate Batch File | ✅ | ✅ (if granted) | ✅ |
| Upload Status Files | ✅ | ✅ (if granted) | ✅ |
| View Reconciliation | ✅ | ✅ | ✅ |
| Resolve Mismatches | ✅ | ❌ | ✅ |
| View Audit Log | ✅ | ✅ | ✅ |
| View Health | ✅ | ✅ | ✅ |
| Download Templates | ✅ | ✅ | ✅ |

## Implementation

### Frontend
- **Route Guard:** `RoleGuard` with `allowedRoles: ['institution', 'staff']`
- **Section Gate:** `useStaffPermissions` checks `connector` section in `staff_portal_permissions`
- **Bank Scope:** `useBankConnector` hook resolves `bank_id` via `institutions` → `banks` (owner) or `staff_assignments` → `banks` (staff)

### Backend (RLS)
- 15 new RLS policies on 7 connector tables
- Owner path: `banks.institution_id` → `institutions.user_id` = `auth.uid()`
- Staff path: `banks.institution_id` → `staff_assignments.institution_id` where `user_id` = `auth.uid()`
- Added `institution_id` column to `banks` table for ownership linkage

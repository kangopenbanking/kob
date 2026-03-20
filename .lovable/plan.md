

# Enhanced Dispute System — FI Kanban + Banking App Customer-to-FI Channel + Email Alerts

## Summary

Upgrade the FI Portal dispute page to a full Kanban board (matching Admin pattern), add dispute email templates to `managed-send-email`, enhance the Banking PWA to route disputes to the customer's linked institution, and wire notifications at every lifecycle stage.

## Current Gaps

| Gap | Location |
|---|---|
| FI Portal uses flat table — no Kanban board | `InstitutionDisputes.tsx` |
| No dispute email templates in `managed-send-email` | `managed-send-email/index.ts` |
| Banking PWA `BankDisputes.tsx` doesn't pass `institution_id` from route params to the dispute filing body correctly for multi-tenant routing | `BankDisputes.tsx` |
| `dispute-lifecycle` doesn't send emails on status changes — only in-app notifications | `dispute-lifecycle/index.ts` |
| `gateway-file-dispute` calls `managed-send-email` but templates don't exist | `gateway-file-dispute/index.ts` |
| FI Portal cannot assign disputes to internal staff | `InstitutionDisputes.tsx` |
| No "Escalate to Admin" confirmation or reason prompt | `InstitutionDisputes.tsx` |

## Implementation

### 1. Add 6 Dispute Email Templates to `managed-send-email`

Add templates to the existing email template registry:
- `dispute_filed_customer` — Confirmation to the customer who filed
- `dispute_filed_merchant` — Alert to merchant/FI about new dispute
- `dispute_filed_admin` — Alert to KOB admins
- `dispute_status_update` — Generic status change notification (used at every transition)
- `dispute_evidence_received` — Confirmation evidence was submitted
- `dispute_resolved_final` — Final resolution to all parties

### 2. Rebuild `InstitutionDisputes.tsx` with Kanban Board

Follow the exact Admin `DisputeManagement.tsx` pattern:
- Kanban columns: Open → Investigating → Under Review → Escalated → Won / Lost / Closed
- Animated dispute cards with `motion.div` and `AnimatePresence`
- Each card: dispute ref, amount, customer name, priority badge, days open
- Kanban / Table toggle button
- Stats row with per-stage counts (7 columns matching admin)
- Detail dialog with tabbed view: Details | Timeline | Actions
- Actions tab: Move to Status buttons, Assign to staff, Escalate to Admin, Add Note
- Staff assignment dropdown (fetch institution staff from `merchant_staff_roles` or `profiles`)
- "Escalate to Admin" button with note/reason textarea

### 3. Update `dispute-lifecycle` Edge Function — Add Email Dispatch

On every status change, invoke `managed-send-email` with `dispute_status_update` template:
- Notify the dispute owner (customer) via email on status transitions
- Notify admins via email when disputes are escalated
- Notify FI staff when customer files a dispute
- Use the existing in-app notification code (already present) alongside email

### 4. Enhance Banking PWA `BankDisputes.tsx` — Institution Routing

- Ensure `institution_id` from route params is always passed to `gateway-file-dispute`
- Add institution name display in the header (fetch from `institutions` table)
- Add a status filter dropdown
- Show which institution the dispute is filed against
- The dispute flows: Customer → Banking App → FI Portal (Kanban) → Escalate to Admin

### 5. Update `gateway-file-dispute` — Notify Institution

After filing, send notifications to the institution's admin user:
- Fetch institution `user_id` from `institutions` table using `institution_id`
- Insert `app_notifications` for the institution admin
- Invoke `managed-send-email` with `dispute_filed_merchant` template to institution email

## Dispute Flow

```text
Customer (Banking PWA)
  └── Files dispute via gateway-file-dispute
      ├── Notification → Customer (in-app + email confirmation)
      ├── Notification → FI Portal (in-app + email alert)
      └── Notification → KOB Admin (in-app)

FI Portal (Kanban Board)
  ├── Investigate / Review / Add Notes
  │   └── Notification → Customer (email + in-app on each status change)
  ├── Escalate to Admin
  │   └── Notification → Admin (in-app + email)
  └── Resolve / Reject
      └── Notification → Customer (final resolution email)

Admin (Kanban Board) — handles escalated disputes
  └── Final decision → Notification → Customer + FI (email + in-app)
```

## Files Summary

| File | Action |
|---|---|
| `supabase/functions/managed-send-email/index.ts` | Add 6 dispute email templates |
| `src/pages/institution/InstitutionDisputes.tsx` | Rebuild with Kanban board matching admin pattern |
| `supabase/functions/dispute-lifecycle/index.ts` | Add email dispatch via managed-send-email on status changes |
| `supabase/functions/gateway-file-dispute/index.ts` | Add FI notification when customer files dispute |
| `src/pages/banking-app/BankDisputes.tsx` | Enhance with status filters, institution context display |


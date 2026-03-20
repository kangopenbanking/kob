

# Full Dispute Management System — E2E Audit & Enhancement Plan

## Current State Inventory

### What Exists

| Component | Location | Status |
|---|---|---|
| **Admin Dispute Page** | `/admin/disputes` — `DisputeManagement.tsx` | Basic table UI, queries both `disputes` and `gateway_disputes`, resolve dialog |
| **Merchant Desktop Disputes** | `/merchant/disputes` — `MerchantDisputes.tsx` | Table + evidence submission via edge function |
| **Business PWA Disputes** | `/biz/disputes` — `BusinessDisputes.tsx` | Mobile card layout, evidence submission (mismatched body params) |
| **Edge: Submit Evidence** | `gateway-submit-dispute-evidence` | Works for gateway disputes, sends to Stripe, calls `gateway-dispute-notify` |
| **Edge: Dispute Notify** | `gateway-dispute-notify` | Sends emails via `send-communication` for created/evidence/resolved events, admin alerts |
| **Stripe Webhook Handler** | `gateway-webhook-stripe` | Auto-creates disputes from Stripe webhooks, atomic wallet debit/credit |
| **DB: `gateway_disputes`** | Table | charge_id, merchant_id, amount, currency, status, evidence_data, evidence_due_by, provider |
| **DB: `disputes`** | Table (legacy) | user_id, institution_id, dispute_type, reason, amount, status, resolution |

### Critical Gaps Found

| # | Gap | Severity |
|---|---|---|
| 1 | **No Consumer PWA dispute page** — customers cannot file or track disputes | HIGH |
| 2 | **No Banking PWA dispute page** — banking app users cannot file or track disputes | HIGH |
| 3 | **No FI Portal dispute management** — institutions cannot manage disputes for their customers | HIGH |
| 4 | **Admin UI is a flat table** — no Kanban board, no stage-based workflow visualization | HIGH |
| 5 | **No `dispute_ref` column** on `gateway_disputes` table (missing from schema) — code references it but it's not in the type definition | MEDIUM |
| 6 | **BusinessDisputes.tsx sends wrong body** — sends `evidence_text` but edge function expects `evidence` object | MEDIUM |
| 7 | **No dispute status history/timeline** — no audit trail of status transitions visible in UI | MEDIUM |
| 8 | **No email templates in `managed-send-email`** for disputes — `gateway-dispute-notify` uses legacy `send-communication` | MEDIUM |
| 9 | **No in-app notifications** for dispute status changes — `gateway-dispute-notify` only sends emails | MEDIUM |
| 10 | **Admin cannot escalate or add internal notes** mid-lifecycle — only final "resolve" action exists | LOW |
| 11 | **No consumer-initiated dispute filing** edge function — only Stripe webhook creates gateway disputes | MEDIUM |

## Implementation Plan

### Phase 1: Database Schema Enhancement

**Migration** — Add dispute lifecycle columns and a dispute activity log table:

```sql
-- Add dispute_ref if missing, add assignee and priority
ALTER TABLE gateway_disputes 
  ADD COLUMN IF NOT EXISTS dispute_ref TEXT,
  ADD COLUMN IF NOT EXISTS assignee_id UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'chargeback',
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Dispute activity log for timeline/Kanban history
CREATE TABLE IF NOT EXISTS dispute_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL,
  dispute_source TEXT NOT NULL DEFAULT 'gateway', -- 'gateway' or 'legacy'
  actor_id UUID,
  actor_type TEXT DEFAULT 'system', -- system, admin, merchant, customer
  action TEXT NOT NULL, -- status_change, note_added, evidence_submitted, escalated, assigned
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dispute_activities ENABLE ROW LEVEL SECURITY;
```

With RLS policies for admin full access, merchant access to their disputes, consumer access to their disputes.

### Phase 2: Edge Function — Consumer Dispute Filing

**New function: `gateway-file-dispute`** — Allows consumers and banking users to file disputes against transactions:
- Accepts: `transaction_ref`, `reason`, `description`, `dispute_type` (unauthorized, duplicate, not_received, defective, other)
- Creates entry in `disputes` table with `user_id` and `institution_id`
- Logs activity in `dispute_activities`
- Sends notifications via `gateway-dispute-notify` (new event type `dispute.customer_filed`)
- Returns dispute reference

### Phase 3: Edge Function — Dispute Lifecycle Manager

**New function: `dispute-lifecycle`** — Centralizes all dispute state transitions:
- Actions: `escalate`, `assign`, `add_note`, `change_status`, `close`
- Records every transition in `dispute_activities`
- Sends appropriate notifications (email + in-app) at each stage
- Admin can move disputes through: `open → investigating → under_review → escalated → won/lost/closed`

### Phase 4: Add Dispute Email Templates to `managed-send-email`

Add 6 templates:
1. `dispute_filed_customer` — Confirmation to customer who filed
2. `dispute_filed_merchant` — Alert to merchant about new dispute
3. `dispute_filed_admin` — Alert to admins
4. `dispute_status_update` — Generic status change notification
5. `dispute_evidence_received` — Confirmation of evidence submission
6. `dispute_resolved_final` — Final resolution notification to all parties

### Phase 5: Admin Kanban Board UI

**Rebuild `DisputeManagement.tsx`** with:
- **Kanban view** with draggable columns: Open → Investigating → Under Review → Escalated → Won / Lost / Closed
- Drag-and-drop moves dispute between stages (calls `dispute-lifecycle`)
- Each card shows: dispute ref, amount, merchant/customer name, priority badge, days open, assignee avatar
- **Timeline panel** — Click any card to see full activity history from `dispute_activities`
- **Assign & Escalate** buttons on each card
- **Internal notes** panel for admin communication
- **Toggle** between Kanban and table view
- Stats dashboard at top with counts per stage
- Filter by: source (gateway/legacy/consumer), priority, assignee, date range

### Phase 6: Consumer PWA Dispute Page

**New: `src/pages/customer-app/CustomerDisputes.tsx`** at `/customer/disputes`:
- "File a Dispute" button — form with transaction selector, reason dropdown, description
- List of filed disputes with status badges
- Detail view showing timeline of status changes
- Push notification when status changes
- Route added to customer app routing in `App.tsx`

### Phase 7: Banking PWA Dispute Page

**New: `src/pages/banking-app/BankDisputes.tsx`** at `/bank/:institutionId/disputes`:
- Similar to Consumer but scoped to banking institution transactions
- File dispute against bank transactions (transfers, withdrawals)
- Track dispute status with timeline
- Route added to banking app routing in `App.tsx`

### Phase 8: FI Portal Dispute Management

**New: `src/pages/institution/InstitutionDisputes.tsx`** at `/institution/disputes`:
- View all disputes filed by customers of this institution
- Respond to disputes with notes/evidence
- Escalate to KOB admin
- Mini-Kanban or table view scoped to institution

### Phase 9: Fix BusinessDisputes.tsx

- Fix evidence submission body to send `{ evidence: { uncategorized_text: evidence } }` instead of `{ evidence_text: evidence }`
- Add dispute filing capability (not just responding to gateway chargebacks)
- Add timeline/activity view

### Phase 10: In-App Notifications Integration

Update `gateway-dispute-notify` to also insert into `app_notifications` for:
- Merchant when dispute filed against them
- Customer when dispute status changes
- Admin when new dispute filed or escalated
- Institution staff when customer files dispute

## Files Summary

| File | Action |
|---|---|
| **Migration SQL** | Add columns to `gateway_disputes`, create `dispute_activities` table |
| `supabase/functions/gateway-file-dispute/index.ts` | Create — consumer/banking dispute filing |
| `supabase/functions/dispute-lifecycle/index.ts` | Create — centralized status management |
| `supabase/functions/managed-send-email/index.ts` | Modify — add 6 dispute templates |
| `supabase/functions/gateway-dispute-notify/index.ts` | Modify — add in-app notifications, new event types |
| `src/pages/admin/DisputeManagement.tsx` | Rebuild — Kanban board with drag-drop, timeline, assign/escalate |
| `src/pages/customer-app/CustomerDisputes.tsx` | Create — consumer dispute filing & tracking |
| `src/pages/banking-app/BankDisputes.tsx` | Create — banking dispute filing & tracking |
| `src/pages/institution/InstitutionDisputes.tsx` | Create — FI dispute management |
| `src/pages/business-app/BusinessDisputes.tsx` | Fix — evidence body params, add dispute filing |
| `src/App.tsx` | Modify — add 3 new routes |

## Dispute Status Flow

```text
┌─────────┐    ┌───────────────┐    ┌──────────────┐    ┌───────────┐    ┌─────────┐
│  OPEN   │───→│ INVESTIGATING │───→│ UNDER_REVIEW │───→│ ESCALATED │───→│ WON     │
│         │    │               │    │              │    │           │    │ LOST    │
│ Filed   │    │ Admin picks   │    │ Evidence     │    │ Senior    │    │ CLOSED  │
│ by user │    │ up case       │    │ reviewed     │    │ review    │    │         │
└─────────┘    └───────────────┘    └──────────────┘    └───────────┘    └─────────┘
     ↑                                                                       │
     └───────────────── Notifications & emails at each transition ───────────┘
```

Total: 2 new edge functions, 4 new UI pages, 3 modified edge functions, 2 modified UI pages, 1 migration.


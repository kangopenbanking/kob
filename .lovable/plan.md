

# Remittance System — Full E2E Audit Report & Fix Plan

## Audit Summary

### Components Audited

| Layer | Component | Status |
|---|---|---|
| **Adapter Layer** | `_shared/remittance-adapters.ts` | ✅ Complete — 4 providers (Thunes, TerraPay, Onafriq, Generic), HMAC-SHA256 verification, canonical event model, ledger codes |
| **Webhook Ingestion** | `remittance-webhook-ingest` | ✅ Complete — rate limiting, signature verify, dedupe via webhook_inbox, state machine transitions, triggers routing engine |
| **Routing Engine** | `remittance-routing-engine` | ✅ Complete — 3 destinations (wallet, bank, merchant/bill), double-entry ledger, auto-create ledger accounts, fee calculation |
| **Bank Confirmation** | `remittance-bank-confirm` | ✅ Complete — confirm/reject/batch/list_pending, settlement ledger posting |
| **Settlement Engine** | `remittance-settlement` | ✅ Complete — import_statement, reconciliation matching (5 mismatch types), resolve, close, partner_health |
| **Recon Cron** | `remittance-recon-cron` | ✅ Complete — stale flagging (48h), cross-reference matching, run reports, admin notifications |
| **Public API** | `remittance-engine` | ✅ Complete — list_partners, list_corridors, create_quote, get_quote, list_inbound, get_inbound, validate_destination, admin CRUD |
| **Outbound Engine** | `remittance-outbound` | ✅ Complete — get_corridors, get_quote, send, cancel, track, list_outbound, compliance checks, usage tracking |
| **DB Triggers** | `validate_remittance_status_transition`, `resolve_remittance_receiver`, `notify_remittance_status_change` | ✅ Complete |
| **Admin: Overview** | `/admin/remittance-overview` | ✅ Complete — KPIs, monitoring feed, detail dialog with events + ledger |
| **Admin: Partners** | `/admin/remittance-partners` | ✅ Complete — partner + corridor CRUD |
| **Admin: Bank Confirms** | `/admin/remittance-bank-confirmations` | ✅ Complete — pending queue, confirm/reject, recon runs |
| **Admin: Settlements** | `/admin/remittance-settlements` | ✅ Complete — statement list, recon items, resolve mismatch |
| **Admin: Outbound** | `/admin/remittance-outbound` | ✅ Complete — outbound monitoring, compliance queue with approve/reject |
| **Consumer: Send Money** | `/app/send-money` | ✅ Complete — 5-step flow, corridor picker, quote, confirm, history + tracking dialog |

---

## Gaps Found

| # | Gap | Severity | Detail |
|---|---|---|---|
| 1 | **No consumer inbound remittance tracking page** | HIGH | `remittance-engine` has `list_inbound` and `get_inbound` actions for users to track money received from diaspora, but no UI page exists. The DB trigger `notify_remittance_status_change` sends in-app notifications, but there's nowhere for the user to see their inbound remittance history or details. |
| 2 | **No banking app remittance pages** | HIGH | No remittance-related pages exist under `/bank/:institutionId/`. Banking app users (institution customers) cannot view inbound remittances or send money abroad. |
| 3 | **Outbound: compliance approval is direct DB update (bypasses edge function)** | MEDIUM | `RemittanceOutbound.tsx` lines 87-105 update `remittance_compliance_checks` and `remittances` directly from client-side. This violates the Edge Function Mediation Standard — should go through an edge function for audit trail and notification dispatch. |
| 4 | **Outbound: `listOutbound` queries by `sender_email` not `user_id`** | MEDIUM | `remittance-outbound` line 405 filters by `sender_email = user.email`. If user changes email, their transfer history is lost. Should use a sender_user_id field or the profile lookup. |
| 5 | **Outbound: no email notifications on send/status change** | MEDIUM | Outbound flow only creates `app_notifications`. No email dispatch via `managed-send-email` for outbound transfer creation or status updates. |
| 6 | **Outbound: usage tracking upsert doesn't increment** | MEDIUM | `remittance-outbound` lines 295-304 upsert `remittance_usage_tracking` with `total_amount: amount` and `transaction_count: 1`. On conflict, Supabase upsert replaces values instead of incrementing. Daily limits will never actually accumulate. |
| 7 | **Settlement: `import_statement` missing-in-provider query uses string interpolation** | LOW | Line 135 builds a `NOT IN` clause via string interpolation which could break with special characters in partner references. Should use `.not('partner_reference', 'in', ...)` with proper array handling. |
| 8 | **Admin Partners: no session token forwarded to `remittance-engine`** | LOW | `RemittancePartners.tsx` line 54 gets session but doesn't pass the token in the invoke headers, so the function uses the anon key which won't resolve the admin user. |
| 9 | **No FI Portal remittance pages** | MEDIUM | Financial institutions cannot view remittances routed to their customers or access settlement data for their institution. |
| 10 | **Outbound: cancel updates to `failed` status** | LOW | Cancel sets status to `failed`, but the DB trigger `validate_remittance_status_transition` only allows `created → pending|failed` and `pending → received|failed`. Cancel from `created` or `pending` works, but the cancelled status is conflated with genuine failures. |

---

## Fix Plan

### 1. Create Consumer Inbound Remittance Page

**New file: `src/pages/customer-app/CustomerRemittances.tsx`** at `/app/remittances`

- Header with volume summary (total received, pending, credited)
- List of inbound remittances fetched via `remittance-engine` action `list_inbound`
- Status badges and sender info
- Detail dialog with event timeline via `get_inbound`
- Navigation link added to CustomerMore.tsx
- Route registered in App.tsx

### 2. Create Banking App Remittance Pages

**New file: `src/pages/banking-app/BankRemittances.tsx`** at `/bank/:institutionId/remittances`

- Inbound remittance list scoped to institution via `remittance-engine` with institution filter
- Send money link (reuse outbound flow or redirect to `/app/send-money`)
- Route registered in App.tsx

### 3. Fix Outbound Compliance — Move to Edge Function

Add `compliance_decision` action to `remittance-outbound`:
- Accepts `check_id`, `decision`, `note`
- Updates compliance check + remittance status
- Logs audit event
- Sends email notification to sender
- Update `RemittanceOutbound.tsx` to call edge function instead of direct DB writes

### 4. Fix `listOutbound` — Query by User ID

Add `sender_user_id` to the remittance insert in `sendRemittance()` (line 219 area). Update `listOutbound` to filter by `sender_user_id = user.id` instead of `sender_email`.

This requires a migration to add `sender_user_id` column if not present (check schema).

### 5. Add Outbound Email Notifications

In `sendRemittance()`, invoke `managed-send-email` with a `remittance_outbound_created` template. In the compliance decision handler, send `remittance_outbound_approved` or `remittance_outbound_rejected`.

### 6. Fix Usage Tracking Upsert

Replace the upsert with a proper increment pattern:
```sql
-- On conflict, ADD to existing values
total_amount = remittance_usage_tracking.total_amount + amount,
transaction_count = remittance_usage_tracking.transaction_count + 1
```
This needs to be done in the edge function with a raw RPC or a proper SQL upsert.

### 7. Fix Admin Partners Auth Token

Pass session token in the `invoke` headers so the edge function can resolve the admin user for RBAC checks.

### 8. Add Consumer Remittances Nav Link

Add "Remittances" item to CustomerMore.tsx alongside the existing "Send Money Abroad" link.

## Files Summary

| File | Action |
|---|---|
| `src/pages/customer-app/CustomerRemittances.tsx` | **Create** — inbound remittance tracking page |
| `src/pages/banking-app/BankRemittances.tsx` | **Create** — banking app remittance view |
| `src/pages/customer-app/CustomerMore.tsx` | **Modify** — add Remittances nav link |
| `src/App.tsx` | **Modify** — add 2 new routes |
| `supabase/functions/remittance-outbound/index.ts` | **Modify** — fix listOutbound query, fix usage upsert, add compliance_decision action, add email notifications, store sender_user_id |
| `src/pages/admin/RemittanceOutbound.tsx` | **Modify** — call edge function for compliance instead of direct DB |
| `src/pages/admin/RemittancePartners.tsx` | **Modify** — pass auth token in invoke headers |
| **Migration** | Add `sender_user_id` column to `remittances` if missing |


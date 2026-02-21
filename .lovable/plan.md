

# Admin Portal Audit & Enhancement Plan for KOB Payment Gateway

## Audit Summary

After a comprehensive end-to-end analysis of the `/admin` portal compared to the `/fi-portal`, the KOB V1 API spec, and professional payment gateway standards, I have identified navigation issues, missing pages, incomplete features, and recommended enhancements.

---

## Part 1: Navigation & Routing Issues (Bugs to Fix)

### 1.1 Sidebar Links Pointing Outside Admin Layout
Several sidebar links route to top-level paths instead of `/admin/*`, causing the user to leave the admin layout:

| Sidebar Item | Current Path | Correct Path |
|---|---|---|
| Fee Management | `/fee-management` | `/admin/fee-management` |
| System Monitoring | `/system-monitoring` | `/admin/system-monitoring` |
| Communications | `/communications` | `/admin/communications` |
| Compliance Dashboard | `/compliance-dashboard` | `/admin/compliance-dashboard` |
| Institution Approvals | `/admin` (same as Dashboard) | `/admin/institution-approvals` or keep as-is with distinct index tabs |

These routes exist as standalone routes outside the `/admin` layout in `App.tsx` (lines 283-286), meaning clicking them breaks the admin sidebar context.

### 1.2 Duplicate/Redundant Entries
- **Audit Trail** + **Audit Logs** -- two separate sidebar entries and pages for similar functionality. Should be consolidated.
- **Institution Approvals** points to `/admin` (the dashboard index), making it visually confusing as two items highlight the same route.

### 1.3 Missing Route: Security Dashboard
- The sidebar has no link to `/admin/security-dashboard`, but a route exists in `App.tsx`. It is unreachable from navigation.

---

## Part 2: Missing Admin Pages for a Full Payment Gateway

Comparing against professional payment gateway admin standards (Stripe Dashboard, Flutterwave, Paystack) and the KOB V1 API capabilities:

### 2.1 Dispute & Chargeback Management (MISSING - Critical)
No admin page exists for managing payment disputes, refunds, or chargebacks. For a COBAC-compliant payment gateway, this is essential.
- **Page**: `/admin/disputes`
- **Features**: View disputes, approve/reject refunds, chargeback tracking, resolution workflow

### 2.2 Reconciliation Dashboard (MISSING - Critical)
While reconciliation exists in `/banking-ops`, the admin has no centralized reconciliation view.
- **Page**: `/admin/reconciliation`
- **Features**: Cross-channel reconciliation (Mobile Money, Cards, Bank Transfers), daily settlement matching, discrepancy alerts

### 2.3 Fraud Detection & AML Dashboard (MISSING - High Priority)
The anomaly detection page exists but is AI-focused. A dedicated fraud/AML dashboard is standard for payment gateways.
- **Page**: `/admin/fraud-detection`
- **Features**: Suspicious transaction flagging, AML rule management, fraud pattern visualization, watchlist management

### 2.4 Payout Management (MISSING - High Priority)
No admin page for managing payouts to merchants/institutions.
- **Page**: `/admin/payouts`
- **Features**: Scheduled payouts, payout history, failed payout retry, institution payout configuration

### 2.5 Currency & Exchange Rate Management (MISSING - Medium)
The FI Portal has exchange rates but admin has no centralized rate management.
- **Page**: `/admin/exchange-rates`
- **Features**: Set/override exchange rates for XAF/XOF/EUR/USD, rate history, margin configuration

### 2.6 Notification & Email Template Management (MISSING - Medium)
Communications page exists but lacks template management for transactional emails (payment receipts, alerts, etc.).
- **Page**: `/admin/email-templates`
- **Features**: Edit email templates, preview, test send, delivery tracking

### 2.7 Platform Revenue & Analytics (MISSING - Medium)
No admin page for platform-level revenue metrics (KOB's own fee income, not institution-level).
- **Page**: `/admin/revenue`
- **Features**: Platform fee income, revenue by channel (Mobile Money, Cards, Bank Transfer), growth metrics, MRR tracking

---

## Part 3: Incomplete/Partial Pages to Enhance

### 3.1 Payment Facilitation (`/admin/payment-facilitation`)
Currently only shows `SettlementManagement` component. Missing:
- Real-time payment monitoring (live transaction feed)
- Failed payment retry dashboard
- Payment method performance comparison
- Institution onboarding status for facilitation

### 3.2 Transaction Monitoring (`/admin/transactions`)
Currently shows basic transaction list and alerts. Missing:
- Filter by payment method (Mobile Money / Card / Bank Transfer)
- Export to CSV/PDF
- Bulk action capabilities (freeze, flag, release)
- Real-time streaming updates

### 3.3 Admin Dashboard (`/admin` index)
Currently shows institution approvals and basic stats. Should be enhanced with:
- Platform health summary (uptime, error rate, latency)
- Revenue widget (today's fees collected)
- Active payment sessions count
- Payment success/failure rate chart
- Quick actions for common admin tasks

### 3.4 Security Monitoring (`/admin/security`)
Should add:
- Active session management (force logout capability)
- IP blacklist/whitelist management UI
- Certificate management for mTLS clients

---

## Part 4: Consistency Enhancements (Matching FI Portal Quality)

### 4.1 Admin Layout Branding
The FI Portal has color accents and branded sidebar. The admin should match with:
- KOB admin branding in sidebar header
- Admin role badge/indicator
- Consistent blue/dark theme matching FI Portal

### 4.2 Navigation Config Extraction
Like the FI Portal's `navigation-config.ts`, extract admin navigation to a dedicated config file for maintainability.

### 4.3 Add Staff RBAC to Admin Portal
The FI Portal now has staff permissions. The admin portal should also support admin sub-roles:
- **Super Admin**: Full access
- **Compliance Admin**: Security, Audit, KYC, Consent sections only
- **Support Admin**: User Management, Transaction Monitoring, Disputes only
- **Technical Admin**: API, Webhooks, Sandbox, Performance sections only

---

## Part 5: Implementation Priority

### Phase 1 -- Fix Navigation Bugs (Immediate)
1. Move `/fee-management`, `/system-monitoring`, `/communications`, `/compliance-dashboard` routes inside the `/admin` layout
2. Consolidate Audit Trail + Audit Logs into one page
3. Add Security Dashboard to sidebar
4. Extract admin navigation to `admin-navigation-config.ts`

### Phase 2 -- Add Missing Critical Pages
5. Create Dispute & Chargeback Management page
6. Create Reconciliation Dashboard
7. Create Payout Management page

### Phase 3 -- Enhance Existing Pages
8. Enhance Admin Dashboard with revenue/health widgets
9. Enhance Payment Facilitation with live monitoring
10. Enhance Transaction Monitoring with filters, export, bulk actions

### Phase 4 -- Add Remaining Pages
11. Create Fraud Detection & AML Dashboard
12. Create Exchange Rate Management
13. Create Platform Revenue Analytics
14. Create Email Template Management

### Phase 5 -- Polish & RBAC
15. Apply admin branding consistency
16. Implement admin sub-role RBAC (reusing the staff_portal_permissions pattern)

---

## Technical Details

### Files to Create
- `src/components/admin/admin-navigation-config.ts` -- Centralized nav config
- `src/pages/admin/DisputeManagement.tsx` -- Disputes & chargebacks
- `src/pages/admin/ReconciliationDashboard.tsx` -- Cross-channel reconciliation
- `src/pages/admin/PayoutManagement.tsx` -- Payout management
- `src/pages/admin/FraudDetection.tsx` -- Fraud & AML dashboard
- `src/pages/admin/ExchangeRateManagement.tsx` -- Currency rate admin
- `src/pages/admin/RevenueAnalytics.tsx` -- Platform revenue
- `src/pages/admin/EmailTemplates.tsx` -- Notification templates

### Files to Modify
- `src/components/admin/AdminLayout.tsx` -- Fix navigation paths, add branding, add missing links
- `src/App.tsx` -- Move orphaned admin routes inside `/admin` layout, add new routes
- `src/pages/Admin.tsx` -- Enhance dashboard with revenue/health widgets
- `src/pages/admin/PaymentFacilitation.tsx` -- Add live monitoring, failed payments
- `src/pages/admin/TransactionMonitoring.tsx` -- Add filters, export, bulk actions

### Database Changes
- Add `disputes` table (id, payment_id, reason, status, amount, resolution, created_at)
- Add `payouts` table (id, institution_id, amount, currency, status, payout_method, scheduled_at, completed_at)
- Add `email_templates` table (id, template_key, subject, body_html, variables, is_active)
- Add `admin_portal_permissions` table (mirroring staff_portal_permissions for admin sub-roles)


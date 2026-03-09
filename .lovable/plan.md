

# Phase 2: Financial Operations - Implementation Plan

## Current State Analysis

### ✅ Already Implemented
1. **Merchant Refunds** (`src/pages/merchant/MerchantRefunds.tsx`)
   - Lists refunds with filtering
   - Shows refund statistics
   - Connected to `gateway_refunds` table
   
2. **Transaction Reconciliation** (`src/pages/admin/ReconciliationDashboard.tsx`)
   - Cross-channel reconciliation for Mobile Money, Cards, and Bank Transfers
   - Multi-method matching algorithms (exact reference, amount+date, fuzzy description)
   - Edge function: `bank-reconcile`
   
3. **Invoice Generation System**
   - Edge function: `generate-invoice` (institution-level invoicing)
   - Edge function: `send-invoice-email`
   - Database function: `generate_institution_invoice`
   - Table: `institution_invoices`

4. **Settlement Infrastructure**
   - `SettlementManagement` component in admin
   - Edge functions: `settlement-calculate`, `settlement-process`
   - Automated settlement cron: `automated-settlement-cron`

### ❌ Missing Components

1. **Business App Refunds Page**
   - No `/business-app/refunds` route
   - Business users need to initiate refunds on charges collected through their wallet

2. **Fee Transparency Dashboard**
   - No dedicated fee breakdown visualization for merchants
   - No real-time fee estimator widget
   - Missing per-transaction fee disclosure for business users

3. **Admin Settlement Approval Workflow**
   - `SettlementManagement` exists but lacks approval/rejection UI
   - No audit trail for settlement decisions
   - Missing manual intervention controls

4. **Admin Invoice Management UI**
   - Invoice generation exists, but no admin page to:
     - Browse all institution invoices
     - Manually generate invoices
     - Mark invoices as paid/overdue
     - Send reminder emails

---

## Implementation Plan

### 1. Business App Refunds (`src/pages/business-app/BusinessRefunds.tsx`)

**Purpose**: Allow business users to process refunds for wallet-funded charges.

**Features**:
- Search charges by reference or customer phone
- Display charge details with refund eligibility
- Initiate full/partial refunds
- Track refund status (pending → processing → completed/failed)
- PIN confirmation before refund execution

**Technical Approach**:
- Query `gateway_charges` where `merchant_id` matches business user
- Call `gateway-create-refund` edge function
- Real-time status updates via polling or Supabase realtime

**Database Integration**:
- Read from: `gateway_charges`, `gateway_refunds`, `gateway_merchants`
- RLS: Only show charges belonging to user's merchant account

---

### 2. Fee Transparency Dashboard (`src/pages/merchant/MerchantFees.tsx`)

**Purpose**: Transparent fee breakdown and cost analysis for merchants.

**Features**:
- **Summary Cards**:
  - Total fees paid (this month, last month, YTD)
  - Fee-to-revenue ratio
  - Average fee per transaction
  
- **Fee Breakdown Chart** (Pie/Bar):
  - By transaction type (card, mobile money, bank transfer)
  - By fee component (fixed, percentage, platform fee)
  
- **Transaction Fee History Table**:
  - Date, transaction ref, type, amount, fee charged
  - Filterable by date range and transaction type
  
- **Fee Estimator Widget**:
  - Input: transaction type + amount
  - Output: estimated fee breakdown

**Technical Approach**:
- Query `transaction_fees` table filtered by `merchant_id` via institution
- Use `calculate_transaction_fee` database function for estimates
- Visualizations using `recharts` (already in dependencies)

**Database Integration**:
- Read from: `transaction_fees`, `fee_structures`
- Edge function: `gateway-fee-estimate` (already exists)

---

### 3. Admin Settlement Approval (`src/pages/admin/SettlementApproval.tsx`)

**Purpose**: Manual approval workflow for institutional settlements before disbursement.

**Features**:
- **Pending Settlements Queue**:
  - Institution name, settlement amount, period, transaction count
  - "View Details" button expands breakdown
  
- **Settlement Details Modal**:
  - Inflows (by channel), outflows, fees collected, net amount
  - Transaction list (paginated)
  - Settlement recipient bank details
  
- **Approval Actions**:
  - Approve → triggers bank transfer
  - Reject → marks settlement as rejected, requires reason
  - Hold → pauses settlement, flags for investigation
  
- **Audit Trail**:
  - All approval/rejection decisions logged with admin user ID, timestamp, reason
  
**Technical Approach**:
- Query `settlement_transactions` with `status = 'pending_approval'`
- New edge function: `admin-approve-settlement` (approve/reject/hold actions)
- Update settlement status atomically with audit log entry

**Database Changes**:
- Add `status` enum to `settlement_transactions`: `pending_approval`, `approved`, `rejected`, `on_hold`, `completed`
- Add `reviewed_by`, `reviewed_at`, `review_notes` columns
- Create `settlement_reviews` audit table

---

### 4. Admin Invoice Management (`src/pages/admin/InvoiceManagement.tsx`)

**Purpose**: Centralized admin interface for institution invoicing.

**Features**:
- **Invoice List Table**:
  - Invoice number, institution, billing period, amount, status, due date
  - Filters: status (pending/sent/paid/overdue), date range, institution
  
- **Manual Invoice Generation**:
  - Select institution, billing cycle, period
  - Preview fee breakdown before generating
  - One-click generate & send
  
- **Invoice Actions**:
  - View PDF (export)
  - Mark as paid (manual override)
  - Send reminder email
  - Void/cancel invoice
  
- **Statistics Cards**:
  - Total invoiced (current month)
  - Outstanding amount
  - Collection rate %

**Technical Approach**:
- Query `institution_invoices` with institution join
- Call existing `generate-invoice` edge function
- New edge function: `admin-invoice-actions` (mark paid, send reminder, void)
- PDF generation using existing `useRegulatoryPdfExport` hook pattern

**Database Integration**:
- Read/Write: `institution_invoices`, `transaction_fees`
- Update invoice `status` and `paid_at` timestamp

---

## Routing Integration

### Admin Routes (in `src/App.tsx`)
```typescript
// Inside AdminLayout routes (~line 540)
<Route path="settlement-approval" element={<SettlementApproval />} />
<Route path="invoice-management" element={<InvoiceManagement />} />
```

### Merchant Routes
```typescript
// Inside MerchantLayout routes (~line 500)
<Route path="fees" element={<MerchantFees />} />
```

### Business App Routes
```typescript
// Inside BusinessAppLayout routes (~line 850)
<Route path="refunds" element={<BusinessRefunds />} />
<Route path="fees" element={<BusinessFees />} /> {/* Reuse MerchantFees with slight adjustments */}
```

---

## Database Schema Updates

### 1. Settlement Reviews Table
```sql
CREATE TABLE settlement_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlement_transactions(id),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'on_hold')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
```

### 2. Update Settlement Transactions
```sql
ALTER TABLE settlement_transactions 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_approval' 
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'on_hold', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;
```

### 3. RLS Policies
- `settlement_reviews`: Admin-only read/write
- Merchants can read their own `transaction_fees` records
- Business users inherit merchant permissions via `gateway_merchants` relationship

---

## Edge Functions

### New Functions Required

1. **`admin-approve-settlement`**
   - Input: `{ settlement_id, action: 'approved' | 'rejected' | 'on_hold', notes }`
   - Validates admin role via `has_role(auth.uid(), 'admin')`
   - Updates settlement status
   - Inserts audit record in `settlement_reviews`
   - If approved: triggers bank transfer via `settlement-process`

2. **`admin-invoice-actions`**
   - Input: `{ invoice_id, action: 'mark_paid' | 'send_reminder' | 'void', metadata }`
   - Validates admin role
   - Updates invoice status
   - For `send_reminder`: calls `send-invoice-email`
   - Logs action in `audit_logs`

### Existing Functions to Leverage
- ✅ `gateway-create-refund` (for Business Refunds)
- ✅ `gateway-fee-estimate` (for Fee Transparency)
- ✅ `generate-invoice` (for Invoice Management)
- ✅ `settlement-calculate` & `settlement-process`

---

## UI/UX Patterns

### Navigation Updates

**Admin Command Palette** (⌘K):
- Add: "Settlement Approval", "Invoice Management"

**Merchant Sidebar**:
- New section: "Financial Insights" → Fees, Invoices (if applicable)

**Business App Bottom Nav**:
- Add: "Refunds" icon in More menu

### Shared Components to Create

1. **`<FeeBreakdownCard />`** - Reusable fee visualization
2. **`<SettlementDetailsSheet />`** - Slide-out panel for settlement breakdown
3. **`<InvoicePdfViewer />`** - PDF preview modal with download
4. **`<RefundConfirmDialog />`** - PIN-protected refund confirmation

---

## Security Considerations

1. **Settlement Approval**:
   - Require `admin` role via `has_role()` function
   - Dual approval for settlements > threshold (e.g., 10M XAF)
   - IP address logging in audit trail

2. **Refund Processing**:
   - PIN verification before refund creation
   - Refund amount cannot exceed original charge
   - Rate limiting: max 5 refunds per merchant per hour

3. **Fee Transparency**:
   - Merchants can only view their own fees
   - No exposure of platform's cost structure (only final fee shown)

---

## Testing Strategy

### Unit Tests (Vitest)
- Fee calculation logic
- Settlement approval state transitions
- Invoice status updates

### Edge Function Tests
- `admin-approve-settlement`: Test all actions (approve/reject/hold)
- Verify RLS prevents non-admins from calling sensitive functions

### Integration Tests
- End-to-end refund flow (search charge → initiate refund → verify status)
- Settlement approval → bank transfer trigger
- Invoice generation → email delivery

---

## Rollout Plan

### Phase 2a (Week 1)
1. Business App Refunds page
2. Merchant Fee Transparency Dashboard
3. Database schema updates for settlements

### Phase 2b (Week 2)
1. Admin Settlement Approval UI
2. Admin Invoice Management UI
3. New edge functions deployment

### Phase 2c (Week 3)
1. Navigation/routing integration
2. Testing & QA
3. Documentation updates


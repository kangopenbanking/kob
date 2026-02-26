

# MULTI-USER DASHBOARD ENHANCEMENT PLAN

## CURRENT STATE ANALYSIS

After auditing all four portal dashboards, navigation configs, and 100+ pages, here is the gap analysis:

### Portal Dashboard Inventory

| Portal | Pages | Nav Sections | Dashboard Sophistication |
|--------|-------|-------------|------------------------|
| **Customer** (DashboardLayout) | 14 pages (credit, savings, loans, payments, etc.) | 4 sections | Moderate — widget system exists, but basic cards |
| **Merchant** | 17 pages | 6 sections | Basic — flat tables, minimal charts (only 2 chart types in Analytics) |
| **FI Portal** | 34 pages | 10 sections | Moderate — metrics cards, tabs, but plain tables |
| **Admin** | 37 pages | 7 sections | Moderate — stat cards, pending lists, audit logs |
| **Developer** | 54 pages | N/A (sidebar in DeveloperLayout) | Documentation-focused, adequate |

### UX/UI Gap Analysis (vs PayPal/Revolut/Cash App)

**Common gaps across all portals:**
1. **No unified stat card component** — each page reinvents metric display with raw Card+CardHeader+CardContent
2. **No transaction detail drawers** — clicking a row does nothing (no drill-down)
3. **No date range pickers** — analytics pages lack time range selectors
4. **No empty state illustrations** — just plain text "No data" messages
5. **No skeleton loading consistency** — some pages use Loader2 spinner, others use Skeleton components
6. **No pagination** — most tables load all data with `.limit(200)`, no page controls
7. **Minimal chart diversity** — only BarChart and PieChart used; no area charts, sparklines, or trend indicators
8. **No notification badges on sidebar items** — no unread counts for disputes, alerts

### Per-Portal Specific Gaps

**Merchant Portal:**
- MerchantPayouts: 52 lines, bare table, no filters, no export
- MerchantSettlements: 53 lines, bare table, no detail view
- MerchantAnalytics: Only 2 charts (daily revenue bar, channel pie), no KPIs, no date range
- Missing: Wallet balance overview on dashboard, webhook delivery status, real-time charge notifications
- Missing: Transaction detail sheet/drawer when clicking a row

**FI Portal:**
- Dashboard has metrics but no charts or trend indicators
- No gateway transaction overview on main dashboard
- Missing: Reconciliation dashboard (exists in admin but not FI)
- Missing: Fraud alerts view (exists in admin only)

**Customer Dashboard:**
- Widget system is good but widgets render only if DB records exist
- No onboarding flow for new customers with zero data
- Missing: Quick transfer/pay shortcut widget
- Missing: Spending insights / category breakdown

**Admin Dashboard:**
- Main dashboard (Admin.tsx) is 622 lines of monolithic code
- Missing: Real-time metrics refresh
- Missing: Platform health sparklines on main dashboard

---

## IMPLEMENTATION PLAN

Given the scale (~35 pages need enhancement), I'll focus on the highest-impact improvements that modernize the experience without breaking existing functionality. The work is organized into 3 batches.

### Batch 1: Shared UI Components + Merchant Portal (Highest Impact)

**New shared components (5 files):**

| File | Purpose |
|------|---------|
| `src/components/ui/stat-card.tsx` | Reusable metric card with icon, trend indicator (up/down arrow + percentage), and sparkline support. Replaces the repeated Card+CardHeader pattern across all portals. |
| `src/components/ui/data-table-pagination.tsx` | Pagination controls (Previous/Next, page numbers, items-per-page selector) for all table views. |
| `src/components/ui/empty-state.tsx` | Illustrated empty state with icon, title, description, and optional CTA button. Replaces plain "No data" text. |
| `src/components/ui/date-range-picker.tsx` | Date range selector with presets (Today, 7d, 30d, 90d, Custom) for analytics pages. |
| `src/components/ui/transaction-detail-sheet.tsx` | Slide-out sheet showing full transaction details, timeline, and related events when clicking a row. |

**Merchant Portal enhancements (6 files modified):**

1. **MerchantDashboard.tsx** — Add wallet balance card (query `gateway_merchant_wallets`), add sparkline to revenue stat, add recent disputes count badge, add "Quick Actions" row (Create Payment Link, Send Invoice, View API Keys)
2. **MerchantAnalytics.tsx** — Add date range picker, add KPI stat cards row (Total Volume, Avg Transaction, Refund Rate, Chargeback Rate), add Area chart for revenue trend, add success/failure rate donut
3. **MerchantPayouts.tsx** — Add search + status filter, add summary stats row, add CSV export, use empty-state component
4. **MerchantSettlements.tsx** — Add summary stats (total settled, pending, fees deducted), add detail expansion on row click
5. **MerchantTransactions.tsx** — Add pagination, add transaction detail sheet on row click, add date range filter
6. **MerchantRefunds.tsx** — Enhance with filters and stats summary

### Batch 2: Customer Dashboard + FI Portal

**Customer Dashboard (3 files):**

1. **Dashboard.tsx** — Add onboarding empty state for new users (when no accounts exist), add spending category breakdown widget, improve widget grid responsiveness
2. **New: `src/components/dashboard/widgets/SpendingInsightsWidget.tsx`** — Donut chart showing spending by category from transactions
3. **BalanceWidget.tsx** — Add trend sparkline, add currency breakdown for multi-currency accounts

**FI Portal (4 files):**

1. **FIPortal.tsx** — Add mini charts (sparklines) to metric cards, add quick action buttons, add recent gateway activity feed
2. **InstitutionAnalytics.tsx** — Add date range picker, add comparison period (vs previous), add chart type toggles
3. **InstitutionTransactions.tsx** — Add pagination, add transaction detail sheet
4. **InstitutionSettlement.tsx** — Add settlement summary cards with trend indicators

### Batch 3: Admin Portal + Polish

**Admin Portal (3 files):**

1. **Admin.tsx** — Refactor: extract stat cards into StatCard component usage, add platform health sparklines, add real-time refresh button
2. **TransactionMonitoring.tsx** — Add pagination, add date range, add export
3. **ReconciliationDashboard.tsx** — Add match rate donut, add mismatch severity indicators

---

## TECHNICAL APPROACH

### Shared StatCard Component Design
```text
┌──────────────────────────┐
│ ┌──┐  Total Revenue      │
│ │$$│  ────────────────    │
│ └──┘  1,234,567 XAF      │
│       ▲ 12.5% vs last 7d │
│       ▁▂▃▄▅▆▇ (sparkline) │
└──────────────────────────┘
```

### Transaction Detail Sheet
```text
┌─ Sheet (slides from right) ──────┐
│ Charge #chg_abc123               │
│ ─────────────────────────        │
│ Amount:    50,000 XAF            │
│ Status:    ● Successful          │
│ Channel:   Mobile Money          │
│ Customer:  john@example.com      │
│ Created:   Feb 26, 2026 14:30    │
│                                  │
│ Timeline                         │
│ ● Created     14:30:00           │
│ ● Processing  14:30:02           │
│ ● Successful  14:30:15           │
│                                  │
│ Provider Details                 │
│ { raw provider JSON }            │
└──────────────────────────────────┘
```

### Pagination Pattern
All table pages will use offset-based pagination with configurable page size (10/25/50). The pattern queries Supabase with `.range(offset, offset + limit - 1)` and uses `{ count: 'exact' }` for total count.

### Date Range Picker Presets
- Today, Last 7 days, Last 30 days, Last 90 days, This month, Last month, Custom range
- Stored in URL search params for shareability

---

## FILES SUMMARY

### New Files (7)
| File | Description |
|------|-------------|
| `src/components/ui/stat-card.tsx` | Reusable metric card with trend + sparkline |
| `src/components/ui/data-table-pagination.tsx` | Pagination controls |
| `src/components/ui/empty-state.tsx` | Illustrated empty state |
| `src/components/ui/date-range-picker.tsx` | Date range selector with presets |
| `src/components/ui/transaction-detail-sheet.tsx` | Transaction detail slide-out |
| `src/components/dashboard/widgets/SpendingInsightsWidget.tsx` | Spending category donut |
| `src/components/dashboard/widgets/WalletWidget.tsx` | Merchant wallet balance widget |

### Modified Files (~15)
| File | Changes |
|------|---------|
| `src/pages/merchant/MerchantDashboard.tsx` | Wallet card, sparklines, quick actions |
| `src/pages/merchant/MerchantAnalytics.tsx` | Date range, KPIs, area chart, donut |
| `src/pages/merchant/MerchantPayouts.tsx` | Filters, stats, export, empty state |
| `src/pages/merchant/MerchantSettlements.tsx` | Stats row, detail expansion |
| `src/pages/merchant/MerchantTransactions.tsx` | Pagination, detail sheet, date range |
| `src/pages/merchant/MerchantRefunds.tsx` | Filters, stats summary |
| `src/pages/Dashboard.tsx` | Onboarding state, spending widget |
| `src/pages/FIPortal.tsx` | Sparklines, quick actions, activity feed |
| `src/pages/institution/InstitutionTransactions.tsx` | Pagination, detail sheet |
| `src/pages/institution/InstitutionAnalytics.tsx` | Date range, comparison |
| `src/pages/Admin.tsx` | StatCard usage, sparklines |
| `src/pages/admin/TransactionMonitoring.tsx` | Pagination, date range |
| `src/pages/developer/Changelog.tsx` | v3.1.0 entry |

### No Database Changes Required
All enhancements use existing tables and queries. No new migrations needed.

### No Breaking Changes
- All existing routes preserved
- All existing functionality maintained
- Enhancements are additive only (new UI components, filters, charts)
- Navigation configs unchanged


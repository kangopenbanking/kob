

# Payment Command Center Dashboard

## Overview

Build a comprehensive real-time Payment Command Center at `/admin/payment-command-center` with 8 integrated panels: metrics overview, live transaction stream, provider health, webhook monitor, merchant balances, error/alert center, reconciliation tool, and performance charts.

## Architecture

The dashboard will be a single admin page composed of modular tab panels. It queries gateway tables (`gateway_charges`, `gateway_payouts`, `gateway_refunds`, `gateway_merchant_wallets`, `webhook_inbox`, `gateway_webhook_events`, `reconciliation_mismatches`, `api_usage_metrics`) and uses Supabase Realtime for live updates. No new edge functions are needed — all data is queryable client-side with existing RLS (admin role).

## Components to Create

### 1. Main Page: `src/pages/admin/PaymentCommandCenter.tsx`
Tabbed layout with 8 sections using existing UI primitives (`Tabs`, `StatCard`, `Card`, `Table`, `Badge`, `Select`, `Input`). Uses `@tanstack/react-query` for data fetching and Supabase Realtime for live updates.

### 2. Tab Panels (inline or extracted as needed):

**Overview Tab** — 6 stat cards:
- Total payments today, successful, failed, pending, refunds processed, active providers
- Queries: `gateway_charges` filtered by today's date, grouped by status
- Mini sparkline from hourly counts

**Live Transactions Tab** — Real-time table:
- Columns: tx_ref, provider (channel), merchant_id, amount, currency, status, created_at
- Supabase Realtime subscription on `gateway_charges` for INSERT/UPDATE
- New rows animate in with highlight
- Auto-scroll with pause on hover

**Provider Health Tab** — 3 provider cards (Stripe, Flutterwave, PayPal):
- Last successful charge time from `gateway_charges` per channel
- Average response time from `api_usage_metrics` per endpoint pattern
- Error count (last 24h) from `api_usage_metrics` where status_code >= 400
- Status badge: operational / degraded / down

**Webhook Monitor Tab** — Event log table:
- Source: `webhook_inbox` table, ordered by received_at DESC
- Columns: provider, event_type, idempotency_key, processed (boolean), received_at
- Highlight failed/duplicate entries with red/yellow badges

**Merchant Balances Tab** — Settlement overview:
- Source: `gateway_merchant_wallets` joined with `gateway_merchants`
- Columns: merchant name, currency, available_balance, pending_balance, ledger_balance, updated_at
- Search by merchant name

**Error & Alert Center Tab** — Critical issues:
- Source: `transaction_monitoring_alerts` + `system_alerts`
- Severity filter (critical/high/medium/low)
- Columns: type, severity, description, timestamp, status

**Reconciliation Tab** — Mismatch viewer:
- Source: `reconciliation_runs` + `reconciliation_mismatches`
- Columns: run_id, entity_type, entity_id, mismatch_type, db_value, provider_value, status
- Button to trigger `gateway-reconciliation` edge function

**Performance Tab** — Charts:
- Payments per minute (last hour) — `gateway_charges` grouped by minute
- API response time trend — `api_usage_metrics` avg response_time_ms by 5-min bucket
- Uses `recharts` (already installed): `AreaChart`, `BarChart`

### 3. Transaction Search Bar (persistent across tabs)
- Filter by: tx_ref, merchant_id, channel (provider), status, date range
- Applied to Live Transactions and Overview queries

## Files to Create/Edit

| File | Action |
|---|---|
| `src/pages/admin/PaymentCommandCenter.tsx` | Create — main dashboard page (~500 lines) |
| `src/components/admin/admin-navigation-config.ts` | Edit — add nav entry under "Payments & Settlements" |
| `src/App.tsx` | Edit — add route `payment-command-center` |
| `src/components/admin/AdminCommandPalette.tsx` | Edit — add command palette entry |

## Integration Points

- **Realtime**: Subscribe to `gateway_charges` channel for live transaction stream
- **Auth**: Already protected by `ProtectedRoute requiredRole="admin"` on the `/admin` parent route
- **Existing patterns**: Follows `TransactionMonitoring.tsx` and `ReconciliationDashboard.tsx` patterns for queries and UI structure
- **No new database tables or edge functions needed** — all data exists in current schema

## Navigation Entry
Add to "Payments & Settlements" section in admin nav config:
```
{ title: "Payment Command Center", path: "/admin/payment-command-center", icon: Activity }
```


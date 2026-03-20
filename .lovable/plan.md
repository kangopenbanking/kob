

# KOB Bank Connector Kit — FI Portal Implementation Plan

## Current State

**FI Portal (`/fi-portal`)** is the bank/institution dashboard with:
- `InstitutionLayout.tsx` — sidebar + header with `NotificationCenter`
- `navigation-config.ts` — 9 nav sections, 40+ routes
- `useStaffPermissions` hook — section-based access via `staff_portal_permissions` table
- `RoleGuard` with `allowedRoles: ['institution', 'staff']`
- All routes nested under `/fi-portal/*` in `App.tsx`

**Backend already exists:**
- `bank-file-connector` edge function with 18 actions (upload, mapping, ingestion, batch, status, sandbox)
- 7 new tables: `bank_file_uploads`, `bank_file_rows`, `bank_data_mappings`, `ingestion_runs`, `bank_batch_jobs`, `bank_batch_items`, `bank_status_events`
- `bank-files` storage bucket
- RLS: currently admin + service_role only (needs bank-scoped policies for FI users)

**Gap:** Zero FI-portal pages exist for the connector kit. All file connector UI is admin-only (`AdminBankDirectory.tsx`). Banks cannot self-serve.

---

## Architecture Decisions

1. **Routes:** All new pages under `/fi-portal/connector/*` — fits existing nested layout pattern
2. **Nav section:** New "Bank Connector Kit" section in `navigation-config.ts` with `sectionKey: 'connector'`
3. **RBAC:** Leverage existing `staff_portal_permissions` + `useStaffPermissions` for section-level gating. Add `connector` to `ALL_PORTAL_SECTIONS`. Backend calls use institution's `bank_id` resolved from the logged-in user's institution.
4. **Bank ID resolution:** Create a small hook `useBankConnector` that resolves the institution's linked `bank_id` from the `banks` table (via `institution_id` or `user_id`).
5. **RLS:** Add bank-scoped RLS policies so institution owners can read/write their own bank's connector data.
6. **Reusable components:** Create a shared `FIPageHeader` (adapting `AdminPageHeader` for FI context) and shared status badge/table skeleton components.

---

## Phase 1 — Infrastructure (DB + RBAC + Navigation)

### 1a. Database Migration
- Add RLS policies to all 7 connector tables allowing institution owners to access rows matching their `bank_id`:
  - `bank_file_uploads`, `bank_file_rows`, `bank_data_mappings`, `ingestion_runs`, `bank_batch_jobs`, `bank_batch_items`, `bank_status_events`
  - Pattern: `USING (bank_id IN (SELECT id FROM banks WHERE institution_id IN (SELECT id FROM institutions WHERE user_id = auth.uid())))`
- Add `connector` to any permission enums if needed
- Add `connector` section key entries for the `ALL_PORTAL_SECTIONS` array

### 1b. Navigation Config
- Add new section to `navigation-config.ts`:
  ```
  "Bank Connector Kit" section with items:
  - Overview          /fi-portal/connector           (sectionKey: 'connector')
  - Uploads & Imports /fi-portal/connector/uploads    (sectionKey: 'connector')
  - Mapping Profiles  /fi-portal/connector/mappings   (sectionKey: 'connector')
  - Batch Payments    /fi-portal/connector/batches    (sectionKey: 'connector')
  - Status Files      /fi-portal/connector/status     (sectionKey: 'connector')
  - Reconciliation    /fi-portal/connector/reconciliation (sectionKey: 'connector')
  - Connector Health  /fi-portal/connector/health     (sectionKey: 'connector')
  - Audit Log         /fi-portal/connector/audit      (sectionKey: 'connector')
  - Templates & Guides /fi-portal/connector/templates (sectionKey: 'connector')
  ```

### 1c. Routes in App.tsx
- Add 9 new `<Route>` entries under the `/fi-portal` parent route
- Create 9 new page components in `src/pages/institution/connector/`

### 1d. Shared Hook: `useBankConnector`
- Resolves current user's `bank_id` from `banks` table via institution ownership
- Returns `{ bankId, bankName, loading, error }`
- Used by all connector pages to scope API calls

### 1e. Shared Components
- `src/components/institution/connector/ConnectorPageHeader.tsx` — solid primary banner (matches admin style)
- `src/components/institution/connector/StatusBadge.tsx` — reusable status badges
- `src/components/institution/connector/ConnectorEmptyState.tsx` — empty states with template download CTAs

---

## Phase 2 — Pages (9 pages, all fully functional)

Each page uses `ConnectorPageHeader`, skeleton loading, empty states, and calls `bank-file-connector` edge function.

### Page 1: Connector Overview (`/fi-portal/connector`)
- Integration mode card, data freshness cards (last import per type)
- Import health widget (7-day success/fail)
- Quick action buttons (upload, view errors, generate batch, upload status)
- Recent activity feed (from audit/ingestion_runs)

### Page 2: Uploads & Imports (`/fi-portal/connector/uploads`)
- Upload panel: file_type dropdown, environment selector, mapping profile selector, file picker
- Imports table with filters (file_type, status, date range), pagination
- Import detail dialog: metadata, row counts, error preview, download errors CSV, reprocess button

### Page 3: Mapping Profiles (`/fi-portal/connector/mappings`)
- Tabs by file_type (accounts/balances/transactions/beneficiaries)
- Mapping list with version, status, actions (view, clone, activate, deactivate)
- Mapping editor dialog: CSV header detection, canonical field mapping via dropdowns, transform builder, validation preview
- Save as new version, activate button

### Page 4: Templates & Guides (`/fi-portal/connector/templates`)
- Download CSV templates per file_type (calls `generate_sandbox_files` action)
- Required columns reference table
- Common errors and fixes guide
- Static content + download buttons

### Page 5: Batch Payments (`/fi-portal/connector/batches`)
- Batch list with filters (status, date range), pagination
- Create batch dialog: manual item entry or CSV upload for payout list
- Generate file button (CSV / pain.001 format selector)
- Download generated file
- Status progression display

### Page 6: Status Files (`/fi-portal/connector/status`)
- Upload status file panel (select batch or auto-match)
- Status imports table
- Mismatch resolution interface: unmatched references, manual match, mark external, request re-upload

### Page 7: Reconciliation (`/fi-portal/connector/reconciliation`)
- Period selector (daily/weekly/monthly)
- KPI cards: expected total, executed total, mismatches
- Mismatch queue table with filters
- Resolve mismatch dialog (requires reason)
- Export reconciliation report CSV

### Page 8: Connector Health (`/fi-portal/connector/health`)
- SFTP status indicator
- Last file received timestamp
- Processing queue status
- Alert cards for failures or missing imports

### Page 9: Audit Log (`/fi-portal/connector/audit`)
- Filterable table: time, actor, action_type, entity, entity_id, result, correlation_id
- Pulls from `ingestion_runs` + `bank_file_uploads` activity

---

## Phase 3 — Notifications

- Extend existing `notifyUser` / `notifyAdmins` calls in `bank-file-connector` to also notify the uploading bank user on:
  - Import success/failure/partial
  - Batch file generated
  - Status file processed
  - Reconciliation mismatch detected
- Notification icon: `'bank_transfer'` or new `'connector'` icon
- These appear in the existing `NotificationCenter` in the FI portal header

---

## Phase 4 — Documentation

New markdown files:
- `docs/bank-dashboard-upgrade/baseline/ui-route-map.md`
- `docs/bank-dashboard-upgrade/baseline/rbac-map.md`
- `docs/public/banks/connector-kit-file-based.md`
- `docs/public/banks/csv-templates.md`
- `docs/public/banks/status-files-reconciliation.md`
- `docs/bank-dashboard-upgrade/final/report.md`

---

## File Summary

| Category | Files | Count |
|---|---|---|
| DB Migration | RLS policies for bank-scoped access | 1 |
| Navigation | `navigation-config.ts` (modified) | 1 |
| Routes | `App.tsx` (modified, 9 new routes) | 1 |
| Shared hook | `useBankConnector.ts` (new) | 1 |
| Shared components | `ConnectorPageHeader`, `StatusBadge`, `ConnectorEmptyState` | 3 |
| Page components | 9 new pages in `src/pages/institution/connector/` | 9 |
| Edge function | `bank-file-connector` (minor: add bank-scoped auth) | 1 |
| Docs | 6 markdown files | 6 |
| **Total** | | **~23 files** |

Zero existing pages modified (except `navigation-config.ts` and `App.tsx` with additive changes). Non-breaking.


# Bank Connector Kit — E2E Audit Report

## Date: 2026-03-20
## Auditor: @lovable AI Agent
## Scope: All 9 FI Portal connector pages, shared components, edge function, RLS, notifications

---

## EXECUTIVE SUMMARY

**Overall Status: 🟡 PARTIALLY FUNCTIONAL — 14 Critical Gaps Found**

The Bank Connector Kit infrastructure (routes, navigation, DB tables, edge function, RLS policies) is in place. However, the **UI pages are largely "read-only shells"** that don't properly wire into the edge function backend. The most critical issue is that **the file upload flow is broken end-to-end** — files are registered in the DB but never stored to the storage bucket and ingestion is never triggered.

---

## PAGE-BY-PAGE AUDIT

### ✅ Page 1: Connector Overview (`/fi-portal/connector`)
**Status: FUNCTIONAL (display-only)**
| Feature | Status | Notes |
|---|---|---|
| Integration mode card | ✅ Works | Static display |
| Data freshness cards | ✅ Works | Queries `bank_file_uploads` |
| Import health (7-day) | ✅ Works | Client-side filter on uploads |
| Quick action buttons | ✅ Works | Navigate to correct routes |
| Recent activity feed | ✅ Works | Queries `ingestion_runs` |

**Gaps:**
- No activity entries will appear since uploads never trigger ingestion (see Page 2)

---

### 🔴 Page 2: Uploads & Imports (`/fi-portal/connector/uploads`)
**Status: CRITICALLY BROKEN**
| Feature | Status | Notes |
|---|---|---|
| File type selector | ✅ Works | Dropdown functional |
| Environment selector | ✅ Works | sandbox/prod toggle |
| File picker + upload | 🔴 **BROKEN** | Creates DB record but **never stores file bytes to `bank-files` storage bucket** |
| Mapping profile selector | 🔴 **MISSING** | Not implemented — plan called for it |
| Imports table | ✅ Works | Shows records from `bank_file_uploads` |
| Import detail dialog | 🟡 Partial | Shows metadata + error rows, but no **download errors CSV** button |
| Reprocess button | 🔴 **MISSING** | Not implemented |
| Ingestion trigger | 🔴 **MISSING** | Upload creates a "received" record but **never calls `run_ingestion`** on the edge function |
| Pagination | 🔴 **MISSING** | Hard limit of 100, no page controls |
| Date range filter | 🔴 **MISSING** | Only file_type filter exists |

**Critical Issue:** The upload handler (`handleUpload`) does:
1. ✅ Computes SHA-256 hash client-side
2. ✅ Inserts a record into `bank_file_uploads` with status "received"
3. ❌ **Never uploads file bytes to `bank-files` storage bucket**
4. ❌ **Never calls `bank-file-connector` edge function with `upload_file` or `run_ingestion`**

This means: No file content is stored → No ingestion can run → No data is imported → The entire import pipeline is non-functional from the UI.

---

### 🟡 Page 3: Mapping Profiles (`/fi-portal/connector/mappings`)
**Status: BASIC FUNCTIONALITY ONLY**
| Feature | Status | Notes |
|---|---|---|
| File type tabs | ✅ Works | Accounts/Balances/Transactions/Beneficiaries |
| Mapping list with versions | ✅ Works | Shows version, status, created date |
| Activate/deactivate toggle | ✅ Works | Properly deactivates others first |
| Clone (copy JSON to editor) | ✅ Works | Opens editor with existing mapping JSON |
| Canonical fields reference | ✅ Works | Shows target fields per type |
| **Mapping editor** | 🟡 **Raw JSON only** | No drag-drop, no dropdown mapping, no CSV header detection |
| **Transform builder** | 🔴 **MISSING** | No UI for trim/uppercase/parseDate/etc. |
| **Validation preview** | 🔴 **MISSING** | No "preview first 10 rows" functionality |
| **CSV header auto-detection** | 🔴 **MISSING** | No sample file upload to detect headers |
| **Delete mapping** | 🔴 **MISSING** | No delete action (plan allowed if unused) |

**Impact:** Bank users must manually write JSON mapping objects — not practical for non-technical bank ops staff.

---

### ✅ Page 4: Templates & Guides (`/fi-portal/connector/templates`)
**Status: FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| CSV template downloads | ✅ Works | Client-generated templates with sample data |
| Required columns reference | ✅ Works | Shows columns per file type |
| Common errors & fixes | ✅ Works | 5 common errors documented |
| How it works guide | ✅ Works | Step-by-step instructions |

**Minor Gap:**
- Templates are generated client-side, not via edge function's `generate_sandbox_files` action (which generates more realistic data). This is acceptable but could be improved.

---

### 🟡 Page 5: Batch Payments (`/fi-portal/connector/batches`)
**Status: PARTIALLY FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| Batch list table | ✅ Works | Shows batches with totals |
| Create batch (manual items) | ✅ Works | Inserts batch + items to DB |
| Batch type selector | ✅ Works | 3 types: transfers/salary/payouts |
| Add/remove payment items | ✅ Works | Dynamic form rows |
| **Download CSV** | 🟡 **Client-side only** | Fetches items and generates CSV in-browser, does NOT use edge function's `generate_batch_file` action |
| **pain.001 XML generation** | 🔴 **MISSING** | No format selector in UI; edge function supports it |
| **Upload payout CSV** | 🔴 **MISSING** | Only manual entry available; plan called for CSV upload |
| **Status progression display** | 🔴 **MISSING** | No visual timeline of batch status changes |
| **Batch detail view** | 🔴 **MISSING** | No way to view individual batch items |
| Store file to storage | 🔴 **MISSING** | Client CSV generation doesn't store to `bank-files` bucket |
| Pagination | 🔴 **MISSING** | Hard limit 100 |
| Filters (status, date) | 🔴 **MISSING** | No filter controls |

**Impact:** Generated CSV files are ephemeral (browser download only), not stored for audit trail. pain.001 generation is implemented in backend but inaccessible from UI.

---

### 🟡 Page 6: Status Files (`/fi-portal/connector/status`)
**Status: PARTIALLY FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| Batch selector | ✅ Works | Dropdown of batches |
| Status file upload | 🟡 **Bypasses edge function** | Parses CSV client-side and updates `bank_batch_items` directly |
| Batch items table | ✅ Works | Shows item statuses |
| **Status events (bank_status_events)** | 🔴 **MISSING** | Client-side update doesn't create `bank_status_events` records |
| **Batch aggregate status update** | 🔴 **MISSING** | Batch job status not updated after processing |
| **Mismatch resolution UI** | 🔴 **MISSING** | No unmatched references list, no manual match, no "mark external" |
| **File storage** | 🔴 **MISSING** | Status file not stored to bucket for audit |
| Schema validation preview | 🔴 **MISSING** | No preview before processing |

**Impact:** Status processing works superficially (item statuses update) but bypasses the proper pipeline — no audit trail via `bank_status_events`, no proper reconciliation data created.

---

### 🟡 Page 7: Reconciliation (`/fi-portal/connector/reconciliation`)
**Status: PARTIALLY FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| KPI cards (expected/executed/failed) | ✅ Works | Calculated from batch data |
| Batch reconciliation table | ✅ Works | Shows per-batch breakdowns |
| Export CSV | ✅ Works | Client-generated CSV download |
| **Period selector** | 🔴 **MISSING** | No daily/weekly/monthly filter |
| **Mismatch queue table** | 🔴 **MISSING** | No separate mismatch list with filters |
| **Resolve mismatch dialog** | 🔴 **MISSING** | No resolution workflow |
| **Mismatch export** | 🔴 **MISSING** | No separate mismatch CSV download |
| Pagination | 🔴 **MISSING** | Hard limit 50 |

**Impact:** Reconciliation provides a summary view but lacks the operational tools (resolve, investigate, period filtering) needed for actual bank ops work.

---

### ✅ Page 8: Connector Health (`/fi-portal/connector/health`)
**Status: FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| Overall status indicator | ✅ Works | Based on recent failures + recency |
| Last file received | ✅ Works | Queries latest upload |
| Integration mode display | ✅ Works | Static "File (Portal Upload)" |
| Active alerts | ✅ Works | Dynamic alerts for failures/staleness |
| Connector instances table | ✅ Works | Queries `bank_connector_instances` |

**Minor Gaps:**
- No `bank_connector_health` table query (latency metrics)
- Processing queue status not shown (pending ingestion runs)

---

### 🟡 Page 9: Audit Log (`/fi-portal/connector/audit`)
**Status: PARTIALLY FUNCTIONAL**
| Feature | Status | Notes |
|---|---|---|
| Upload events | ✅ Works | From `bank_file_uploads` |
| Ingestion run events | ✅ Works | From `ingestion_runs` |
| Unified sorted timeline | ✅ Works | Merged and sorted by time |
| **Batch operations** | 🔴 **MISSING** | Batch create/generate/status events not in audit |
| **Mapping changes** | 🔴 **MISSING** | Mapping create/activate/deactivate not in audit |
| **Status file processing** | 🔴 **MISSING** | Status ingestion events not tracked |
| **Filters** | 🔴 **MISSING** | No action_type, date range, or search filters |
| **Pagination** | 🔴 **MISSING** | Hard limit 50 |

**Impact:** Audit trail is incomplete — only covers file uploads and ingestion runs, missing batch, mapping, and status processing actions.

---

## SHARED COMPONENTS AUDIT

| Component | Status | Notes |
|---|---|---|
| `ConnectorPageHeader` | ✅ Works | Consistent primary banner with icon, title, description, actions |
| `StatusBadge` | ✅ Works | 20+ status mappings with proper dark mode support |
| `ConnectorEmptyState` | ✅ Works | Action button + template download CTA |
| `useBankConnector` | ✅ Works | Resolves bank_id via institution owner or staff assignment |

---

## INFRASTRUCTURE AUDIT

### Navigation Config
| Item | Status |
|---|---|
| "Bank Connector Kit" section in sidebar | ✅ Present |
| 9 menu items with sectionKey: 'connector' | ✅ Present |
| `connector` in `ALL_PORTAL_SECTIONS` | ✅ Present |
| RBAC via `useStaffPermissions` | ✅ Working (section-level gating) |

### Routes (App.tsx)
| Route | Component | Status |
|---|---|---|
| `/fi-portal/connector` | ConnectorOverview | ✅ Registered |
| `/fi-portal/connector/uploads` | ConnectorUploads | ✅ Registered |
| `/fi-portal/connector/mappings` | ConnectorMappings | ✅ Registered |
| `/fi-portal/connector/batches` | ConnectorBatches | ✅ Registered |
| `/fi-portal/connector/status` | ConnectorStatus | ✅ Registered |
| `/fi-portal/connector/reconciliation` | ConnectorReconciliation | ✅ Registered |
| `/fi-portal/connector/health` | ConnectorHealth | ✅ Registered |
| `/fi-portal/connector/audit` | ConnectorAudit | ✅ Registered |
| `/fi-portal/connector/templates` | ConnectorTemplates | ✅ Registered |

### Edge Function (`bank-file-connector`)
| Action | Used by UI? | Notes |
|---|---|---|
| `upload_file` | 🔴 **NO** | UI inserts directly to DB instead |
| `list_files` | 🔴 **NO** | UI queries directly |
| `get_file` | 🔴 **NO** | UI queries directly |
| `download_file` | 🔴 **NO** | Not used |
| `create_mapping` | 🔴 **NO** | UI inserts directly |
| `list_mappings` | 🔴 **NO** | UI queries directly |
| `preview_mapping` | 🔴 **NO** | Not implemented in UI |
| `run_ingestion` | 🔴 **NO** | Never called |
| `get_ingestion_run` | 🔴 **NO** | Not used |
| `download_errors` | 🔴 **NO** | Not implemented in UI |
| `create_batch` | 🔴 **NO** | UI inserts directly |
| `generate_batch_file` | 🔴 **NO** | UI generates CSV client-side |
| `list_batches` | 🔴 **NO** | UI queries directly |
| `get_batch` | 🔴 **NO** | Not used |
| `download_batch_file` | 🔴 **NO** | Not used |
| `ingest_status_file` | 🔴 **NO** | UI processes client-side |
| `get_reconciliation_summary` | 🔴 **NO** | UI calculates client-side |
| `generate_sandbox_files` | 🔴 **NO** | UI generates client-side templates |

**Critical Finding: ZERO edge function actions are used by the FI portal UI.** All pages query Supabase tables directly or do client-side processing. This bypasses:
- File storage to the `bank-files` bucket
- Server-side validation and ingestion
- Duplicate detection (SHA-256 dedup)
- Audit trail creation via `bank_status_events`
- Proper batch file generation and storage

### Notifications
| Event | Notification Created? |
|---|---|
| Import success | 🔴 **NO** |
| Import failure | 🔴 **NO** |
| Batch file generated | 🔴 **NO** |
| Status file processed | 🔴 **NO** |
| Reconciliation mismatch | 🔴 **NO** |

**No notifications are wired for any connector actions.**

### Database / RLS
- RLS policies for bank-scoped access: ✅ Migration created (15 policies across 7 tables)
- `banks.institution_id` column: ✅ Added
- Direct Supabase queries from UI will work with RLS (since user's JWT is used)

---

## PRIORITIZED FIX LIST

### P0 — Critical (Blocks Core Functionality)
1. **Fix Upload Flow**: Wire uploads through edge function (`upload_file` → `run_ingestion`) so files are stored to bucket and ingestion runs
2. **Wire Batch Generation**: Use `generate_batch_file` edge action instead of client-side CSV generation; add pain.001 format option
3. **Wire Status File Processing**: Use `ingest_status_file` edge action instead of direct DB updates

### P1 — High (Missing Planned Features)
4. **Add mapping profile selector** to upload panel
5. **Add download errors CSV** button in upload detail dialog
6. **Add reprocess button** in upload detail dialog (calls `run_ingestion`)
7. **Add mismatch resolution UI** to Status Files page
8. **Add period selector** to Reconciliation page
9. **Add resolve mismatch dialog** to Reconciliation page
10. **Add batch detail view** (show individual items)

### P2 — Medium (UX Improvements)
11. **Add visual mapping editor** (dropdown-based field mapping instead of raw JSON)
12. **Add CSV header auto-detection** in mapping editor
13. **Add transform builder UI** in mapping editor
14. **Add validation preview** in mapping editor
15. **Add pagination** to all tables (uploads, batches, status items, audit, reconciliation)
16. **Add date range filters** to uploads, batches, audit pages
17. **Complete audit trail** — log batch, mapping, status events
18. **Add payout CSV upload** option in batch creation
19. **Add batch status progression display**

### P3 — Low (Enhancement)
20. **Wire notifications** for all connector events
21. **Add connector health metrics** from `bank_connector_health` table
22. **Add processing queue status** to health page
23. **Templates from edge function** (`generate_sandbox_files`) for more realistic sample data

---

## SUMMARY METRICS

| Metric | Value |
|---|---|
| Pages audited | 9 |
| Pages fully functional | 2 (Overview, Templates) |
| Pages partially functional | 5 (Mappings, Batches, Status, Reconciliation, Audit) |
| Pages critically broken | 1 (Uploads) |
| Pages functional with minor gaps | 1 (Health) |
| Edge function actions available | 18 |
| Edge function actions used by UI | **0** |
| Notifications wired | **0** |
| Pagination implemented | **0 pages** |
| Total critical gaps | 3 |
| Total high-priority gaps | 7 |
| Total medium-priority gaps | 9 |
| Total low-priority gaps | 4 |
| **Total gaps found** | **23** |

---

## RECOMMENDATION

**Immediate priority should be fixing the 3 P0 items** (upload flow, batch generation, status processing) to establish end-to-end functionality. All three fixes involve wiring existing edge function actions instead of direct DB queries — the backend logic already exists and works.

The P1 items (download errors, reprocess, mismatch resolution, period selector) should follow to make the pages operationally useful for bank staff.

P2 items (visual mapping editor, pagination, filters) are UX improvements that can be phased in.

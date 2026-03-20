

# KOB File-Based Bank Connector — Implementation Plan

## Current State

**Already exists:**
- `banks` table with lifecycle (draft→submitted→active→suspended) + `bank-directory` edge function with 20+ actions
- `bank_sourced_accounts/balances/transactions/beneficiaries` tables with upsert-based ingestion
- `bank_psu_links` table + PSU linking flow
- `bank_payments` + `bank_payment_status_events` tables
- `AdminBankDirectory.tsx` (5-tab admin UI)
- `ReconciliationDashboard.tsx` (legacy bank_reconciliations)
- `bank-import-transactions` edge function (CSV/MT940/CAMT053 parser)
- `bank-sync` edge function (SFTP-style sync, simulated)
- `bank_connections`, `bank_transaction_imports`, `bank_statements` tables (legacy)
- AISP endpoints (`aisp-accounts`, etc.) — currently query user's `accounts` table only, NOT connector-backed
- `iso-messaging` edge function for pain.001/pacs.008 generation

**Gaps this plan fills:**
- No file upload registry with SHA256 dedupe and row-level traceability
- No CSV schema mapping profiles (bank-specific field mapping)
- No batch payment instruction file generator (CSV + pain.001)
- No status file ingestion pipeline with reconciliation
- AISP endpoints not backed by bank-sourced data
- No file upload UI in AdminBankDirectory
- No sandbox file generation

---

## Phase 1 — File Registry + Upload Infrastructure

### Database Migration (additive, ~7 new tables)

```text
bank_file_uploads
  ├── id, bank_id (FK), environment (sandbox|prod)
  ├── file_type (accounts|balances|transactions|beneficiaries|payment_instructions|payment_status)
  ├── original_filename, storage_path, file_hash_sha256, file_size
  ├── uploaded_by (sftp|portal|admin), uploader_user_id
  ├── status (received|validating|processed|failed)
  ├── received_at, processed_at
  ├── correlation_id, error_id, error_summary
  ├── RLS: admin + service_role

bank_file_rows
  ├── id, file_id (FK), row_number
  ├── raw_json, normalized_json
  ├── status (ok|invalid|duplicate|skipped)
  ├── error_id, error_details
  ├── RLS: service_role only

bank_data_mappings
  ├── id, bank_id (FK), file_type, version
  ├── mapping_json (JSONB — field mapping rules)
  ├── is_active, created_at
  ├── RLS: admin CRUD

ingestion_runs
  ├── id, file_id (FK), bank_id (FK)
  ├── started_at, finished_at
  ├── totals_json (rows_total, rows_ok, rows_invalid, rows_duplicate)
  ├── status, correlation_id
  ├── RLS: admin read, service_role all

bank_batch_jobs
  ├── id, bank_id (FK), environment
  ├── batch_type (outgoing_transfers|salary|merchant_payouts)
  ├── status (draft|generated|delivered|executed|partially_failed|failed|reconciled)
  ├── created_by, file_id (FK nullable)
  ├── totals_json, correlation_id
  ├── RLS: admin + service_role

bank_batch_items
  ├── id, batch_id (FK)
  ├── beneficiary_name, beneficiary_account_number, beneficiary_bank_code
  ├── amount, currency (default XAF), narration, reference
  ├── internal_payment_id (nullable FK)
  ├── status (pending|submitted|executed|failed)
  ├── bank_response_code, bank_response_message
  ├── RLS: admin + service_role

bank_status_events
  ├── id, batch_item_id (FK)
  ├── status, bank_tx_id, raw_row_json
  ├── created_at
  ├── RLS: service_role
```

Also add `source_file_id` and `source_row_number` columns to existing `bank_sourced_accounts`, `bank_sourced_transactions`, `bank_sourced_balances`, `bank_sourced_beneficiaries` tables (additive ALTER).

### Storage Bucket
Create `bank-files` storage bucket for uploaded CSVs and generated instruction files.

---

## Phase 2 — File Ingestion Edge Function

### New edge function: `bank-file-connector`
Consolidated router with actions:

**Upload & Registry:**
- `upload_file` — registers file in `bank_file_uploads`, stores in `bank-files` bucket, computes SHA256, rejects duplicates
- `list_files` — admin list with filters (bank_id, file_type, status)
- `get_file` — file detail + row-level results
- `download_file` — signed URL for stored file

**Mapping Management:**
- `create_mapping` — save mapping profile for bank+file_type
- `list_mappings` — list active mappings per bank
- `preview_mapping` — apply mapping to first 5 rows of a file, return preview (no DB write)

**Ingestion Pipeline:**
- `run_ingestion` — for a given file_id:
  1. Load mapping profile for (bank_id, file_type)
  2. Parse CSV rows
  3. Apply mapping transforms (trim, parseDecimal, parseDate, parsePhone)
  4. Validate (required fields, XAF default, amount >= 0, date sanity)
  5. Dedupe check against existing bank_sourced_* tables
  6. Upsert valid rows, record invalid/duplicate rows in `bank_file_rows`
  7. Write `ingestion_runs` summary
  8. Update `bank_file_uploads` status
- `get_ingestion_run` — retrieve run results
- `download_errors` — generate CSV of error rows for a file

**Batch Payment Generator:**
- `create_batch` — create batch job + items
- `generate_batch_file` — generate CSV or pain.001 XML instruction file, store in bucket
- `list_batches` — admin list with filters
- `get_batch` — batch detail + items
- `download_batch_file` — signed URL

**Status File Ingestion:**
- `ingest_status_file` — parse bank's status CSV, match to batch_items by reference, update statuses, record events
- `get_reconciliation_summary` — compare expected vs actual for a batch

**Sandbox:**
- `generate_sandbox_files` — produce sample CSV files (accounts, transactions, statuses) for sandbox bank

---

## Phase 3 — AISP Connector-Backed Resolution

### Extend `aisp-accounts` edge function
After the existing user-scoped query, add a second resolution path:
- Check `bank_psu_links` for user's linked banks (status = 'active')
- If linked banks exist, also query `bank_sourced_accounts` for those bank_customer_ids
- Merge results into response with `data_freshness: 'daily_import'` metadata

### Extend `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries` similarly
- `aisp-balances`: also query `bank_sourced_balances`
- `aisp-transactions`: also query `bank_sourced_transactions` with date filters
- `aisp-beneficiaries`: also query `bank_sourced_beneficiaries`

Non-breaking: existing user-scoped data continues to work. Bank-sourced data is additive.

---

## Phase 4 — Admin UI Enhancements

### Extend `AdminBankDirectory.tsx`
Add new tab: **File Imports**
- File upload widget (select bank, file_type, environment, mapping profile → upload CSV)
- File list table with status badges, row counts, error counts
- Click-through to ingestion run detail (valid/invalid/duplicate breakdown)
- Download error rows as CSV
- "Re-run ingestion" button (safe, deduped)

Add new tab: **Batch Payments**
- Create batch form (bank, type, add items)
- Generate file button (CSV / pain.001)
- Download generated file
- Upload status file
- Reconciliation summary (expected vs actual, mismatches highlighted)

### Extend `ReconciliationDashboard.tsx`
Add section for file-based reconciliation:
- List of batch jobs with status
- Mismatch details per batch
- "Mark resolved" action

---

## Phase 5 — Documentation & Changelog

**New docs:**
- `docs/file-connector/baseline/system-inventory.md`
- `docs/file-connector/baseline/current-gaps.md`
- `docs/file-connector/baseline/e2e-baseline-results.md`
- `docs/file-connector/final/report.md`
- `docs/public/banks/file-format.md` — CSV templates + field specs
- `docs/public/banks/mapping-profiles.md` — mapping configuration guide
- `docs/public/payments/batch-payments.md` — batch payment guide
- `docs/public/admin/file-reconciliation.md`

**Update existing:**
- OpenAPI spec (`public-api-spec`) — add file upload, batch payment, status ingestion endpoints
- Postman collection — add File Connector folder
- Changelog (`Changelog.tsx` + `changelog.json`) — v9.0.0: File-Based Bank Connector

---

## File Summary

| Category | Files | Count |
|---|---|---|
| DB Migration | 1 migration (7 new tables + ALTER adds to 4 existing) | 1 |
| Edge Functions | `bank-file-connector` (new) | 1 |
| Edge Functions (modified) | `aisp-accounts`, `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries` | 4 |
| Storage | `bank-files` bucket creation (in migration) | — |
| Admin UI (modified) | `AdminBankDirectory.tsx`, `ReconciliationDashboard.tsx` | 2 |
| Docs (new) | 8 markdown files | 8 |
| Docs (updated) | OpenAPI spec, Postman, Changelog | 3 |

**Total: ~19 files. Zero existing tables removed. AISP endpoints extended additively. No breaking changes.**


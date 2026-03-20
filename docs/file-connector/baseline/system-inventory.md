# KOB File-Based Bank Connector — System Inventory

## Date: 2026-03-20

## New Tables (Phase 1)
| Table | Purpose |
|---|---|
| `bank_file_uploads` | File registry with SHA256 dedupe, status tracking, correlation_id |
| `bank_file_rows` | Row-level traceability per ingested file |
| `bank_data_mappings` | Per-bank CSV field mapping profiles (versioned) |
| `ingestion_runs` | Summary of each ingestion job with totals |
| `bank_batch_jobs` | Batch payment instruction generation jobs |
| `bank_batch_items` | Individual payment instructions in a batch |
| `bank_status_events` | Status file ingestion events per batch item |

## Altered Tables
- `bank_sourced_accounts` — added `source_file_id`, `source_row_number`
- `bank_sourced_transactions` — added `source_file_id`, `source_row_number`
- `bank_sourced_balances` — added `source_file_id`, `source_row_number`
- `bank_sourced_beneficiaries` — added `source_file_id`, `source_row_number`

## Storage
- `bank-files` bucket (private, 50MB limit, admin + service_role RLS)

## Edge Functions
| Function | Status |
|---|---|
| `bank-file-connector` | **NEW** — 18 actions (upload, mapping, ingestion, batch, status, sandbox) |
| `aisp-accounts` | **EXTENDED** — bank-sourced account resolution via `bank_psu_links` |
| `aisp-balances` | **EXTENDED** — bank-sourced balance resolution |
| `aisp-transactions` | **EXTENDED** — bank-sourced transaction resolution with date filters |
| `aisp-beneficiaries` | **EXTENDED** — bank-sourced beneficiary resolution |

## Admin UI
- `AdminBankDirectory.tsx` — 7 tabs (added File Imports + Batch Payments)
- `ReconciliationDashboard.tsx` — 2 tabs (added Batch Reconciliation)

## AISP Data Resolution
AISP endpoints now resolve data from TWO sources:
1. Core `accounts`/`transactions` tables (realtime, `DataFreshness: 'realtime'`)
2. `bank_sourced_*` tables via `bank_psu_links` (file-imported, `DataFreshness: 'daily_import'`)

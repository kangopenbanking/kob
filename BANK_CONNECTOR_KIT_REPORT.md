# KOB Bank Connector Kit Report — v4.3.0

**Date**: 2026-03-22

## File-Based Connector (bank-file-connector)

### Actions Implemented (18 total)

| Action | Purpose | Status |
|--------|---------|--------|
| `upload_file` | Upload CSV with SHA-256 dedupe | ✅ |
| `list_files` | List uploaded files per bank | ✅ |
| `get_file` | Get file metadata | ✅ |
| `download_file` | Download file from storage | ✅ |
| `create_mapping` | Create CSV→canonical field mapping | ✅ |
| `list_mappings` | List mapping profiles per bank | ✅ |
| `preview_mapping` | Preview mapped data before ingestion | ✅ |
| `run_ingestion` | Execute ingestion with validation + dedupe | ✅ |
| `get_ingestion_run` | Get ingestion job details | ✅ |
| `download_errors` | Download error rows from ingestion | ✅ |
| `create_batch` | Create batch payment job | ✅ |
| `generate_batch_file` | Generate CSV or pain.001 batch file | ✅ |
| `list_batches` | List batch jobs | ✅ |
| `get_batch` | Get batch with items | ✅ |
| `download_batch_file` | Download generated batch file | ✅ |
| `ingest_status_file` | Ingest bank status response files | ✅ |
| `get_reconciliation_summary` | Reconciliation mismatch summary | ✅ |
| `generate_sandbox_files` | Generate test CSV files | ✅ |

### File Processing Features

| Feature | Status |
|---------|--------|
| SHA-256 deduplication | ✅ Rejects duplicate uploads (409 Conflict) |
| CSV parsing + validation | ✅ Type-specific rules (accounts/tx/balances/beneficiaries) |
| Row-level traceability | ✅ `bank_file_rows` table |
| Quarantine invalid rows | ✅ Rows with errors tracked in ingestion_runs |
| Field mapping transforms | ✅ trim, uppercase, lowercase, parseDecimal, parsePhone, maskAccount |
| XAF default currency | ✅ Auto-applied if currency missing |
| Cameroon phone normalization | ✅ +237XXXXXXXXX format |
| ISO 20022 pain.001 generation | ✅ XML output for batch payments |

### AISP Resolution (File-Imported Data)

| Endpoint | File-Backed | Status |
|----------|------------|--------|
| `/aisp/accounts` | ✅ via `bank_sourced_accounts` + `bank_psu_links` | ✅ |
| `/aisp/balances` | ✅ via `bank_sourced_balances` | ✅ |
| `/aisp/transactions` | ✅ via `bank_sourced_transactions` (date filters) | ✅ |
| `/aisp/beneficiaries` | ✅ via `bank_sourced_beneficiaries` | ✅ |

### Institution Dashboard Pages

| Page | Route | Status |
|------|-------|--------|
| Connector Overview | `/institution/connector/overview` | ✅ |
| Uploads & Imports | `/institution/connector/uploads` | ✅ |
| Field Mappings | `/institution/connector/mappings` | ✅ |
| Batch Payments | `/institution/connector/batches` | ✅ |
| Status & Monitoring | `/institution/connector/status` | ✅ |
| Reconciliation | `/institution/connector/reconciliation` | ✅ |
| Health Checks | `/institution/connector/health` | ✅ |
| Templates & Guides | `/institution/connector/templates` | ✅ |
| Audit Trail | `/institution/connector/audit` | ✅ |
| Onboarding Wizard | `/institution/connector/onboard` | ✅ |
| How It Works Guide | `/institution/connector/guide` | ✅ |

### Connector Modes Supported

| Mode | Description | Status |
|------|-------------|--------|
| `file_feed` | CSV upload + processing | ✅ Full |
| `connector_push` | Bank pushes via ingestion API | ✅ Full |
| `connector_pull` | KOB polls bank REST APIs | ✅ `bank-api-connector` |
| `db_connector` | KOB polls bank DB replica | ✅ `bank-db-connector` |
| `mq_realtime` | Event-driven messaging | ✅ `bank-mq-connector` |

**Verdict: BANK CONNECTOR KIT COMPLETE ✅**

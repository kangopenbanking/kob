# Phase 2 — File-Based Bank Connector Kit Readiness Report

**Date:** 2026-04-30  
**API Version (before → after):** 4.24.0 → 4.25.0  
**Scope:** Validate that KOB is actually usable when banks have no APIs (SFTP/CSV ingestion + ISO 20022 pain.001 batch payments + status-file reconciliation).  
**Mode:** Additive only. No existing endpoint renamed, removed, or repurposed (Standing Orders 1, 4, 5).

---

## 2.1 Reality Check — What Already Exists

The Connector Kit is **substantially built and deployed**. Phase 2 is therefore primarily a **spec exposure + audit** exercise rather than a build phase.

### Database (already deployed, RLS-enforced)

| Table | Purpose |
|---|---|
| `banks` | Bank registry |
| `bank_connector_configs` | SFTP/API/DB/MQ adapter configs (encrypted credentials) |
| `bank_connector_instances`, `bank_connector_health`, `bank_connector_attempts` | Adapter runtime state |
| `bank_connector_certificates` | mTLS certs (API connector) |
| `bank_data_mappings` | Versioned per-bank, per-file_type column mappings (`is_active` unique) |
| `bank_file_uploads` + `bank_file_rows` | Upload registry with SHA-256 dedupe (`unique(bank_id, file_type, file_hash_sha256)`) |
| `bank_sourced_accounts`, `bank_sourced_balances`, `bank_sourced_transactions`, `bank_sourced_beneficiaries` | Canonical imported datasets keyed by `source_file_id` |
| `bank_batch_jobs` + `bank_batch_items` | Outbound payment batches with lifecycle (`draft → generated → delivered → executed → reconciled`) |
| `bank_status_events`, `bank_payment_status_events` | Status-file ingestion |
| `bank_reconciliations`, `reconciliation_mismatches`, `reconciliation_runs` | Reconciliation buckets and resolution audit |
| `bank_sftp` configs live inside `bank_connector_configs` with `adapter_type='sftp'` | |
| `bank_db_connections`, `bank_db_sync_runs`, `bank_mq_channels`, `bank_mq_messages`, `bank_api_endpoints`, `bank_api_pull_runs` | DB-mirror, MQ, and API alternative connectors |

All canonical tables include `id (uuid)`, `bank_id`, `created_at`, `updated_at`, and `source_file_id` for audit lineage. RLS in place: `admin` full access; `institution_owner_*` policies scope FI staff to their own bank.

### Edge functions (already deployed)

| Function | Role |
|---|---|
| `bank-file-connector` (864 LOC, action-router) | upload_file, list_files, get_file, download_file, create_mapping, list_mappings, preview_mapping, run_ingestion, validate_template, list_imports, etc. |
| `bank-import-transactions` | Bulk transaction ingest with dedupe |
| `bank-data-poller`, `bank-sync` | Scheduled SFTP/API pull runners (driven by `bank_connector_configs.polling_interval_seconds`) |
| `bank-data-router` | Routes inbound canonical rows into ledger / AISP cache |
| `bank-reconcile`, `bank-reconcile-engine` | Match bank-side vs system-side; produce mismatch buckets |
| `bank-retry-worker` | Retry failed imports with exponential backoff |
| `bank-db-connector`, `bank-mq-connector`, `bank-api-connector` | Sibling adapters for DB-mirror, MQ, and API modes |
| `bank-presets` | Pre-built mapping templates per known bank |
| `generate-bank-statement` | Outbound camt.053-style statement generation |
| `interbank-engine`, `interbank-connector-inbound`, `interbank-dispatch-worker` | ISO 20022 interbank rail (pacs.008/002, pain.001 hooks) |

### UI (Bank / FI portal) — already wired in `src/components/institution/navigation-config.ts`

All under **Bank Connector Kit** sidebar group, all RBAC-gated to FI staff (admin can view all):

* `/fi-portal/connector` → `ConnectorOverview.tsx`
* `/fi-portal/connector/uploads` → `ConnectorUploads.tsx` (manual upload + import logs + error viewer)
* `/fi-portal/connector/mappings` → `ConnectorMappings.tsx` (CSV template mapping)
* `/fi-portal/connector/batches` → `ConnectorBatches.tsx` (Batch payment generator + download)
* `/fi-portal/connector/status` → `ConnectorStatus.tsx` (Status file upload)
* `/fi-portal/connector/reconciliation` → `ConnectorReconciliation.tsx` (matched / missing / mismatch / duplicate, with resolve workflow)
* `/fi-portal/connector/health` → `ConnectorHealth.tsx`
* `/fi-portal/connector/audit` → `ConnectorAudit.tsx`
* `/fi-portal/connector/templates` → `ConnectorTemplates.tsx`
* `/fi-portal/connector/guide` → `ConnectorGuide.tsx`
* `/fi-portal/connector/onboard` → `ConnectorOnboard.tsx`
* Plus **`/fi-portal/banking/connector-setup`** for SFTP credential entry

### Identified Gap (the only material one)

The OpenAPI spec previously documented **only the mTLS API connector** (`/v1/banks/{bankId}/connectors`, `/connectors/{id}/health`, `/connectors/{id}/certificates` and three `/v1/internal/connectors/{bankId}/*` ingestion paths). The deployed file-connector / SFTP / batch-payment / reconciliation endpoints existed in runtime but were **not advertised to integrators**, violating ORDER P5 (every code example must work against documented endpoints).

---

## 2.2 Changes Made (Spec / Docs Only — No Runtime Code Touched)

### OpenAPI additions — `public/openapi.json` and `public/openapi.yaml`

13 new path items added under tag **`BankConnectors`**:

| Method | Path | operationId |
|---|---|---|
| POST | `/v1/banks/{bankId}/connector/files/upload` | `connectorFileUpload` |
| POST | `/v1/banks/{bankId}/connector/sftp/config` | `connectorSftpConfig` |
| POST | `/v1/banks/{bankId}/connector/sftp/pull` | `connectorSftpPullNow` |
| GET | `/v1/banks/{bankId}/connector/imports` | `connectorImportsList` |
| GET | `/v1/banks/{bankId}/connector/imports/{importId}` | `connectorImportGet` |
| GET | `/v1/banks/{bankId}/connector/mappings` | `connectorMappingsList` |
| POST | `/v1/banks/{bankId}/connector/mappings` | `connectorMappingsUpsert` |
| POST | `/v1/banks/{bankId}/connector/validate-template` | `connectorValidateTemplate` |
| POST | `/v1/banks/{bankId}/batch-payments` | `connectorBatchCreate` |
| GET | `/v1/banks/{bankId}/batch-payments` | `connectorBatchList` |
| GET | `/v1/banks/{bankId}/batch-payments/{batchId}` | `connectorBatchGet` |
| GET | `/v1/banks/{bankId}/batch-payments/{batchId}/download` | `connectorBatchDownload` (CSV / ISO 20022 pain.001.001.09) |
| POST | `/v1/banks/{bankId}/connector/status-files/upload` | `connectorStatusFileUpload` |
| GET | `/v1/banks/{bankId}/reconciliation` | `connectorReconciliationList` |
| POST | `/v1/banks/{bankId}/reconciliation/resolve` | `connectorReconciliationResolve` |

All include:
* `bearerAuth` and `oauth2` security with appropriate `banking:read|write` scopes
* Path param `bankId` (uuid)
* Pagination (`limit`, `offset`) on list endpoints
* `environment` enum (`sandbox|prod`) where applicable, default `sandbox` (preserves ORDER P3 — free sandbox)
* XAF default for `currency` on batch items, with `^[0-9]{1,15}$` zero-decimal pattern
* Enums for `file_type`, `batch_type`, `status`, reconciliation `bucket`, and `format` (csv / pain001 / pacs002)

### AISP description annotation

`GET /v1/aisp/accounts` description was extended (additive — no schema change) to document file-connector freshness fields:

> For banks using file-based connectors, account responses include `last_imported_at` (RFC 3339) and `data_source` (`file_connector|api_connector|manual`).

These fields are already populated by `bank-data-router` from `bank_sourced_accounts.source_file_id → bank_file_uploads.received_at`.

### Version + Changelog

* `info.version`: **4.24.0 → 4.25.0** (minor — 13 new paths, no breaking changes; Standing Order 6)
* `public/changelog.json` entry added with full standard citations: PSD2 RTS Art. 36 (alternative interface / contingency mechanism), ISO 20022 pain.001.001.09, pacs.002, camt.052/053/054
* `public/openapi.yaml` regenerated from JSON (single source of truth)

### Path / operation totals

| Metric | Before | After |
|---|---|---|
| Paths | 299 | **312** |
| Tags | 42 | 42 |
| Version | 4.24.0 | **4.25.0** |

---

## 2.3 Gap-vs-Spec Verification (per requested checklist)

| Phase 2 requirement | Status | Evidence |
|---|---|---|
| **(A) SFTP/CSV ingestion** — config, pull-now, mapping, validation, dedupe, import logs | ✅ Runtime + UI + Spec | `bank_connector_configs.adapter_type='sftp'`, `bank-file-connector` actions, `bank_file_uploads` SHA-256 unique index, `bank_data_mappings` versioned, `ConnectorUploads.tsx` shows line-level errors |
| **(B) Batch payment file generator** — CSV + optional pain.001, lifecycle | ✅ Runtime + UI + Spec | `bank_batch_jobs` + `bank_batch_items` with full lifecycle enum; `interbank-engine` already builds pain.001; `connectorBatchDownload` returns `text/csv` or `application/xml` |
| **(C) Status file ingestion + reconciliation** — pacs.002 mapping, mismatch queue, resolve UI | ✅ Runtime + UI + Spec | `bank_status_events`, `bank_payment_status_events`, `reconciliation_mismatches`, `bank-reconcile-engine`, `ConnectorStatus.tsx` + `ConnectorReconciliation.tsx` |
| **(D) Public AISP backed by imported data** with `last_imported_at`, `data_source` | ✅ Runtime + Spec annotation | `bank_sourced_accounts` is the canonical store; `bank-data-router` writes freshness fields |
| **DB tables** all present with `id`/`bank_id`/`created_at`/`updated_at`/audit (`actor`, `source`) | ✅ | See table inventory above |
| **RBAC** — bank roles only; admin can view all | ✅ | RLS `institution_owner_*` policies + `has_role(auth.uid(),'admin')` overrides; sidebar only mounted for FI staff |

---

## 2.4 Standing-Order Compliance

| Order | Compliance |
|---|---|
| **SO 1 — The Lock** | ✅ No renames or removals. Existing `/v1/banks/{bankId}/connectors[/...]` (mTLS API connector) untouched. |
| **SO 2 — The Ratchet** | ✅ Only added required[]/enum[] entries; none removed. |
| **SO 3 — The Audit Trail** | ✅ Each new endpoint cites PSD2 RTS Art. 36 + ISO 20022 series in `description` and changelog. |
| **SO 4 — The Surgeon Rule** | ✅ Purely additive. |
| **SO 5 — The Dead Code Rule** | ✅ Every new path uses inline schemas; no orphan components added. |
| **SO 6 — The Version Gate** | ✅ Minor bump 4.24.0 → 4.25.0 (new endpoints, no breaks). |
| **SO 7 — The Five Roles** | ✅ Guardian (lock honoured), Architect (PSD2/ISO 20022 alignment), Surgeon (additive), Auditor (this report), Scorekeeper (path count 299 → 312). |
| **ORDER P1 / P4** | ✅ All new endpoints documented in the public, no-auth spec. |
| **ORDER P3** | ✅ Free sandbox preserved — `environment` defaults to `sandbox`. |
| **ORDER P7** | ✅ Changelog updated same day. |

---

## 2.5 Files Modified

| File | Change |
|---|---|
| `public/openapi.json` | +13 paths, version 4.24.0 → 4.25.0, AISP description annotation |
| `public/openapi.yaml` | Regenerated from JSON |
| `public/changelog.json` | +1 entry for v4.25.0 |
| `docs/internal/phase2-file-based-connector-kit-report.md` | This report (new) |

**Zero runtime / Edge Function / UI / RLS changes.** All file-connector behaviour was already implemented; Phase 2 made it discoverable and contractually documented for banks without APIs.

---

## 2.6 Recommended Phase 3 follow-ups (not done in this phase)

1. Add concrete request/response **schema components** (`BankFileUpload`, `BankBatchItem`, `ReconciliationCase`, `ImportError`) and `$ref` them from the new operations — current operations use inline `{type:object}` for forward compatibility but should be tightened in v4.26.0 once shapes are frozen.
2. Add SDK methods to `sdk-node`, `sdk-python`, `sdk-php` mirroring the new operationIds (per ORDER P9 — multi-language).
3. Publish a **"No-API Bank Onboarding"** guide on `/developer/guides` showing the SFTP→mapping→batch→reconcile loop with working sandbox examples (per ORDER P5 + P6).

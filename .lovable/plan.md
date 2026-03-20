

# Bank Connector Integration Enhancement — Full Implementation Plan

## Summary

The backend edge functions (`bank-directory`, `bank-db-connector`, `bank-api-connector`, `bank-file-connector`) are well-implemented with full CRUD, sync engines, and sandbox simulation. However, the **Admin UI** (`AdminBankDirectory.tsx`) only exposes 6 of the 7 tabs needed — it's missing dedicated UI for **DB Connector** and **API Connector** management, and lacks a downloadable **Integration Guide** document. The Register Bank dialog also omits `db_connector` and `mq_realtime` integration modes.

## Gaps Found

| Gap | Severity | Location |
|---|---|---|
| Register Bank dialog missing `db_connector` and `mq_realtime` modes | MEDIUM | `AdminBankDirectory.tsx` line 165 |
| No DB Connector management tab in admin UI | HIGH | Missing — backend (`bank-db-connector`) exists but no UI |
| No API Connector (connector_pull) management tab in admin UI | HIGH | Missing — backend (`bank-api-connector`) exists but no UI |
| No downloadable integration guide for bank partners | MEDIUM | No document generation exists |
| Connectors tab is read-only — no "Register Connector" button | MEDIUM | `ConnectorsTab` component |
| No integration type selection wizard when onboarding a bank | LOW | Bank registration is a flat form |

## Implementation

### 1. Add DB Connector Tab to Admin Bank Directory
New `DBConnectorTab` component within `AdminBankDirectory.tsx`:
- List all DB connections from `bank-db-connector` → `list_connections`
- Register new connection form: bank selector, name, db_type (PostgreSQL/MySQL/MSSQL/Oracle/MongoDB), host/port/database/username/SSL, poll interval, watermark column, poll queries
- Test connection button → `test_connection`
- Trigger manual sync → `trigger_sync`
- View sync run history → `list_sync_runs`
- Seed sandbox DB connector button → `sandbox_seed_db_connector`
- Status badges + latency display

### 2. Add API Connector Tab (connector_pull)
New `APIConnectorTab` component:
- List API endpoints from `bank-api-connector` → `list_endpoints`
- Register new endpoint form: bank, name, base URL, auth method (api_key/oauth2/basic/bearer/mtls), auth config fields, API paths (accounts/transactions/balances/health), poll interval
- Test endpoint → `test_endpoint`
- Trigger manual pull → `trigger_pull`
- View pull run history → `list_pull_runs`

### 3. Update Register Bank Dialog
- Add `db_connector` and `mq_realtime` to the integration mode dropdown
- Add description text for each mode when selected

### 4. Add Register Connector to Connectors Tab
- Add a "Register Connector" button with dialog calling `bank-directory` → `register_connector`
- Add "Upload Certificate" button calling `upload_certificate`

### 5. Generate Downloadable Integration Guide (DOCX)
Create a comprehensive bank integration guide document generated via script, saved to `/mnt/documents/`:
- **Section 1**: Overview of KOB Bank Connector Framework
- **Section 2**: connector_push — mTLS setup, certificate requirements, ingestion endpoints (accounts/transactions/balances/beneficiaries), HMAC signing, correlation IDs
- **Section 3**: db_connector — DB proxy setup, watermark-based sync, poll queries, supported DBs
- **Section 4**: connector_pull — REST API requirements, auth methods, path configuration
- **Section 5**: file_feed — CSV templates, upload portal, ingestion pipeline, status reconciliation
- **Section 6**: mq_realtime — Webhook/SSE/Kafka setup
- **Section 7**: hybrid mode
- **Section 8**: Sandbox testing guide
- **Section 9**: Security (mTLS certificates, HMAC, scoped tokens)

### 6. Add "Download Integration Guide" Button to Admin Bank Directory
- Add a Download button in the header area that links to the generated guide
- Also add it to the FI Portal connector pages

## Files to Modify/Create

| File | Action |
|---|---|
| `src/pages/admin/AdminBankDirectory.tsx` | Add DBConnectorTab, APIConnectorTab, update Register Bank modes, add Register Connector, add Download Guide button |
| DOCX generation script (via lov-exec) | Generate `KOB_Bank_Integration_Guide.docx` |
| Edge functions | No changes needed — all backends already exist |

## Tab Structure After Changes

```text
Banks | Connectors | DB Connectors | API Connectors | PSU Links | Payments | File Imports | Batch Payments
```

Total: 8 tabs (up from 6), plus downloadable DOCX guide.


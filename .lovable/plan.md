

# KOB Bank Connector Layer — Full Implementation Plan

## Current State Assessment

**Already exists (will be leveraged, not modified):**
- `interbank_participants` + `interbank_endpoints` tables (from Phase 2/3 migration) — participant/connector registration with mTLS
- `interbank-engine` edge function with connector management actions (register_connector, upload_connector_cert, connector_health, rotate_connector_keys)
- `interbank-connector-inbound` edge function with mTLS enforcement for pacs.002/camt.054 ingestion
- `bank_connections` + `bank_reconciliations` tables (legacy Phase 14 schema for SFTP/H2H/REST connections)
- `bank-sync`, `bank-import-transactions`, `bank-reconcile` edge functions (legacy bank sync)
- `directory-banks-cm` edge function (static Cameroon bank directory with 15 banks)
- `client_certificates` table + mTLS utilities in `_shared/mtls.ts`
- `AdminInterbankPayments.tsx` page with 6 tabs (Payments, Participants, Messages, Connectors, Outbox, Reconciliation)
- Existing AISP endpoints (`aisp-accounts`, `aisp-balances`, `aisp-transactions`, etc.) — currently user-scoped, not connector-backed

**Gaps this plan fills:**
- No first-class `banks` table with lifecycle (draft→submitted→active→suspended)
- No bank-sourced data tables (`bank_customers`, `bank_accounts`, `bank_balances`, `bank_transactions`, `bank_beneficiaries`)
- No bulk ingestion endpoints for PUSH model
- No PSU↔bank linking/mapping
- AISP returns only user's own accounts, not connector-backed bank data
- No PISP routing to bank connector rail
- No Bank Directory admin UI or sandbox bank simulator
- No developer-facing bank onboarding docs

---

## Implementation Plan

### Phase 0 — Baseline Audit + Documentation

**3 markdown files created:**
- `docs/bank-connectors/baseline/system-inventory.md` — inventory of existing bank-related tables, edge functions, AISP/PISP endpoints, admin UI
- `docs/bank-connectors/baseline/current-gaps.md` — gap analysis against all 8 phases
- `docs/bank-connectors/baseline/e2e-results.md` — smoke test documentation of existing bank directory, AISP, and interbank engine endpoints

---

### Phase 1 — Bank Directory + Onboarding

**Database migration** — 5 new tables:

```text
banks
  ├── id, legal_name, display_name, short_code (unique)
  ├── country (default 'CM'), swift_bic, bank_code
  ├── status (draft|submitted|active|suspended)
  ├── integration_mode (connector_push|connector_pull|file_feed|hybrid)
  ├── contact_email, support_phone
  ├── RLS: admin full CRUD, authenticated read active

bank_branches
  ├── id, bank_id (FK), name, city, address
  ├── postiq_code, is_active

bank_connector_instances
  ├── id, bank_id (FK), name, environment (sandbox|prod)
  ├── base_url, connector_type (rest|iso20022|file)
  ├── status (pending|active|disabled), last_seen_at

bank_connector_certificates
  ├── id, bank_id, instance_id (FK)
  ├── certificate_pem, thumbprint, valid_from, valid_until, revoked_at

bank_connector_health
  ├── instance_id (FK), status, latency_ms
  ├── last_check_at, details_json
```

**New edge function: `bank-directory`** (consolidated router)
- Actions: `register_bank`, `list_banks`, `get_bank`, `update_bank`, `submit_bank`, `approve_bank`, `suspend_bank`, `list_directory` (public active banks), `register_connector`, `upload_certificate`, `rotate_secret`, `list_connectors`, `connector_health`
- Links to existing `directory-banks-cm` data for seeding Cameroon banks
- Admin-only for management; public read for directory listing

---

### Phase 2 — Bank Connector Contract + Data Ingestion

**Database migration** — 5 bank-sourced data tables:

```text
bank_customers (PSU mapping)
  ├── id, bank_id (FK), external_customer_id
  ├── user_id (nullable FK to auth — linked later)
  ├── name, email, phone, status

bank_accounts
  ├── id, bank_id (FK), customer_id (FK)
  ├── external_account_id (unique per bank), account_type
  ├── identification_scheme, identification_value
  ├── currency (default XAF), status, nickname

bank_balances
  ├── id, account_id (FK), balance_type
  ├── amount, currency, as_of_datetime

bank_transactions
  ├── id, account_id (FK), external_tx_id (unique per bank)
  ├── booking_date, value_date, amount, currency
  ├── credit_debit, reference, description

bank_beneficiaries
  ├── id, account_id (FK), beneficiary_name
  ├── scheme_name, identification, bank_id_code
```

**Extend `bank-directory` edge function** with ingestion actions:
- `ingest_accounts`, `ingest_balances`, `ingest_transactions`, `ingest_beneficiaries`
- Schema validation, deduplication by `(bank_id, external_*_id)`, correlation_id logging
- mTLS or service_role auth required

---

### Phase 3 — Connector-Backed AISP

**Extend existing AISP edge functions** (`aisp-accounts`, `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries`):
- Add resolution logic: when consent has a linked bank_id, query `bank_accounts`/`bank_transactions` tables instead of user's `accounts` table
- If bank not connected → return `{ error: 'bank_not_connected' }` with guidance

**PSU linking flow** — new actions in `bank-directory`:
- `link_psu_start` — initiates bank↔user linking (stores pending link)
- `link_psu_confirm` — confirms via OTP/PIN, creates `bank_customers.user_id` mapping

**New table:**
```text
bank_psu_links
  ├── id, user_id, bank_id, bank_customer_id (FK)
  ├── status (pending|active|revoked), linked_at
```

---

### Phase 4 — PISP Bank Connector Rail

**Extend `pisp-domestic-payment`** edge function:
- Add routing: if debtor/creditor bank is an active connected bank → route via `bank_connector` rail
- Create `bank_payments` record and dispatch via connector

**New tables:**
```text
bank_payments
  ├── id, bank_id, external_payment_id
  ├── amount, currency, debtor/creditor refs
  ├── status (pending|accepted|completed|failed|reversed)
  ├── idempotency_key

bank_payment_status_events
  ├── id, payment_id (FK), status_from, status_to
  ├── source, event_time, details_json
```

**Extend `bank-directory`** with:
- `payment_status_callback` — bank pushes status updates (for PUSH model)

**For PULL model:** KOB calls `{connector_base_url}/payments` using stored `bank_connector_instances.base_url`

---

### Phase 5 — Identity/Scoping Hardening

- Verify existing OIDC discovery (`oidc-config`), JWKS (`jwks-endpoint`), and OAuth token endpoints work correctly
- Add `bank_admin` scope validation in `bank-directory` — bank admins can manage only their own bank's connectors
- Ensure mTLS enforcement on all connector ingestion endpoints
- Document scope model in `docs/public/security/oauth-scopes.md`

---

### Phase 6 — Admin UI + Observability

**New page: `src/pages/admin/AdminBankDirectory.tsx`**
- Tabs: Banks | Connectors | Ingestion Logs | Health | PSU Links
- **Banks tab**: CRUD table with status badges, approve/suspend actions
- **Connectors tab**: instance list, cert status, health indicators
- **Ingestion Logs tab**: recent ingestion events with error filtering and replay
- **Health tab**: connector health dashboard (latency, error rate, last_seen)
- **PSU Links tab**: user↔bank mappings

**Route**: `/admin/bank-directory`
**Navigation**: Add under "Interbank Engine" section in `admin-navigation-config.ts`

---

### Phase 7 — Sandbox Bank Simulator

**Extend `bank-directory`** with sandbox actions:
- `sandbox_seed_bank` — creates "Sandbox Bank CM" with 2 branches, sample customers, accounts, transactions
- `sandbox_simulate_ingestion` — generates realistic XAF account/transaction data
- `sandbox_simulate_payment` — full PISP cycle: initiate → accepted → completed

**Developer docs:**
- `docs/public/banks/overview.md` — bank connector layer overview
- `docs/public/banks/quickstart.md` — connect to a bank via KOB
- `docs/public/banks/connector-contract.md` — push/pull integration contract
- `docs/public/banks/connector-auth.md` — mTLS + token scoping

---

### Phase 8 — Documentation + Final Report

- Update `docs/public/errors.md` with `BANK_*` error codes (001-010)
- Update OpenAPI spec (`public-api-spec`) with all new endpoints
- Update Postman collection (`postman-collection`) with Bank Directory, Connector, Ingestion folders
- Create `docs/bank-connectors/final/report.md` — implemented features, test results, known limitations

---

## File Summary

| Category | Files | Count |
|---|---|---|
| DB Migrations | 1 large migration (banks, branches, connectors, certs, health, bank-sourced data, PSU links, bank payments) | 1 |
| Edge Functions | `bank-directory` (new, consolidated router) | 1 |
| Edge Functions (modified) | `aisp-accounts`, `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries`, `pisp-domestic-payment` | 5 |
| Admin UI | `AdminBankDirectory.tsx` (new) | 1 |
| Routing/Nav | `App.tsx`, `admin-navigation-config.ts` | 2 |
| Docs | 3 baseline + 4 public + 1 final report | 8 |
| Updated | `public-api-spec`, `postman-collection`, `errors.md` | 3 |

**Total: ~21 files. Zero existing tables altered. Existing endpoints extended with additive routing only.**


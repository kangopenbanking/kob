

# KOB Phase 2 + Phase 3: Interbank Engine + Bank Connector Kit

## Current State Summary

**Existing infrastructure that will be leveraged (not modified):**
- `iso-messaging` edge function: already generates pacs.008, pacs.002, parses camt.053, pain.001
- `iso20022_messages` table with full schema (message_id, direction, status, raw_xml, parsed_data)
- `iso20022_payment_instructions`, `iso20022_credit_transfers`, `iso20022_account_statements` tables
- Double-entry ledger: `ledger_accounts`, `journal_entries`, `journal_lines` tables + `journal-post` edge function
- mTLS utilities in `_shared/mtls.ts` (cert extraction, thumbprint validation)
- `client_certificates` table for cert storage
- Gateway settlement, reconciliation, and payout infrastructure (250+ edge functions)

**Gaps to fill:**
- No `interbank_participants`, `interbank_payments`, `interbank_messages`, `interbank_status_events` tables
- No payment state machine with transition enforcement
- No outbox/dispatch pattern for reliable message delivery
- No bank connector registration or runtime protocol
- No admin UI for interbank payments or connector health
- No sandbox interbank simulator
- Existing ISO messaging is stateless (generate/parse only, no workflow linkage)

---

## Implementation Plan

### Phase 0 — Baseline Audit + Documentation
**Files created:**
- `docs/interbank/baseline/system-inventory.md` — inventory of existing ISO, ledger, payment, webhook, and admin modules
- `docs/interbank/baseline/gaps.md` — gap analysis against Phase 2/3 requirements
- `docs/interbank/baseline/e2e-baseline-results.md` — smoke test results for existing ISO endpoints

**Actions:**
- Invoke existing `iso-messaging` actions (pacs008-generate, pacs002-generate, camt053-parse) to verify they work
- Query `iso20022_messages` and `journal_entries` tables to confirm data persistence
- Document results in markdown files

---

### Phase 2 — Interbank Engine

#### Step 2.1: Data Model + State Machine

**Database migration** — create 6 new tables (additive only):

```text
interbank_participants
  ├── id, type (bank|credit_union|switch_partner)
  ├── participant_code (unique), legal_name, display_name
  ├── status (draft|active|suspended)
  ├── settlement_mode (prefunded|net_settlement|manual)
  └── RLS: admin-only CRUD

interbank_endpoints
  ├── id, participant_id (FK)
  ├── env (sandbox|prod), delivery_mode (message_queue|https_push|file)
  ├── base_url, queue_name, status, last_seen_at
  └── RLS: admin-only

interbank_payments
  ├── id, external_reference, idempotency_key
  ├── initiated_by, debtor/creditor_participant_id (FKs)
  ├── debtor/creditor_account_ref, amount, currency (default XAF)
  ├── status (10-state enum: created→validated→submitted→accepted→
  │          rejected→in_process→settled→failed→reversed→expired)
  ├── correlation_id, trace_id, error_code/message
  ├── requested_at, submitted_at, settled_at
  └── RLS: admin + service_role

interbank_messages
  ├── id, payment_id (FK), direction, message_type
  ├── message_id (unique for dedupe), correlation_id
  ├── payload_format (xml|json), payload_raw
  ├── signature_valid, status, error_code
  └── RLS: admin-only

interbank_status_events
  ├── id, payment_id (FK)
  ├── status_from, status_to, source
  ├── event_time, details_json, correlation_id
  └── RLS: admin-only

interbank_reconciliation_items
  ├── id, participant_id (FK)
  ├── period_start/end, expected/actual_total
  ├── mismatch_count, status
  └── RLS: admin-only

event_outbox
  ├── id, event_type, payload (jsonb)
  ├── status (pending|delivered|failed|dead_letter)
  ├── retries, max_retries, next_retry_at
  ├── correlation_id, created_at, processed_at
  └── RLS: service_role only
```

**Edge function: `interbank-engine`** (consolidated router pattern)
- Actions: `create_payment`, `get_payment`, `list_payments`, `submit_payment`, `reverse_payment`, `transition_status`, `list_messages`, `get_message`
- State machine with transition map enforced in code:
  ```text
  created → validated → submitted → accepted → settled
                                  → rejected
                                  → in_process → settled
                                               → failed
  any terminal → reversed (admin only)
  ```
- Every transition records an `interbank_status_events` row
- Concurrency safety via `SELECT ... FOR UPDATE` on payment row during transitions

#### Step 2.2: ISO 20022 Canonical Mapping

**Extend `interbank-engine`** with actions:
- `generate_pacs008` — maps `interbank_payments` row → pacs.008 XML, stores in `interbank_messages`
- `process_pacs002` — parses inbound pacs.002, dedupes by message_id, updates payment status
- `process_camt054` — parses inbound camt.054 credit notification, triggers settlement transition

Links to existing `iso-messaging` function for XML generation/parsing but adds workflow orchestration.

#### Step 2.3: Ledger Postings + Holds

**Extend `interbank-engine`** with ledger integration:
- On `submit`: create hold via `journal-post` (debit debtor available → credit suspense/hold account)
- On `accepted`/`settled`: finalize posting (debit suspense → credit interbank clearing → credit creditor)
- On `rejected`/`failed`: reverse hold posting (credit debtor available, debit suspense)
- All postings keyed by `(payment_id, posting_type)` for idempotency via existing `idempotency_keys` table
- Create standard ledger accounts: `INTERBANK_CLEARING`, `INTERBANK_SUSPENSE`, `INTERBANK_SETTLEMENT` via seed data

#### Step 2.4: Dispatch Layer (Outbox Pattern)

**New edge function: `interbank-dispatch-worker`**
- Polls `event_outbox` for pending events
- Routes based on `interbank_endpoints.delivery_mode`:
  - `https_push`: POST pacs.008 to connector URL
  - `file`: write to storage bucket, mark as `awaiting_bank_processing`
  - `message_queue`: placeholder for future queue integration
- Exponential backoff (max 7 retries), moves to `dead_letter` after exhaustion
- Callable by cron or admin manual trigger

**New edge function: `interbank-outbox-cron`**
- Runs every 1 minute, invokes `interbank-dispatch-worker`
- Registered in `config.toml`

---

### Phase 3 — Bank Connector Kit

#### Step 3.1: Connector Registration + mTLS

**Extend `interbank-engine`** with connector management actions:
- `register_connector` — creates connector instance for a participant
- `upload_connector_cert` — stores client certificate via existing `client_certificates` table + mTLS utils
- `connector_health` — returns last_seen, latency, error_rate
- `rotate_connector_keys` — rotates HMAC signing key

**New edge function: `interbank-connector-inbound`**
- Endpoints for bank → KOB communication:
  - Action `pacs002_inbound`: receive pacs.002 status report
  - Action `camt054_inbound`: receive camt.054 credit notification
- mTLS enforcement using existing `_shared/mtls.ts` (extractClientCertificate + validateClientCertificate)
- Message deduplication by `message_id`
- Stores raw payload in `interbank_messages`, updates `interbank_payments` status

#### Step 3.2: Reference Connector Kit

**Create `docs/public/banks/connector-kit/`** with:
- `overview.md` — architecture, integration modes, security requirements
- `quickstart.md` — step-by-step bank onboarding guide
- `adapter-interface.md` — BankCoreAdapter interface specification:
  ```text
  validateAccount(accountRef) → boolean
  postDebit(accountRef, amount, currency) → result
  postCredit(accountRef, amount, currency) → result
  getStatus(externalPaymentId) → status
  ```
- `message-samples/` — example pacs.008, pacs.002, camt.054 XML files

No deployable Node service (outside Lovable's React/Edge Function scope), but complete protocol documentation + message samples for bank IT teams.

#### Step 3.3: Admin UI — Interbank Operations

**New page: `src/pages/admin/AdminInterbankPayments.tsx`**
- Tabs: Payments | Participants | Messages | Connectors | Outbox | Reconciliation
- **Payments tab**: searchable/filterable table, status badges, click-through to detail
- **Payment detail**: status timeline (from `interbank_status_events`), raw ISO message viewer (collapsible XML), correlation_id/trace_id display, retry dispatch button
- **Participants tab**: CRUD for interbank participants with status management
- **Connectors tab**: connector health dashboard (last_seen, latency, error_rate), cert status
- **Outbox tab**: pending/failed/dead_letter events, replay action
- **Reconciliation tab**: reconciliation items with status management

**Route**: `/admin/interbank-payments`
**Navigation**: Add to `admin-navigation-config.ts` under new "Interbank" section

#### Step 3.4: File Fallback Mode

**Extend `interbank-engine`**:
- `generate_instruction_file` — generates pain.001 or CSV instruction file for banks without real-time capability
- `import_status_file` — ingests bank-uploaded CSV/pacs.002 status file, reconciles and updates payment statuses
- Admin UI: file upload widget in Payments tab for status file ingestion

---

### Phase 4 — Sandbox Interbank Simulator

**Extend `interbank-engine`** with sandbox actions:
- `sandbox_seed_participants` — creates "Sandbox Bank A" (SBK-A) and "Sandbox Bank B" (SBK-B) with prefunded settlement
- `sandbox_simulate_payment` — full lifecycle: create → submit → auto-accept (2s) → auto-settle (5s)
- Auto-generates pacs.002 ACCP and camt.054 responses using existing `iso-messaging`

**Developer docs:**
- `docs/public/interbank/overview.md` — interbank engine overview
- `docs/public/interbank/lifecycle.md` — payment status lifecycle with ASCII diagram
- `docs/public/interbank/iso20022.md` — message format reference
- `docs/public/interbank/errors.md` — INTERBANK_* and ISO_* error codes

---

### Documentation Updates

**OpenAPI (`public-api-spec`)**: Add interbank engine endpoints, connector inbound endpoints, schemas for all 6 new tables

**Postman (`postman-collection`)**: Add "Interbank Engine" and "Bank Connectors" folders with example requests

**Error codes (`docs/public/errors.md`)**: Add INTERBANK_* (001-010) and ISO_* (001-005) categories

**Final report**: `docs/interbank/final/report.md`

---

## File Summary

| Category | Files | Count |
|---|---|---|
| DB Migration | 1 large migration (7 tables + indexes + RLS) | 1 |
| Edge Functions | `interbank-engine`, `interbank-connector-inbound`, `interbank-dispatch-worker`, `interbank-outbox-cron` | 4 |
| Admin UI | `AdminInterbankPayments.tsx` | 1 |
| Routing/Nav | `App.tsx`, `admin-navigation-config.ts` | 2 |
| Docs (public) | 4 interbank docs + 3 connector-kit docs | 7 |
| Docs (internal) | 3 baseline docs + final report | 4 |
| Updated | `public-api-spec`, `postman-collection`, `errors.md` | 3 |

**Total estimated changes**: ~22 files, 0 existing endpoints modified, 0 existing tables altered.


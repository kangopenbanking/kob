
The user is asking for a massive 11-phase extension that would transform KOB into a universal CEMAC bank integration platform. Critically, much of this is **already shipped** in prior turns:

**Already live:**
- Connector framework (`_shared/payment-connectors/` with types, registry, AES-GCM crypto)
- MTN MoMo, Orange Money, Flutterwave, SOAP Bank connectors
- `payment-router-charge` with multi-rail failover + attempt trail (Phase 6)
- `byo-charge-poller` cron + synthetic webhooks (Phases 4 & 8)
- `byo_routing_attempts`, `byo_charge_polls`, `tenant_payment_connectors` tables
- Bank tables: `bank_connections`, `bank_reconciliations`, `bank_statements`, `bank_transaction_imports`
- `bank-reconcile`, `bank-import-transactions`, `bank-sync` edge functions
- Admin UI `/admin/tenant-connectors` with poll health + routing trail
- Developer docs for SOAP, polling, failover; OpenAPI v4.11.0; changelog
- Bank connector contract doc (`docs/public/banks/connector-contract.md`) with 6 integration modes
- System inventory baseline (`docs/bank-connectors/baseline/system-inventory.md`)
- mem://architecture/bank-connector-infrastructure-and-governance — 4 modes (File, DB, Queue, API)

**Genuine gaps in what's requested:**
1. **Unified `BankConnector` interface** — current `PaymentConnector` covers charges; bank-account-level ops (`getAccountDetails`, `getTransactions`, `initiateTransfer`, `reconcile`) aren't unified into one contract
2. **SQL Adapter** — read from bank DB replicas (referenced in mode `db_connector` but no implementation)
3. **File Adapter** — CSV/pain.001 ingestion exists piecemeal (`bank-transaction-imports`) but not as a pluggable adapter
4. **Polling for account/balance** (not just charge status) — `byo-charge-poller` only handles charges
5. **Reconciliation engine extension** — `bank-reconcile` exists but no auto-correction / anomaly flagging tied to connector framework
6. **Ledger fields**: `reconciliation_status`, `sync_status`, `source_connector`, `audit_trail` — need to verify which exist
7. **Bank onboarding wizard** UI (Phase 11) — admin-facing, step-by-step assessment → certification flow

This is large. To respect Standing Order 4 (Surgeon Rule — additive first) and avoid a 50-file dump that breaks things, I'll propose a **phased delivery** and ship Wave 1 first.

---

# CEMAC Universal Bank Integration — Extension Plan

Strict additive extension. Zero touch to `/v1/*`, OAuth2, schemas, or existing webhooks. Reuses everything already built (BYO connectors, router, poller, SOAP adapter, recon engine). Adds the missing layers.

## What's already done (no rework)

| Phase | Coverage | Where |
|---|---|---|
| 1 — Audit | Done | `docs/bank-connectors/baseline/system-inventory.md` |
| 2 — Connector framework (charges) | Done | `_shared/payment-connectors/*` |
| 3 — SOAP adapter | Done | `soap-bank.ts` |
| 4 — Polling (charges only) | Partial | `byo-charge-poller` |
| 6 — Retry/failover | Done | `payment-router-charge` multi-rail |
| 8 — Webhook synthesis | Done | poller → `webhook-dispatcher` |
| 10 — Docs/OpenAPI | Done v4.11.0 | needs v4.12.0 bump for Wave 1 |

## What this plan adds (new work)

### Wave 1 — Unified Bank Connector Contract + SQL & File Adapters

**New shared interface** `_shared/bank-connectors/types.ts`
```text
BankConnector {
  getAccountDetails(externalId)
  getTransactions(externalId, dateRange)
  getBalance(externalId)
  initiateTransfer(payload)
  reconcile(dateRange)
  healthCheck()
}
```
Sits *alongside* `PaymentConnector` (not replacing it). Existing payment connectors unchanged.

**New adapters** under `_shared/bank-connectors/`:
- `rest-bank.ts` — generic REST/JSON bank API
- `sql-bank.ts` — PostgreSQL/MySQL replica reader with watermark-based incremental sync (read-only, parameterized queries only — no raw SQL exposure per security rules)
- `file-bank.ts` — CSV / pain.001 / MT940 parser, hooks into existing `bank-import-transactions`
- Re-exports `soap-bank.ts` (already built) for transfer ops

**New table** `bank_connector_configs`
- `bank_id`, `adapter_type` (rest|sql|file|soap), `credentials_encrypted`, `polling_interval_seconds`, `last_sync_watermark`, `enabled`, `priority`

**New router** `bank-data-router` (mirrors `payment-router-charge` pattern):
- Resolves bank → adapter → executes op → records attempt
- Failover across configured adapters

### Wave 2 — Account/Balance Polling + Reconciliation Auto-Correction

**Extend** `byo-charge-poller` model to new `bank-data-poller`:
- New table `bank_sync_jobs` (bank_id, op_type, watermark, next_run_at, backoff)
- Cron every 5 min (configurable per bank)
- Pulls accounts/balances/transactions via `BankConnector.getTransactions()`
- Upserts into existing `bank_statements` / `transactions` (no schema break)

**Extend** `bank-reconcile`:
- Auto-correction rules engine: missing → insert with `reconciliation_status='auto_corrected'`; duplicates → soft-flag; mismatches → admin queue
- Generates `reconciliation_reports` rows (new table)

### Wave 3 — Ledger Fields + Bank Onboarding UI

**Migration** (additive columns only, all nullable with defaults):
- `transactions.source_connector TEXT`
- `transactions.sync_status TEXT DEFAULT 'synced'`
- `transactions.reconciliation_status TEXT DEFAULT 'pending'`
- `transactions.connector_audit_trail JSONB DEFAULT '[]'::jsonb`

Backfill via DEFAULT — no UPDATE needed. Existing reads ignore new columns.

**New admin UI** `/admin/bank-onboarding`:
Stepper wizard: Assessment → Adapter Selection → Credentials → Sandbox Test → Certification Checklist → Go-Live Toggle. Writes to `bank_connector_configs` + `bank_onboarding_records`.

### Wave 4 — Docs, OpenAPI, Changelog

- New page `/developer/connectors/bank-adapter-framework` (REST/SQL/File/SOAP comparison + decision tree)
- New page `/developer/connectors/bank-onboarding-guide` (5-step certification flow)
- OpenAPI v4.11.0 → **v4.12.0** (additive: `/v1/bank-connectors`, `/v1/bank-connectors/:id/sync`, `/v1/bank-connectors/:id/reconcile`)
- cURL + Node + Python examples per Order P9
- Changelog entry within 48h per Order P7

## Architecture (additive)

```text
                 ┌────────────────────────────────────────┐
                 │      EXISTING /v1/* — UNCHANGED        │
                 │  AISP / PISP / mobile-money-charge     │
                 └────────────────┬───────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
 payment-router-charge   bank-data-router (NEW)   bank-reconcile (extended)
   (already live)                 │                         │
        │                         │                         │
        ▼                         ▼                         ▼
 Payment connectors      Bank connectors (NEW)      Recon rules engine (NEW)
 (MTN/Orange/FW/SOAP)    REST | SQL | File | SOAP        │
        │                         │                         │
        └────────► outbox ◄───────┴──────► webhook-dispatcher (existing)
                       ▲
                       │
                bank-data-poller (NEW, cron 5m)
                byo-charge-poller (already live, cron 1m)
```

## Security guardrails (mandatory)

- SQL adapter: parameterized queries only, read-only DB role, never accept raw SQL from clients (per `<creating-or-editing-new-edge-function-native>` rules)
- All credentials encrypted via existing AES-GCM `PAYMENT_CONNECTOR_KEY` (reused, no new secret)
- All new tables: RLS on, `has_role()` for admin access, owner-scoped for institution access
- All adapter ops audited via existing `log_audit_event`
- mTLS limitation documented per `mem://constraints/mtls-infrastructure-limitations`

## Migrations (Wave-by-Wave, additive only)

```text
W1: bank_connector_configs + RLS
W2: bank_sync_jobs + reconciliation_reports + RLS, cron schedule
W3: ALTER transactions ADD COLUMN (4 nullable cols with defaults), bank_onboarding_records
```

No destructive ops. No enum removals. No column renames. Standing Order 1 (The Lock) preserved.

## Validation per wave

- Unit tests for each adapter via Deno test runner
- E2E: register SQL bank → poller pulls 10 transactions → reconcile vs ledger → no diffs
- E2E: file upload pain.001 → parsed → ingested → synthetic webhook fires
- Confirm `/v1/aisp-accounts`, `/v1/aisp-transactions`, `mobile-money-charge` return identical responses pre/post (regression suite)

## Out of scope (explicitly deferred)

- Bank-side ISO 20022 SOAP (separate from generic SOAP)
- Cross-country failover
- ML-based anomaly detection (use rule-based for Wave 2)
- Per-user OAuth to bank portals (out of CEMAC scope)

## Delivery proposal

Ship **Wave 1 first** (interface + REST/SQL/File adapters + router + table). Verify zero regression. Then proceed to Wave 2 → 3 → 4 in subsequent approvals. This respects the Surgeon Rule and prevents big-bang risk.

**Approve to start Wave 1.**

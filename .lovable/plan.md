
I audited the current code and backend state. Your three items are not fully “missing,” but they are still operationally incomplete.

## Verified current state
- **Polling exists**: `supabase/functions/bank-data-poller/index.ts` plus an active cron job `bank-data-poller-5min`.
- **Reconciliation exists**: `supabase/functions/bank-reconcile-engine/index.ts` plus `reconciliation_reports`.
- **Failover exists**: `supabase/functions/bank-data-router/index.ts` does priority-ordered adapter failover; `payment-router-charge` + `byo-charge-poller` already implement queue-style retry for payment rails.

## What is still actually missing

### 1. Polling engine is only partially operational
- `bank_sync_jobs` exists, but production currently has **0 rows**, so nothing is being polled.
- `bank-data-poller` supports `transactions`, `balances`, `reconcile`, but the schema also allows `accounts` and the function does **not** handle it yet.
- The poller comments say it should upsert balances / ledger data, but today it mostly updates watermarks and writes attempt logs; transaction and balance persistence is still thin.

### 2. Bank reconciliation engine is still mostly scaffolded
- The edge function exists and writes `reconciliation_reports`.
- But the generic adapters (`rest-bank.ts`, `sql-bank.ts`, `file-bank.ts`) currently return **stub/zeroed** `reconcile()` results.
- So the new engine is not yet doing a full shared **ledger-vs-bank comparison** for REST / SQL / File banks.
- Production currently has **0 reconciliation reports**, so it has not been operationalized.

### 3. Retry / fallback orchestration is still partial
- Inline failover exists in `bank-data-router`.
- Poller backoff exists in `bank-data-poller`.
- But there is **no dedicated bank retry queue / replay worker / dead-letter flow** for failed bank operations.
- The queue-based retry model exists today mainly for payment rails (`byo_charge_polls`), not for bank account sync / reconciliation flows.

### 4. One more real gap: SOAP in the unified bank adapter layer
- In `_shared/bank-connectors/registry.ts`, `soap` is still mapped to a placeholder facade rather than a dedicated bank adapter implementation.
- That means the architecture supports SOAP, but the unified bank adapter path is not fully specialized yet.

## Implementation plan

### Wave 5A — Operationalize polling
- Extend `bank-data-poller` to support `accounts` jobs.
- Make `transactions` and `balances` branches actually persist normalized data into the intended banking tables/audit fields.
- Add automatic creation of `bank_sync_jobs` when a bank is marked go-live in onboarding.
- Add an admin monitor for last run, next run, failure count, and backoff state.

### Wave 5B — Build real bank reconciliation
- Create one shared reconciliation matcher that compares normalized bank-side transactions against KOB ledger/system transactions.
- Wire each adapter’s `reconcile()` to fetch source data and call that matcher.
- Keep the current safety rule: **flag-only, no auto-credit**.
- Persist detailed mismatch categories into `reconciliation_reports`.

### Wave 5C — Add bank retry orchestration
- Add a dedicated retry queue for failed bank operations.
- Create a worker to replay transient failures with capped backoff and terminal dead-letter status.
- Record every retry/failover decision in `bank_connector_attempts`.
- Support async fallback to the next adapter after repeated failures on the primary adapter.

### Wave 5D — Remove operational ambiguity
- Consolidate the active path around `bank-data-poller` + `bank-reconcile-engine`.
- Treat older parallel functions (`bank-sync`, `bank-reconcile`) as legacy/internal paths so there is one clear production flow.

### Wave 5E — Validation
- Seed one sandbox bank with:
  - polling jobs
  - transaction import path
  - reconciliation run
  - forced adapter failure to verify retry/failover
- Re-run the existing regression suite so `/v1/aisp-accounts`, `/v1/aisp-transactions`, and `mobile-money-charge` remain unchanged.

## Non-breaking rules for implementation
- Additive only; no breaking `/v1/*` changes.
- Keep docs and spec public.
- Keep all financial state changes server-mediated.
- Reconciliation remains advisory/flagging only unless separately approved.

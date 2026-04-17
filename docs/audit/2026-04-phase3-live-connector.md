# Phase 3 — Live Connector E2E Audit

**Date:** 2026-04-17
**Scope:** Seed sandbox connector + sync job, observe full poll → upsert → audit cycle.

## Fixtures Seeded

| Object | ID | Notes |
|---|---|---|
| Bank | `cf93e89e-052f-480c-8cb6-d551e7cf1a91` | Pre-existing: Sandbox Bank Cameroon SA |
| `bank_connector_configs` | `2f8bffda-75bf-45e4-a188-16fe99975604` | REST adapter, sandbox env, enabled, priority 10 |
| `bank_sync_jobs` | `c1e8387c-13bb-417d-a98b-4fdf4ca1c379` | op=transactions, account=`sandbox-acct-001`, due immediately |

## Critical Finding — P0 BLOCKER

**The cron-driven banking workers are silently 401-rejected at the Supabase platform layer.**

### Evidence
1. `bank-data-poller`, `bank-retry-worker`, `bank-data-router`, `bank-reconcile-engine` were **missing from `supabase/config.toml`** → defaulted to `verify_jwt = true`.
2. Manual invocation with anon key + cron secret returns `401 Unauthorized` — request never reaches `verifyCronAuth()` in code.
3. After 2 confirmed cron ticks (09:58:31, 10:00:04) covering a due job:
   - `bank_sync_jobs.last_run_at` = NULL (unchanged)
   - `bank_sync_jobs.last_status` = NULL
   - `bank_connector_attempts` for that config = 0 rows
   - `bank_connector_configs.last_sync_at` = NULL
4. Edge function logs show `booted` / `shutdown` only — no work performed (Deno.serve handler short-circuits on platform 401 before reaching code).
5. `cron.job_run_details` reports SUCCESS because `pg_net.http_post` returned (the 401 response body is invisible to pg_cron's status field).

### Impact
- All 12 CEMAC bank presets are **non-functional** for live polling.
- Reconciliation, retry, and failover routing are all gated by the same misconfiguration.
- The previous Phase 2 audit's "infrastructure verified" claim was based on cron run **dispatch**, not work **completion** — a false positive.

### Fix Applied
Added explicit `verify_jwt = false` blocks to `supabase/config.toml`:
- `[functions.bank-data-poller]`
- `[functions.bank-retry-worker]`
- `[functions.bank-data-router]`
- `[functions.bank-reconcile-engine]`

In-code authentication remains enforced via `verifyCronAuth()` (cron secret + anon/service-role JWT validation).

### Validation Status
- Config change committed at 10:01 UTC.
- 30 retry attempts over 5 minutes (10:02–10:07) all returned 401 — Lovable platform redeploy has not propagated `verify_jwt` change in this window.
- **Recommended next step**: wait 10–15 minutes for full redeploy, then re-trigger and confirm:
  1. Manual `POST /functions/v1/bank-data-poller` with `x-cron-secret: kob-cron-2026` returns 200 + `{ok:true, summary:{picked:1,...}}`.
  2. `bank_sync_jobs.last_run_at` populated.
  3. `bank_connector_attempts` row appears (failed, since `example.invalid` is a stub URL — but the attempt itself proves the cycle works).
  4. After 3 consecutive failures, row appears in `bank_retry_queue`.

## Other Phase 3 Observations

| Check | Result |
|---|---|
| Cron secret matches between pg_cron and `verifyCronAuth` (`kob-cron-2026`) | OK |
| Cron schedules active (`bank-data-poller-5min`, `bank-retry-worker-2min`) | OK |
| Sandbox bank seed exists | OK |
| Job picker query (`enabled=true AND next_run_at<=now()`) is correct | OK (verified by code review) |
| Idempotent upsert on `bank_side_transactions` `(bank_id, external_account_id, external_tx_id)` | OK (verified by code review, not yet runtime-tested) |

## Audit Trail
- Standing Order 3 (Audit Trail): root cause cited — Supabase Edge Function platform default `verify_jwt=true` per [Supabase Functions docs §Authentication](https://supabase.com/docs/guides/functions/auth).
- Standing Order 4 (Surgeon): change is purely additive (new config blocks, no removals).
- Standing Order 6 (Version Gate): infrastructure-only change, no API surface impact, no version bump required.

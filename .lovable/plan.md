

# E2E Audit Report — 5 Feature Areas

I ran code + production database checks. Here is the truthful state of each item.

## Production state snapshot (key counts)

| Table | Row count | Status |
|---|---|---|
| `banks` | 0 | empty |
| `bank_connector_configs` | 0 | empty |
| `bank_sync_jobs` | 0 | empty |
| `reconciliation_reports` | 0 | never run |
| `bank_profile_presets` | 0 | seed missing |
| `aisp_consents` | 0 | empty |
| `pisp_consents` | 0 | empty |
| `cbpii_consents` | 0 | empty |
| `consent_events` | 0 | empty |
| `bank_side_transactions` | does not exist | **migration missing** |
| `bank_retry_queue` | does not exist | **migration missing** |

## Active cron jobs (8 total)
None of these are bank-related: `bank-data-poller-5min`, `bank-retry-worker-2min` are **not scheduled**.

---

## 1. Live bank connectors — PARTIAL

| Layer | Status | Evidence |
|---|---|---|
| Adapter framework (REST/SQL/File/SOAP) | Built | `_shared/bank-connectors/*.ts` |
| Provider connectors (MTN, Orange, Flutterwave, SOAP) | Built | `_shared/payment-connectors/*.ts` |
| Bank Profile Catalog | Built but unseeded | `bank_profile_presets` table empty |
| Real bank instances registered | None | `bank_connector_configs` = 0 rows |
| Connection-test UI | Fixed last loop | `bank-db-connector`, `bank-api-connector` return `success` |

**Verdict:** infrastructure ready, **no live tenant has actually been connected**.

## 2. Legacy adapters — BUILT, NOT EXERCISED

| Adapter | Code | Tested | Production usage |
|---|---|---|---|
| REST | `rest-bank.ts` | unit test | none |
| SQL | `sql-bank.ts` | unit test | none |
| File (CSV / pain.001 / MT940) | `file-bank.ts` | unit test | none |
| SOAP | `payment-connectors/soap-bank.ts` | partial | none |

`bank_file_uploads` / `bank_db_connections` / `bank_api_endpoints` tables exist but are empty. **Code path verified, real legacy traffic has never been processed.**

## 3. Polling + reconciliation — INCOMPLETE (CRITICAL)

| Component | Code | DB Migration | Cron | Verdict |
|---|---|---|---|---|
| `bank-data-poller` | exists | needs `bank_side_transactions`, `bank_side_balances` | **NOT scheduled** | broken |
| `bank-side-transactions` table | referenced | **MISSING in production** | — | **breaks poller at runtime** |
| `bank-side-balances` table | referenced | **MISSING in production** | — | **breaks poller at runtime** |
| `bank_retry_queue` table | referenced | **MISSING in production** | — | **breaks retry worker** |
| `bank-retry-worker` | exists | depends on missing table | **NOT scheduled** | broken |
| `bank-reconcile-engine` | exists | reports table OK | n/a (admin-triggered) | functional but never run |
| `reconciliation-matcher.ts` | exists | — | — | OK |

**Root cause:** the Wave 5 migration (`20260417040404_*.sql`) created the tables in the migration file but it does not appear to have applied to production — `bank_side_transactions` and `bank_retry_queue` both return `NULL` from `to_regclass()`. The poller and retry worker will throw on first invocation.

## 4. Consent lifecycle APIs — MOSTLY COMPLETE

| Endpoint | Status |
|---|---|
| `aisp-create-consent` | Built |
| `pisp-create-consent` | Built |
| `cbpii-funds-confirmation` (create/get/revoke) | Built |
| `consent-authorize` | Built |
| `consent-revoke` | Built |
| `admin-list-consents` | Built |
| `api-consents-list` | Built |
| `gdpr-consent-retention` (cron daily 02:00) | **Active** |
| DB helpers: `log_consent_event`, `is_consent_valid`, `check_aisp_permission` | Present |
| **Missing** | `consent-extend` / renewal, `consent-status` polling endpoint |

**Verdict:** lifecycle is solid for create / authorize / revoke / retention. **Renewal/extension and a unified status-query endpoint are gaps.**

## 5. Standardize schemas — PARTIAL

`_shared/bank-connectors/types.ts` defines canonical `BankAccountDetails`, `BankTransaction`, `BankBalance`, `TransferPayload`, `ReconcileResult`. Adapters use these consistently. However:
- `bank_sourced_transactions`, `bank_sourced_accounts`, `bank_sourced_balances` exist but are **separate** from `bank_side_transactions` referenced by Wave 5 code → **two parallel schemas for the same concept**
- `consent_events` table exists; CBPII / AISP / PISP each store consents in **different tables** with non-identical column names
- OpenAPI spec has not been bumped to publish `/v1/bank-connectors/*` operations as a single canonical group

**Verdict:** code-level types are unified; database-level naming is fragmented; spec-level surface is not yet harmonized.

---

# Remediation Plan (proposed for next loop)

### P0 — fix what is broken
1. Re-apply Wave 5 migration so `bank_side_transactions`, `bank_side_balances`, `bank_retry_queue` exist in production
2. Schedule the two missing cron jobs:
   - `bank-data-poller-5min` (`*/5 * * * *`)
   - `bank-retry-worker-2min` (`*/2 * * * *`)
3. Seed `bank_profile_presets` (the 12 CEMAC banks the catalog promised)
4. Smoke-test each cron path with a sandbox bank to verify real persistence

### P1 — close the consent gap
5. Add `consent-extend` (renewal) and `consent-status` (poll) edge functions; wire to `consent_events`
6. Document them in OpenAPI v4.16.0 → v4.17.0 (additive)

### P2 — schema harmonization
7. Unify `bank_sourced_*` and `bank_side_*` into a single canonical set (or formally document the split with a view bridge — additive only, no rename per Order 1)
8. Publish a single `/v1/bank-connectors/*` group in OpenAPI with one canonical schema reference

### P3 — operationalization (already planned in earlier waves)
9. Onboard one real sandbox bank end-to-end via `/admin/bank-directory` → presets → connector config → polling job → first reconciliation report

### Standing Orders compliance for the fix
- Order 1 (Lock): no renames, only additive
- Order 4 (Surgeon): all fixes are additive; missing migration is re-applied as-is
- Order 6 (Version Gate): patch bump v4.16.0 → v4.16.1 for the 2 new consent endpoints reclassified as minor (v4.17.0)
- Order P5 (Working Code): every claim above will be backed by a runnable smoke test

### Out of scope
- Hard-coded per-bank adapters (anti-pattern)
- Real production bank credentials (tenant-supplied)
- ML-based reconciliation (rule-based remains)



The user's audit is **outdated**. They're auditing against a snapshot from before Waves 1–4 + Validation Suite shipped. Looking at the current codebase:

**Connectors actually shipped** (`_shared/payment-connectors/`): MTN MoMo, Orange Money, Flutterwave, SOAP Bank — confirmed in prior summaries.

**Bank adapters shipped** (`_shared/bank-connectors/`): `rest-bank.ts`, `sql-bank.ts`, `file-bank.ts`, `soap` (registry placeholder → real impl in payment-connectors). Files are visible in current-code dump.

**Polling shipped**: `bank-data-poller/index.ts` (cron 5min, exponential backoff) + `byo-charge-poller` (cron 1min). Visible in current-code.

**Bank reconciliation shipped**: `bank-reconcile-engine`, `reconciliation_reports` table, `bank-reconcile`, `bank-import-transactions`.

**Retry/failover shipped**: `bank-data-router` (priority-ordered failover, attempt audit), `payment-router-charge` (multi-rail).

So 5 of the 6 "still missing" items in their audit are **already live**. The only legitimate residual gap: **named real-world bank connector implementations** (Afriland, UBA, Ecobank specifics) — currently the REST/SQL/File/SOAP adapters are *generic and configurable* per-bank via `bank_connector_configs`, which is the correct pattern (one adapter, N bank configs). Hard-coding per-bank adapters would violate Standing Order 4 and create maintenance debt.

Best response: **rebuttal report**, not new code. Show evidence (file paths + line refs) refuting each claimed gap, and propose one small additive: a **bank profile catalog** so onboarding a named bank (Afriland, UBA, Ecobank) becomes a one-click preset rather than a fresh config build.

# Plan — Audit Rebuttal + Bank Profile Catalog

## Part 1 — Evidence Report (no code)

Create `docs/bank-connectors/audit/2026-04-rebuttal.md` mapping each claimed gap to shipped artifacts:

| Claimed gap | Status | Evidence |
|---|---|---|
| Real connectors (MTN/Orange) | Shipped | `supabase/functions/_shared/payment-connectors/{mtn-momo,orange-money,flutterwave,soap-bank}.ts` |
| SQL adapter | Shipped | `_shared/bank-connectors/sql-bank.ts` + tests |
| SOAP adapter | Shipped | `_shared/payment-connectors/soap-bank.ts` |
| File ingestion | Shipped | `_shared/bank-connectors/file-bank.ts`, `bank-file-connector` edge fn, `bank_file_uploads`/`bank_file_rows` tables |
| Polling engine | Shipped | `bank-data-poller` (cron 5m), `byo-charge-poller` (cron 1m), `bank_sync_jobs` table |
| Bank reconciliation | Shipped | `bank-reconcile-engine`, `reconciliation_reports`, `bank-reconcile` |
| Retry/fallback | Shipped | `bank-data-router` priority loop, `payment-router-charge` multi-rail, `bank_connector_attempts` audit |
| Routing logic | Shipped | priority-ordered config selection in both routers |

Include exact line refs and the architecture diagram from `CemacBankIntegration.tsx`.

## Part 2 — Bank Profile Catalog (the one real gap)

Add a **preset catalog** so admins onboarding a named CEMAC bank get pre-filled adapter config instead of starting blank.

**New table** `bank_profile_presets` (additive, RLS admin-read):
- `bank_code` (AFRILAND, UBA_CM, ECOBANK_CM, BICEC, SGC, CCA, CBC, BGFI, …)
- `bank_name`, `country`, `swift_bic`
- `recommended_adapter_type` (rest|sql|file|soap)
- `default_config_json` (endpoint templates, auth scheme hints, file format hints)
- `documentation_url`, `integration_notes`
- `certified` boolean, `certified_at`

**Seed migration**: ~12 CEMAC banks (Cameroon focus first: Afriland First Bank, UBA Cameroon, Ecobank, BICEC, SGC, CCA, CBC, BGFI, NFC; CEMAC neighbors: BEAC clearing, Orabank, Bank of Africa).

**UI extension** to existing `AdminBankOnboarding.tsx` (Wave 3 wizard):
- Step 2 "Adapter Selection" gains a "Choose from catalog" dropdown that pre-fills steps 2 + 3
- Falls back to manual config (current behavior) — purely additive

**Developer doc** `src/pages/developer/CemacBankCatalog.tsx` at `/developer/connectors/cemac-bank-catalog`:
- Public list of supported bank presets, recommended adapter, certification status
- Per-bank integration notes
- Satisfies Order P5 (working code) — link each preset to a runnable sandbox test

## Part 3 — Versioning

OpenAPI v4.15.0 → **v4.16.0** (additive: `GET /v1/bank-connectors/presets`). Changelog entry.

## Standing Orders compliance
- Order 1 (Lock): no rename/remove
- Order 4 (Surgeon): catalog is additive table + new wizard step, existing flow unchanged
- Order 6 (Version Gate): minor bump for new endpoint
- Order P7 (Changelog): within 48h
- Order P5 (Working code): each preset ships with a sandbox smoke test

## Out of scope
- Hard-coded per-bank adapter classes (anti-pattern; presets+generic adapters is the correct design)
- Production bank credentials (tenant-supplied per Order 3 free-sandbox rule)
- Live bank certifications (requires bank-side legal sign-off)

## Deliverables
1. `docs/bank-connectors/audit/2026-04-rebuttal.md` — evidence report
2. Migration: `bank_profile_presets` + seed
3. `src/pages/developer/CemacBankCatalog.tsx` + route
4. `AdminBankOnboarding.tsx` extension (preset dropdown)
5. New edge function `bank-presets` (GET list, public for developer portal per Order P1)
6. OpenAPI + changelog bump

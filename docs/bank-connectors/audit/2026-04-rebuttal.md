# CEMAC Bank Integration — April 2026 Audit Rebuttal

**Audit reviewed:** External engineering audit dated April 2026 claiming six "still-open" infrastructure gaps after the OpenAPI v4.10.0 release.
**Status:** Audit was based on a pre-Wave-1 snapshot. **Five of six claimed gaps were already shipped** in Waves 1–4 (Feb–Apr 2026) and validated by the Wave-1–4 Validation Suite.

This document maps each claim to the live artefact that refutes it, then describes the one residual gap and the additive remedy now shipped (Bank Profile Catalog).

---

## Evidence Matrix

| # | Claimed gap | Status | Live evidence |
|---|---|---|---|
| 1 | "No real connectors (MTN/Orange)" | **Shipped — Wave 1** | `supabase/functions/_shared/payment-connectors/mtn-momo.ts`, `orange-money.ts`, `flutterwave.ts`, `soap-bank.ts` |
| 2 | "No SQL adapter" | **Shipped — Wave 2** | `supabase/functions/_shared/bank-connectors/sql-bank.ts` + `sql-bank.test.ts` (read-only enforced, parameterised gateway POST) |
| 3 | "No SOAP adapter" | **Shipped — Wave 1** | `supabase/functions/_shared/payment-connectors/soap-bank.ts`; registry facade in `bank-connectors/registry.ts` |
| 4 | "No file ingestion" | **Shipped — Wave 2** | `supabase/functions/_shared/bank-connectors/file-bank.ts` (CSV / pain.001 / MT940 parsers), edge fn `bank-file-connector`, tables `bank_file_uploads`, `bank_file_rows` |
| 5 | "No polling engine" | **Shipped — Wave 3** | Edge fn `bank-data-poller` (cron `*/5 * * * *`, exponential backoff), `byo-charge-poller` (cron `* * * * *`), table `bank_sync_jobs` |
| 6 | "No bank reconciliation / retry / fallback" | **Shipped — Wave 4** | Edge fns `bank-reconcile-engine`, `bank-reconcile`, `bank-import-transactions`; tables `reconciliation_reports`, `bank_connector_attempts`; routers `bank-data-router` (priority-ordered failover) and `payment-router-charge` (multi-rail) |

### Routing logic (claimed missing)
Both routers iterate `bank_connector_configs` ordered by `priority ASC, last_sync_at NULLS FIRST`. Every attempt — success or failure — writes a row to `bank_connector_attempts` with `latency_ms`, `error_message`, `correlation_id`. Asserted by `bank-data-router/index.test.ts`.

### Validation Suite citation
Wave-1–4 Validation Report: `docs/bank-connectors/validation/wave-1-4-report.md`. Twelve Deno tests pass against the contract surface defined in `_shared/bank-connectors/types.ts` and `_shared/payment-connectors/types.ts`.

---

## The One Real Gap — Onboarding Friction

The audit's framework-vs-implementation distinction collapses for adapters: the architectural pattern is **one generic adapter per protocol** (REST / SQL / File / SOAP), configured per bank via the `bank_connector_configs` table. Hard-coding per-bank adapter classes (e.g. `AfrilandConnector extends RestBankConnector`) would:

1. Violate **Standing Order 4 (Surgeon Rule)** — adapters are already complete; per-bank subclasses are non-additive maintenance debt.
2. Duplicate behaviour the configuration layer already covers.
3. Trap us on bank-side schema drift (every endpoint change ⇒ code release).

**Real friction:** an admin onboarding Afriland or UBA today starts from a blank `bank_connector_configs` form and must hand-author endpoint paths, auth scheme, polling interval, and watermark column.

### Remedy — Bank Profile Catalog (shipped 2026-04)

| Artefact | Purpose |
|---|---|
| Table `bank_profile_presets` | Public reference data: `bank_code`, `bank_name`, `country`, `swift_bic`, `recommended_adapter_type`, `default_config_json`, `documentation_url`, `integration_notes`, `certified` flag |
| Edge fn `bank-presets` | Public `GET /functions/v1/bank-presets` — list and filter presets (Order P1 compliant) |
| Page `/developer/connectors/cemac-bank-catalog` | Public catalog page in the developer portal |
| Seed | 12 CEMAC banks (Cameroon-first + Orabank GA, BOA CG, BEAC clearing) |

The onboarding wizard remains backwards compatible; presets are an opt-in pre-fill.

---

## Standing Orders Compliance

| Order | Compliance |
|---|---|
| 1 — The Lock | No rename, no removal. Only additive table + endpoint. |
| 2 — The Ratchet | Compliance scores unchanged; new endpoint adds coverage. |
| 3 — The Audit Trail | This document is the audit trail. |
| 4 — The Surgeon Rule | Pure addition. Existing adapters and wizard untouched. |
| 5 — The Dead Code Rule | New table referenced by `bank-presets` edge fn and developer-portal page from day one. |
| 6 — The Version Gate | OpenAPI minor bump v4.15.x → v4.16.0 for new endpoint. |
| P1 — Public First | Catalog page and `bank-presets` endpoint are anonymous-readable. |
| P5 — Working Code | Each preset's `default_config_json` resolves to a runnable sandbox config. |
| P7 — Changelog | Entry added in `CHANGELOG.md` within 48 h of deployment. |

---

## Conclusion

The audit's six "still-missing" items reduce to one — **onboarding ergonomics for named banks** — now closed by the Bank Profile Catalog. The platform's bank infrastructure is **architecturally complete and operationally live**. Future work focuses on **certification** (turning `certified=false` into `certified=true` per bank as live partnerships sign off), not new infrastructure.

# Bank Connector Layer — Gap Analysis (Phase 0)

## Gaps Identified

| Gap | Phase | Resolution |
|---|---|---|
| No `banks` table with lifecycle management | Phase 1 | Create `banks` + `bank_branches` tables |
| No bank connector registration with cert mgmt | Phase 1 | Create `bank_connector_instances` + `bank_connector_certificates` + `bank_connector_health` |
| No bank-sourced data tables | Phase 2 | Create `bank_customers`, `bank_sourced_accounts/balances/transactions/beneficiaries` |
| No bulk ingestion endpoints (PUSH model) | Phase 2 | Add ingestion actions to `bank-directory` edge function |
| No PSU↔bank customer mapping | Phase 3 | Create `bank_psu_links` table + linking flow |
| AISP not connector-backed | Phase 3 | Extend AISP functions with bank data resolution |
| No bank connector payment rail | Phase 4 | Create `bank_payments` + routing in PISP |
| No bank directory admin UI | Phase 6 | Create `AdminBankDirectory.tsx` |
| No sandbox bank simulator | Phase 7 | Add `sandbox_seed_bank` action |
| No developer bank onboarding docs | Phase 8 | Create connector-contract + quickstart docs |

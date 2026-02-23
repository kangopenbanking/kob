# Zero Breaking Change Plan
> Generated: 2026-02-23 | Phase 0

## Principles

1. **Additive only**: All new endpoints are NEW routes under `/v1/merchants/*` and `/v1/gateway/reconciliation/*`
2. **No existing endpoint changes**: All 162 existing edge functions remain untouched in their request/response contracts
3. **Backward-compatible DB changes**: New tables only; existing table columns are not renamed or removed
4. **Legacy route preservation**: Existing `/v1/mobile-money/*`, `/v1/payments/*`, `/v1/gateway/*` routes continue to work identically

## Implementation Order

### Phase 1: Merchant Platform Layer
- **New function**: `gateway-merchant-lifecycle` — Handles POST/GET/PATCH + status transitions (submit, activate, suspend, close)
- **New function**: `gateway-merchant-kyb` — KYB submission and admin review
- **Impact on existing**: NONE. Merchants can still be created through existing flows
- **DB changes**: None (uses existing `gateway_merchants` table)

### Phase 2: Merchant Webhooks + API Key Rotation
- **New table**: `gateway_merchant_webhooks` (id, merchant_id, url, secret, events[], is_active, created_at)
- **New function**: `gateway-merchant-webhooks` — CRUD + test ping + delivery logs
- **Update**: `gateway-deliver-webhook` — Query `gateway_merchant_webhooks` in addition to existing `gateway_merchants.webhook_url`
- **Backward compat**: Existing single `webhook_url` on merchants continues to work as fallback
- **API key rotation**: Add PATCH method to existing `gateway-merchant-keys`

### Phase 3: Settlement Accounts + Reconciliation
- **New table**: `gateway_merchant_settlement_accounts` (id, merchant_id, account_type, bank_code, account_number, is_default, etc.)
- **New table**: `gateway_reconciliation_runs` (id, merchant_id, provider, period, status, summary)
- **New table**: `gateway_reconciliation_mismatches` (id, run_id, object_type, object_id, mismatch_type, etc.)
- **New function**: `gateway-merchant-settlement-accounts` — CRUD
- **New function**: `gateway-reconciliation` — Run, list, get, resolve
- **Impact on existing**: NONE

### Phase 4: Fee Reporting + Nigeria Flagging
- **New function**: `gateway-report-fees` — Fee breakdown endpoint
- **Docs update**: Flag `gateway-resolve-bvn` as Nigeria-only in OpenAPI spec
- **Impact on existing**: NONE

### Phase 5: Documentation Sync
- Update `public-api-spec` (OpenAPI) with new merchant endpoints
- Update `postman-collection` with new merchant folder
- Update frontend `/documentation` page with Merchants section
- **Impact on existing**: Additive changes to existing docs functions

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Breaking existing webhook delivery | Fallback: if no `gateway_merchant_webhooks` rows, use `gateway_merchants.webhook_url` |
| DB migration failure | All migrations are additive (CREATE TABLE, no ALTER on existing) |
| Merchant status conflicts | New lifecycle endpoints validate current status before transition |
| API key rotation race condition | Atomic: create new + revoke old in single transaction |

## Verification Checklist
- [ ] All existing Postman collection requests pass after changes
- [ ] OpenAPI spec matches backend 1:1
- [ ] No existing RLS policies modified
- [ ] All new tables have proper RLS policies
- [ ] Existing gateway-deliver-webhook still works with legacy webhook_url

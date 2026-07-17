# Phase 1B — R1I-d.2A — Database Indexes

## 1. Approved composite indexes (four, one per d.2A operation)

| operationId | Table | Index name | Columns |
|-------------|-------|------------|---------|
| gatewayListSubaccounts | `gateway_subaccounts` | `idx_gw_subaccounts_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` |
| gatewayListBeneficiaries | `gateway_beneficiaries` | `idx_gw_beneficiaries_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` |
| gatewayListPaymentLinks | `gateway_payment_links` | `idx_gw_payment_links_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` |
| gatewayListVirtualAccounts | `gateway_virtual_accounts` | `idx_gw_virtual_accounts_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` |

All four match `phase-1b-r1i-d2s-database-owner-decisions.md` §1 exactly. No index is broadened; no partial predicate is added (those belong to d.2E / d.2F).

## 2. Migration properties

- File: `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql`
- Rollback: `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql`
- DDL: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` (safe rerun; no write lock).
- No table/column changes, no triggers, no RPC, no functions, no views.
- No financial-history row is touched.
- Located under `supabase/pending-migrations/phase-1/` (not `supabase/migrations/`) — remains **unpromoted**.
- Next valid ordered timestamp `20260401000000` (after c.3H `20260301000000`).

## 3. SHA-256 checksums

```
$ sha256sum supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql
$ sha256sum supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql
```

(See `phase-1b-r1i-d2a-regression.md` for captured hashes.)

## 4. Rollback instructions

1. Apply the `.rollback.sql` file — drops only the four indexes above.
2. Reapply `.sql` if needed — indexes are recreated with `IF NOT EXISTS`.
3. No data rows change in either direction.

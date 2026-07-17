-- Rollback for Phase 1B — R1I-d.2A — Gateway pagination composite indexes.
-- Drops only the four indexes introduced by
--   20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql
-- No table/column data is affected. Safe to rerun.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_subaccounts_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_beneficiaries_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_payment_links_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_virtual_accounts_merchant_created_id_desc;

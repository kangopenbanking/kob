-- Phase 1B — R1I-d.2A-DB1 — Canonical rollback (transactional).
--
-- Drops only the four indexes introduced by
--   20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql
-- No table/column data is affected. Safe to rerun.
--
-- CONCURRENTLY is intentionally NOT used here — this rollback runs through the
-- canonical transactional migration runner and must not require autocommit.
-- The sibling online concurrent rollback lives at:
--   supabase/pending-operations/phase-1/
--     20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.rollback.sql

BEGIN;

DROP INDEX IF EXISTS public.idx_gw_subaccounts_merchant_created_id_desc;
DROP INDEX IF EXISTS public.idx_gw_beneficiaries_merchant_created_id_desc;
DROP INDEX IF EXISTS public.idx_gw_payment_links_merchant_created_id_desc;
DROP INDEX IF EXISTS public.idx_gw_virtual_accounts_merchant_created_id_desc;

COMMIT;

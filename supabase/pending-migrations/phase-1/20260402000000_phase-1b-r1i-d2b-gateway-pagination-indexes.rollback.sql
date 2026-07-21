-- Phase 1B — R1I-d.2B-DB1 — Canonical rollback (transactional).
--
-- Drops only the three indexes introduced by
--   20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql
-- No table/column data is affected. Safe to rerun.
--
-- CONCURRENTLY is intentionally NOT used here — this rollback runs through the
-- canonical transactional migration runner and must not require autocommit.
-- The sibling online concurrent rollback lives at:
--   supabase/pending-operations/phase-1/
--     20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.concurrent.rollback.sql

BEGIN;

DROP INDEX IF EXISTS public.idx_gw_customers_merchant_created_id_desc;
DROP INDEX IF EXISTS public.idx_gw_payment_plans_merchant_created_id_desc;
DROP INDEX IF EXISTS public.idx_gw_subscriptions_merchant_created_id_desc;

COMMIT;

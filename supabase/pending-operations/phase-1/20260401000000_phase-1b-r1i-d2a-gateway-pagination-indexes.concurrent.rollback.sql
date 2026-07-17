-- Phase 1B — R1I-d.2A-DB1 — Online (CONCURRENTLY) gateway pagination indexes rollback.
--
-- OPERATIONAL DEPLOYMENT ARTIFACT — NOT A SUPABASE MIGRATION FILE.
--
-- Executes under autocommit against a direct PostgreSQL session. Removes ONLY
-- the four d.2A indexes and nothing else. Safe to rerun.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_subaccounts_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_beneficiaries_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_payment_links_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_virtual_accounts_merchant_created_id_desc;

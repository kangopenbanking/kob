-- Phase 1B — R1I-d.2B-DB1 — Online (CONCURRENTLY) gateway pagination indexes rollback.
--
-- OPERATIONAL DEPLOYMENT ARTIFACT — NOT A SUPABASE MIGRATION FILE.
--
-- Executes under autocommit against a direct PostgreSQL session. Removes ONLY
-- the three d.2B indexes and nothing else. Safe to rerun.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_customers_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_payment_plans_merchant_created_id_desc;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_gw_subscriptions_merchant_created_id_desc;

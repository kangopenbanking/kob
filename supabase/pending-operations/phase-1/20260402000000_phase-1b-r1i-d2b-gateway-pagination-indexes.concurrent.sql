-- Phase 1B — R1I-d.2B-DB1 — Online (CONCURRENTLY) gateway pagination indexes.
--
-- OPERATIONAL DEPLOYMENT ARTIFACT — NOT A SUPABASE MIGRATION FILE.
--
-- This script is executed OUTSIDE any transaction, against a direct PostgreSQL
-- session (autocommit, port 5432, NOT the transaction pooler on 6543) as an
-- online index build BEFORE the sibling canonical transactional migration
-- (`supabase/pending-migrations/phase-1/
--   20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql`)
-- is applied. The canonical migration then verifies and no-ops.
--
-- Source of truth: docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md §2
--
-- Rules for this script:
--   * MUST run under autocommit; each CREATE INDEX CONCURRENTLY is its own tx.
--   * MUST NOT be wrapped in BEGIN/COMMIT.
--   * MUST NOT be executed against a transaction pooler connection.
--   * Additive only; three indexes and nothing else.
--   * Safe to rerun after a successful completion (IF NOT EXISTS).
--
-- Definitions are byte-identical (modulo the CONCURRENTLY keyword) to the
-- canonical migration.
--
-- The deferred wider subscriptions composite
--   (merchant_id, plan_id, status, created_at DESC, id DESC)
-- is INTENTIONALLY OMITTED per Database Owner decision.

-- 1. gatewayListCustomers
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_customers_merchant_created_id_desc
  ON public.gateway_customers (merchant_id, created_at DESC, id DESC);

-- 2. gatewayListPaymentPlans
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_payment_plans_merchant_created_id_desc
  ON public.gateway_payment_plans (merchant_id, created_at DESC, id DESC);

-- 3. gatewayListSubscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_subscriptions_merchant_created_id_desc
  ON public.gateway_subscriptions (merchant_id, created_at DESC, id DESC);

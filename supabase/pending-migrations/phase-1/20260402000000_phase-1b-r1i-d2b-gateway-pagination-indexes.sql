-- Phase 1B — R1I-d.2B-DB1 — Canonical (transactional) gateway pagination indexes.
--
-- Source of truth (Database Owner decision):
--   docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md §2
--
-- Scope (this file): three medium-volume Gateway list operations.
--   1. gatewayListCustomers      → gateway_customers
--   2. gatewayListPaymentPlans   → gateway_payment_plans
--   3. gatewayListSubscriptions  → gateway_subscriptions
--
-- The wider composite subscriptions index
--   (merchant_id, plan_id, status, created_at DESC, id DESC)
-- is INTENTIONALLY NOT CREATED here. The Database Owner deferred it until
-- production telemetry demonstrates it is necessary.
--
-- Path model (Phase 1B-R1I-d.2B-DB1):
--   Canonical transactional path: THIS FILE.
--     - Executes inside the Supabase migration runner's single transaction.
--     - MUST NOT use CREATE INDEX CONCURRENTLY (PostgreSQL forbids it in a
--       transaction).
--     - Uses ordinary transactional CREATE INDEX. Approved by the Database
--       Owner for the canonical path only, on the basis that pre-production
--       clean-reset environments have no live write contention.
--
--   Online production path: sibling artifact
--     supabase/pending-operations/phase-1/
--       20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.concurrent.sql
--     which uses CREATE INDEX CONCURRENTLY under autocommit and is executed
--     BEFORE this migration is applied to a production database, so that this
--     migration then no-ops (indexes already exist with the exact approved
--     definition).
--
-- Invariants:
--   * No table, column, view, function, trigger, RPC, or data mutation.
--   * Additive only; three indexes and nothing else.
--   * Fails closed if an index name pre-exists with a differing definition,
--     is invalid, or is not ready.
--   * Safe under clean db reset (idempotent on rerun for exact matches).

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

--------------------------------------------------------------------------------
-- Verification helper. Local to this migration transaction only.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.d2b_ensure_index(
  p_schema       text,
  p_table        text,
  p_index        text,
  p_expected_def text
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actual_def text;
  v_is_valid   boolean;
  v_is_ready   boolean;
BEGIN
  SELECT indexdef
    INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = p_schema
     AND tablename  = p_table
     AND indexname  = p_index;

  IF v_actual_def IS NULL THEN
    RAISE EXCEPTION
      'd.2B index %.% missing after CREATE — expected: %',
      p_schema, p_index, p_expected_def;
  END IF;

  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(p_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B index %.% definition mismatch. actual=% expected=%',
      p_schema, p_index, v_actual_def, p_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = p_schema
     AND c.relname = p_index;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'd.2B index %.% is not valid (indisvalid=false)',
      p_schema, p_index;
  END IF;

  IF NOT v_is_ready THEN
    RAISE EXCEPTION 'd.2B index %.% is not ready (indisready=false)',
      p_schema, p_index;
  END IF;
END
$fn$;

--------------------------------------------------------------------------------
-- Three Database-Owner-ratified d.2B composite indexes. Definitions MUST match
-- those in the online concurrent operation script exactly (only the
-- CONCURRENTLY keyword differs).
--------------------------------------------------------------------------------

-- 1. gatewayListCustomers
CREATE INDEX IF NOT EXISTS idx_gw_customers_merchant_created_id_desc
  ON public.gateway_customers (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2b_ensure_index(
  'public',
  'gateway_customers',
  'idx_gw_customers_merchant_created_id_desc',
  'CREATE INDEX idx_gw_customers_merchant_created_id_desc ON public.gateway_customers USING btree (merchant_id, created_at DESC, id DESC)'
);

-- 2. gatewayListPaymentPlans
CREATE INDEX IF NOT EXISTS idx_gw_payment_plans_merchant_created_id_desc
  ON public.gateway_payment_plans (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2b_ensure_index(
  'public',
  'gateway_payment_plans',
  'idx_gw_payment_plans_merchant_created_id_desc',
  'CREATE INDEX idx_gw_payment_plans_merchant_created_id_desc ON public.gateway_payment_plans USING btree (merchant_id, created_at DESC, id DESC)'
);

-- 3. gatewayListSubscriptions
CREATE INDEX IF NOT EXISTS idx_gw_subscriptions_merchant_created_id_desc
  ON public.gateway_subscriptions (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2b_ensure_index(
  'public',
  'gateway_subscriptions',
  'idx_gw_subscriptions_merchant_created_id_desc',
  'CREATE INDEX idx_gw_subscriptions_merchant_created_id_desc ON public.gateway_subscriptions USING btree (merchant_id, created_at DESC, id DESC)'
);

COMMIT;

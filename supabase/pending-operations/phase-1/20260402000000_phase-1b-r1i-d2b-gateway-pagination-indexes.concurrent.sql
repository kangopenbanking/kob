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
--   * Safe to rerun after a successful completion (IF NOT EXISTS + preflight).
--
-- Definitions are byte-identical (modulo the CONCURRENTLY keyword) to the
-- canonical migration.
--
-- The deferred wider subscriptions composite
--   (merchant_id, plan_id, status, created_at DESC, id DESC)
-- is INTENTIONALLY OMITTED per Database Owner decision.
--
-- Fail-closed verification model
-- ------------------------------
-- Each approved index is guarded by a preflight DO block and a postflight
-- DO block. The preflight tolerates an absent index and refuses to proceed
-- when the same name exists with a differing definition, is invalid, or is
-- not ready. The postflight requires the index to exist with the exact
-- approved definition, indisvalid = true, and indisready = true.
--
-- DO blocks are anonymous — they contain no persistent function definitions.
-- No BEGIN/COMMIT is used; each CREATE INDEX CONCURRENTLY remains its own
-- implicit transaction. DO blocks run in their own implicit transactions and
-- do NOT wrap the CREATE INDEX CONCURRENTLY statements.

--------------------------------------------------------------------------------
-- 1. gatewayListCustomers → idx_gw_customers_merchant_created_id_desc
--------------------------------------------------------------------------------

-- Preflight: allow absent; require exact definition + valid + ready if present.
DO $preflight_customers$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_customers_merchant_created_id_desc ON public.gateway_customers USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_customers'
     AND indexname  = 'idx_gw_customers_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RETURN; -- absent is permitted; CREATE INDEX CONCURRENTLY will build it.
  END IF;

  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_customers_merchant_created_id_desc exists with a different definition. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_customers_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_customers_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_customers_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_customers_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$preflight_customers$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_customers_merchant_created_id_desc
  ON public.gateway_customers (merchant_id, created_at DESC, id DESC);

-- Postflight: require exact definition + valid + ready.
DO $postflight_customers$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_customers_merchant_created_id_desc ON public.gateway_customers USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_customers'
     AND indexname  = 'idx_gw_customers_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_customers_merchant_created_id_desc missing after CREATE';
  END IF;
  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_customers_merchant_created_id_desc definition mismatch. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_customers_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_customers_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_customers_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_customers_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$postflight_customers$;

--------------------------------------------------------------------------------
-- 2. gatewayListPaymentPlans → idx_gw_payment_plans_merchant_created_id_desc
--------------------------------------------------------------------------------

DO $preflight_payment_plans$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_payment_plans_merchant_created_id_desc ON public.gateway_payment_plans USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_payment_plans'
     AND indexname  = 'idx_gw_payment_plans_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RETURN;
  END IF;

  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_payment_plans_merchant_created_id_desc exists with a different definition. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_payment_plans_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_payment_plans_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_payment_plans_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_payment_plans_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$preflight_payment_plans$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_payment_plans_merchant_created_id_desc
  ON public.gateway_payment_plans (merchant_id, created_at DESC, id DESC);

DO $postflight_payment_plans$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_payment_plans_merchant_created_id_desc ON public.gateway_payment_plans USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_payment_plans'
     AND indexname  = 'idx_gw_payment_plans_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_payment_plans_merchant_created_id_desc missing after CREATE';
  END IF;
  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_payment_plans_merchant_created_id_desc definition mismatch. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_payment_plans_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_payment_plans_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_payment_plans_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_payment_plans_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$postflight_payment_plans$;

--------------------------------------------------------------------------------
-- 3. gatewayListSubscriptions → idx_gw_subscriptions_merchant_created_id_desc
--------------------------------------------------------------------------------

DO $preflight_subscriptions$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_subscriptions_merchant_created_id_desc ON public.gateway_subscriptions USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_subscriptions'
     AND indexname  = 'idx_gw_subscriptions_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RETURN;
  END IF;

  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_subscriptions_merchant_created_id_desc exists with a different definition. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_subscriptions_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B preflight: idx_gw_subscriptions_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_subscriptions_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B preflight: idx_gw_subscriptions_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$preflight_subscriptions$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_subscriptions_merchant_created_id_desc
  ON public.gateway_subscriptions (merchant_id, created_at DESC, id DESC);

DO $postflight_subscriptions$
DECLARE
  v_expected_def constant text :=
    'CREATE INDEX idx_gw_subscriptions_merchant_created_id_desc ON public.gateway_subscriptions USING btree (merchant_id, created_at DESC, id DESC)';
  v_actual_def   text;
  v_is_valid     boolean;
  v_is_ready     boolean;
BEGIN
  SELECT indexdef INTO v_actual_def
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'gateway_subscriptions'
     AND indexname  = 'idx_gw_subscriptions_merchant_created_id_desc';

  IF v_actual_def IS NULL THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_subscriptions_merchant_created_id_desc missing after CREATE';
  END IF;
  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(v_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_subscriptions_merchant_created_id_desc definition mismatch. actual=% expected=%',
      v_actual_def, v_expected_def;
  END IF;

  SELECT i.indisvalid, i.indisready
    INTO v_is_valid, v_is_ready
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_gw_subscriptions_merchant_created_id_desc';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'd.2B postflight: idx_gw_subscriptions_merchant_created_id_desc catalogue metadata missing';
  END IF;

  IF v_is_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_subscriptions_merchant_created_id_desc is not valid (indisvalid=false)';
  END IF;
  IF v_is_ready IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'd.2B postflight: idx_gw_subscriptions_merchant_created_id_desc is not ready (indisready=false)';
  END IF;
END
$postflight_subscriptions$;

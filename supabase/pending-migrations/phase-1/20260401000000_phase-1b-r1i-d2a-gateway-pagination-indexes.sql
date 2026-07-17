-- Phase 1B — R1I-d.2A-DB1 — Canonical (transactional) gateway pagination indexes.
--
-- Source of truth (Database Owner decision):
--   docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md §1
--
-- Path model (Phase 1B-R1I-d.2A-DB1):
--   Canonical transactional path: THIS FILE.
--     - Executes inside the Supabase migration runner's single transaction.
--     - MUST NOT use CREATE INDEX CONCURRENTLY (PostgreSQL forbids it in a
--       transaction; predecessor gate:
--       "PHASE 1B-R1I-d.2A BLOCKED — CONCURRENT INDEX MIGRATION RUNNER
--        INCOMPATIBLE").
--     - Uses ordinary transactional CREATE INDEX. Approved by the Database
--       Owner for the canonical path only, on the basis that pre-production
--       clean-reset environments have no live write contention on these tables.
--
--   Online production path: sibling artifact
--     supabase/pending-operations/phase-1/
--       20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql
--     which uses CREATE INDEX CONCURRENTLY under autocommit and is executed
--     BEFORE this migration is applied to a production database, so that this
--     migration then no-ops (indexes already exist with the exact approved
--     definition) — see §5 promotion sequence in
--     docs/audits/phase-1/phase-1b-r1i-d2a-dual-path-index-design.md.
--
-- Invariants (STANDING ORDERS 1–7):
--   * No table, column, view, function, trigger, RPC, or data mutation.
--   * Additive only; four indexes and nothing else.
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
CREATE OR REPLACE FUNCTION pg_temp.d2a_ensure_index(
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
      'd.2A index %.% missing after CREATE — expected: %',
      p_schema, p_index, p_expected_def;
  END IF;

  -- Deterministic normalisation before comparison: collapse whitespace.
  IF regexp_replace(v_actual_def, '\s+', ' ', 'g')
       <> regexp_replace(p_expected_def, '\s+', ' ', 'g') THEN
    RAISE EXCEPTION
      'd.2A index %.% definition mismatch. actual=% expected=%',
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
    RAISE EXCEPTION 'd.2A index %.% is not valid (indisvalid=false)',
      p_schema, p_index;
  END IF;

  IF NOT v_is_ready THEN
    RAISE EXCEPTION 'd.2A index %.% is not ready (indisready=false)',
      p_schema, p_index;
  END IF;
END
$fn$;

--------------------------------------------------------------------------------
-- Four Database-Owner-ratified d.2A composite indexes.
-- Definitions MUST match those in the online concurrent operation script
-- exactly (only the CONCURRENTLY keyword differs).
--------------------------------------------------------------------------------

-- 1. gatewayListSubaccounts
CREATE INDEX IF NOT EXISTS idx_gw_subaccounts_merchant_created_id_desc
  ON public.gateway_subaccounts (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2a_ensure_index(
  'public',
  'gateway_subaccounts',
  'idx_gw_subaccounts_merchant_created_id_desc',
  'CREATE INDEX idx_gw_subaccounts_merchant_created_id_desc ON public.gateway_subaccounts USING btree (merchant_id, created_at DESC, id DESC)'
);

-- 2. gatewayListBeneficiaries
CREATE INDEX IF NOT EXISTS idx_gw_beneficiaries_merchant_created_id_desc
  ON public.gateway_beneficiaries (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2a_ensure_index(
  'public',
  'gateway_beneficiaries',
  'idx_gw_beneficiaries_merchant_created_id_desc',
  'CREATE INDEX idx_gw_beneficiaries_merchant_created_id_desc ON public.gateway_beneficiaries USING btree (merchant_id, created_at DESC, id DESC)'
);

-- 3. gatewayListPaymentLinks
CREATE INDEX IF NOT EXISTS idx_gw_payment_links_merchant_created_id_desc
  ON public.gateway_payment_links (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2a_ensure_index(
  'public',
  'gateway_payment_links',
  'idx_gw_payment_links_merchant_created_id_desc',
  'CREATE INDEX idx_gw_payment_links_merchant_created_id_desc ON public.gateway_payment_links USING btree (merchant_id, created_at DESC, id DESC)'
);

-- 4. gatewayListVirtualAccounts
CREATE INDEX IF NOT EXISTS idx_gw_virtual_accounts_merchant_created_id_desc
  ON public.gateway_virtual_accounts (merchant_id, created_at DESC, id DESC);
SELECT pg_temp.d2a_ensure_index(
  'public',
  'gateway_virtual_accounts',
  'idx_gw_virtual_accounts_merchant_created_id_desc',
  'CREATE INDEX idx_gw_virtual_accounts_merchant_created_id_desc ON public.gateway_virtual_accounts USING btree (merchant_id, created_at DESC, id DESC)'
);

COMMIT;

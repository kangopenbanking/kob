-- Phase 1B — R1I-d.2A-DB1 — Online (CONCURRENTLY) gateway pagination indexes.
--
-- OPERATIONAL DEPLOYMENT ARTIFACT — NOT A SUPABASE MIGRATION FILE.
--
-- This script is executed OUTSIDE any transaction, against a direct PostgreSQL
-- session (autocommit, port 5432, NOT the transaction pooler on 6543) as an
-- online index build BEFORE the sibling canonical transactional migration
-- (`supabase/pending-migrations/phase-1/
--   20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql`)
-- is applied. The canonical migration then verifies and no-ops.
--
-- Source of truth: docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md §1
-- Design: docs/audits/phase-1/phase-1b-r1i-d2a-dual-path-index-design.md
--
-- Rules for this script:
--   * MUST run under autocommit; each CREATE INDEX CONCURRENTLY is its own tx.
--   * MUST NOT be wrapped in BEGIN/COMMIT.
--   * MUST NOT be executed against a transaction pooler connection.
--   * Additive only; four indexes and nothing else.
--   * Safe to rerun after a successful completion (IF NOT EXISTS).
--   * Post-build validity/readiness is asserted by the companion harness
--     scripts/slice-d2a-online-index-harness.mjs (§8 evidence).
--
-- Definitions are byte-identical (modulo the CONCURRENTLY keyword) to the
-- canonical migration.

-- 1. gatewayListSubaccounts
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_subaccounts_merchant_created_id_desc
  ON public.gateway_subaccounts (merchant_id, created_at DESC, id DESC);

-- 2. gatewayListBeneficiaries
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_beneficiaries_merchant_created_id_desc
  ON public.gateway_beneficiaries (merchant_id, created_at DESC, id DESC);

-- 3. gatewayListPaymentLinks
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_payment_links_merchant_created_id_desc
  ON public.gateway_payment_links (merchant_id, created_at DESC, id DESC);

-- 4. gatewayListVirtualAccounts
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_gw_virtual_accounts_merchant_created_id_desc
  ON public.gateway_virtual_accounts (merchant_id, created_at DESC, id DESC);

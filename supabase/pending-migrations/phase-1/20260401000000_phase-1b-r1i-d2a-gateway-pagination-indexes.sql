-- Phase 1B — R1I-d.2A — Gateway pagination composite indexes (four operations).
--
-- Source of truth: docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md
--
-- Additive-only. No table/column change. No trigger/view/RPC/function. No
-- destructive DDL. No financial-history update. Safe to rerun via IF NOT EXISTS.
-- Uses CONCURRENTLY to avoid write locks on production-shaped tables.
-- Each index matches the ratified keyset shape (scope, created_at DESC, id DESC)
-- so keyset queries `WHERE scope = ? ORDER BY created_at DESC, id DESC` can use
-- an index scan without an in-memory sort.

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

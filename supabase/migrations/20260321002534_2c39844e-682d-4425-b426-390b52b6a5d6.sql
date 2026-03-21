
-- Phase 2: Bank confirmation tracking, partner auto-onboarding fields, reconciliation automation

-- Add bank confirmation tracking columns to remittances
ALTER TABLE public.remittances
  ADD COLUMN IF NOT EXISTS bank_batch_item_id UUID,
  ADD COLUMN IF NOT EXISTS bank_confirm_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- Remittance reconciliation automation log
CREATE TABLE IF NOT EXISTS public.remittance_recon_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.remittance_partners(id),
  run_type TEXT NOT NULL DEFAULT 'automated', -- automated, manual
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_checked INT DEFAULT 0,
  matched INT DEFAULT 0,
  mismatched INT DEFAULT 0,
  stale_flagged INT DEFAULT 0,
  status TEXT DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_recon_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on remittance_recon_runs"
  ON public.remittance_recon_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add partner configuration fields
ALTER TABLE public.remittance_partners
  ADD COLUMN IF NOT EXISTS api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS api_environment TEXT DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS auto_settlement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS settlement_frequency TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS last_settlement_at TIMESTAMPTZ;

-- Add corridor fee tiers
ALTER TABLE public.remittance_corridors
  ADD COLUMN IF NOT EXISTS fee_tiers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS settlement_delay_hours INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS requires_kyc_level TEXT DEFAULT 'basic';

-- Add resolution tracking to reconciliation items
ALTER TABLE public.remittance_reconciliation_items
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

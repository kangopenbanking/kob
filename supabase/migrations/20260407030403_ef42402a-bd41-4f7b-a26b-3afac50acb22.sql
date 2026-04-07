-- Add auto-funding columns to piggybank_plans
ALTER TABLE public.piggybank_plans
  ADD COLUMN IF NOT EXISTS auto_fund_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_fund_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Index for cron job to find plans needing auto-funding
CREATE INDEX IF NOT EXISTS idx_piggybank_plans_auto_fund
  ON public.piggybank_plans (auto_fund_enabled, status)
  WHERE auto_fund_enabled = true AND status = 'active';

-- Phase 3: Treasury & Settlement Infrastructure

-- 1. Float ledger for audit trail of all float movements
CREATE TABLE public.treasury_float_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  float_id UUID NOT NULL REFERENCES public.treasury_float(id),
  rail_id UUID NOT NULL REFERENCES public.payout_rails(id),
  currency TEXT NOT NULL DEFAULT 'XAF',
  entry_type TEXT NOT NULL, -- 'replenish', 'disburse', 'reserve', 'release', 'adjustment'
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_type TEXT, -- 'payout', 'manual', 'auto_replenish', 'reconciliation'
  reference_id UUID,
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Settlement runs table for tracking automated settlement cycles
CREATE TABLE public.settlement_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'emergency'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'partial'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  payouts_processed INTEGER DEFAULT 0,
  payouts_settled INTEGER DEFAULT 0,
  payouts_failed INTEGER DEFAULT 0,
  total_settled_amount NUMERIC DEFAULT 0,
  total_fees_collected NUMERIC DEFAULT 0,
  float_adjustments JSONB DEFAULT '{}'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Float alerts for low-balance notifications
CREATE TABLE public.treasury_float_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  float_id UUID NOT NULL REFERENCES public.treasury_float(id),
  rail_id UUID NOT NULL REFERENCES public.payout_rails(id),
  alert_type TEXT NOT NULL, -- 'low_balance', 'depleted', 'replenished', 'threshold_breach'
  currency TEXT NOT NULL DEFAULT 'XAF',
  current_balance NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS
ALTER TABLE public.treasury_float_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_float_alerts ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage float ledger"
  ON public.treasury_float_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert float ledger"
  ON public.treasury_float_ledger FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can manage settlement runs"
  ON public.settlement_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage settlement runs"
  ON public.settlement_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view float alerts"
  ON public.treasury_float_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage float alerts"
  ON public.treasury_float_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. Indexes for performance
CREATE INDEX idx_float_ledger_float_id ON public.treasury_float_ledger(float_id);
CREATE INDEX idx_float_ledger_created_at ON public.treasury_float_ledger(created_at DESC);
CREATE INDEX idx_settlement_runs_status ON public.settlement_runs(status);
CREATE INDEX idx_settlement_runs_started ON public.settlement_runs(started_at DESC);
CREATE INDEX idx_float_alerts_unresolved ON public.treasury_float_alerts(is_resolved) WHERE is_resolved = false;

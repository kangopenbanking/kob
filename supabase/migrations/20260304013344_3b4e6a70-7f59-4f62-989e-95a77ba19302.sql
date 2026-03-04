
-- ═══════════════════════════════════════════════════════════
-- PHASE 5: Reconciliation Framework Tables
-- ═══════════════════════════════════════════════════════════

-- ─── Reconciliation Runs ───
CREATE TABLE public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('charges', 'payouts', 'refunds', 'settlements', 'full')),
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_platform_records INTEGER DEFAULT 0,
  total_provider_records INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  mismatched_count INTEGER DEFAULT 0,
  missing_on_platform INTEGER DEFAULT 0,
  missing_on_provider INTEGER DEFAULT 0,
  amount_discrepancy NUMERIC(20,2) DEFAULT 0,
  initiated_by UUID,
  summary JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_runs_status ON public.reconciliation_runs (status);
CREATE INDEX idx_recon_runs_type ON public.reconciliation_runs (run_type);
CREATE INDEX idx_recon_runs_created ON public.reconciliation_runs (created_at DESC);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reconciliation runs"
  ON public.reconciliation_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── Reconciliation Mismatches ───
CREATE TABLE public.reconciliation_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  mismatch_type TEXT NOT NULL CHECK (mismatch_type IN (
    'status_mismatch', 'amount_mismatch', 'missing_on_platform',
    'missing_on_provider', 'duplicate', 'currency_mismatch', 'other'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('charge', 'payout', 'refund', 'settlement')),
  entity_id UUID,
  provider_ref TEXT,
  platform_status TEXT,
  provider_status TEXT,
  platform_amount NUMERIC(20,2),
  provider_amount NUMERIC(20,2),
  platform_currency TEXT,
  provider_currency TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open', 'investigating', 'resolved', 'ignored', 'escalated')),
  resolution_action TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_mismatches_run ON public.reconciliation_mismatches (run_id);
CREATE INDEX idx_recon_mismatches_status ON public.reconciliation_mismatches (resolution_status);
CREATE INDEX idx_recon_mismatches_entity ON public.reconciliation_mismatches (entity_type, entity_id);

ALTER TABLE public.reconciliation_mismatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reconciliation mismatches"
  ON public.reconciliation_mismatches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

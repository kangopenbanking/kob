-- Wave 2: Account/balance polling + reconciliation auto-correction

-- 1. bank_sync_jobs: schedules per-config polling for accounts/balances/transactions
CREATE TABLE public.bank_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.bank_connector_configs(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  op_type TEXT NOT NULL CHECK (op_type IN ('accounts','balances','transactions','reconcile')),
  external_account_id TEXT,
  watermark TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  backoff_seconds INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_sync_jobs_due ON public.bank_sync_jobs(next_run_at) WHERE enabled = true;
CREATE INDEX idx_bank_sync_jobs_config ON public.bank_sync_jobs(config_id);

ALTER TABLE public.bank_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sync jobs" ON public.bank_sync_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_bank_sync_jobs_updated
  BEFORE UPDATE ON public.bank_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. reconciliation_reports: rule-based recon outcomes (additive, separate from existing bank_reconciliations)
CREATE TABLE public.reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.bank_connector_configs(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_compared INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  missing_in_kob INTEGER NOT NULL DEFAULT 0,
  missing_in_bank INTEGER NOT NULL DEFAULT 0,
  amount_mismatches INTEGER NOT NULL DEFAULT 0,
  auto_corrected INTEGER NOT NULL DEFAULT 0,
  flagged_for_review INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_reports_bank ON public.reconciliation_reports(bank_id, created_at DESC);

ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view recon reports" ON public.reconciliation_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins create recon reports" ON public.reconciliation_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
-- Wave 3: Additive ledger audit columns (nullable, defaulted)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_connector TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS connector_audit_trail JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_transactions_source_connector
  ON public.transactions(source_connector) WHERE source_connector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation_status
  ON public.transactions(reconciliation_status) WHERE reconciliation_status <> 'matched';

-- Wave 3: Bank onboarding wizard records
CREATE TABLE IF NOT EXISTS public.bank_onboarding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES public.banks(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'assessment'
    CHECK (stage IN ('assessment','adapter_selection','credentials','sandbox_test','certification','go_live','completed')),
  adapter_type TEXT CHECK (adapter_type IN ('rest','sql','file','soap')),
  assessment_data JSONB DEFAULT '{}'::jsonb,
  credentials_configured BOOLEAN DEFAULT false,
  sandbox_test_passed BOOLEAN DEFAULT false,
  sandbox_test_results JSONB DEFAULT '{}'::jsonb,
  certification_passed BOOLEAN DEFAULT false,
  certification_checklist JSONB DEFAULT '[]'::jsonb,
  go_live_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_onboarding_records_stage
  ON public.bank_onboarding_records(stage);
CREATE INDEX IF NOT EXISTS idx_bank_onboarding_records_bank
  ON public.bank_onboarding_records(bank_id);

ALTER TABLE public.bank_onboarding_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view onboarding records"
  ON public.bank_onboarding_records FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert onboarding records"
  ON public.bank_onboarding_records FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update onboarding records"
  ON public.bank_onboarding_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete onboarding records"
  ON public.bank_onboarding_records FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bank_onboarding_records_updated_at
  BEFORE UPDATE ON public.bank_onboarding_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
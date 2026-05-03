
CREATE TABLE IF NOT EXISTS public.pisp_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL REFERENCES public.payments(payment_id) ON DELETE CASCADE,
  consent_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  idempotency_key TEXT,
  instructed_amount JSONB NOT NULL,
  creditor_account JSONB NOT NULL,
  debtor_account JSONB,
  remittance_information JSONB,
  risk JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'AcceptedSettlementInProgress',
  status_update_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_execution_date DATE,
  expected_settlement_date DATE,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pisp_subs_payment_id ON public.pisp_payment_submissions(payment_id);
CREATE INDEX IF NOT EXISTS idx_pisp_subs_consent_id ON public.pisp_payment_submissions(consent_id);
CREATE INDEX IF NOT EXISTS idx_pisp_subs_user_id ON public.pisp_payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_pisp_subs_status ON public.pisp_payment_submissions(status);

ALTER TABLE public.pisp_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions"
  ON public.pisp_payment_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
  ON public.pisp_payment_submissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all submissions"
  ON public.pisp_payment_submissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pisp_subs_updated_at
  BEFORE UPDATE ON public.pisp_payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

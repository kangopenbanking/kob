CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_class TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  anonymize_after_days INTEGER,
  legal_basis TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read retention policies"
  ON public.data_retention_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write retention policies"
  ON public.data_retention_policies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.data_retention_policies (data_class, retention_days, anonymize_after_days, legal_basis, description) VALUES
  ('kyc_documents',      2555, 2190, 'COBAC + GDPR Art. 5(1)(e)', '7-year retention; anonymize PII after 6 years.'),
  ('transactions',       3650, NULL, 'COBAC AML horizon',          '10-year immutable retention for AML traceability.'),
  ('consent_events',     2555, NULL, 'PSD2 RTS Art. 36 + COBAC',   'Immutable consent ledger; 7-year retention.'),
  ('webhook_deliveries',  365,  180, 'GDPR Art. 5(1)(c)',          'Operational data; anonymize after 6 months.')
ON CONFLICT (data_class) DO NOTHING;
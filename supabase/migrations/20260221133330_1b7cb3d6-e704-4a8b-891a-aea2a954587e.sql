
-- Gateway Beneficiaries table for saved payout recipients
CREATE TABLE public.gateway_beneficiaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'mobile_money',
  account_number TEXT,
  bank_code TEXT,
  bank_name TEXT,
  phone TEXT,
  email TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own beneficiaries"
  ON public.gateway_beneficiaries FOR ALL
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

CREATE INDEX idx_gateway_beneficiaries_merchant ON public.gateway_beneficiaries(merchant_id);

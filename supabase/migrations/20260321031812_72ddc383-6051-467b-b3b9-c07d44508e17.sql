
-- Pay by Bank Intents table
CREATE TABLE public.pay_by_bank_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  consent_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  redirect_uri TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_auth' CHECK (status IN ('awaiting_auth', 'authorized', 'submitted', 'processing', 'completed', 'failed', 'expired', 'rejected')),
  merchant_name TEXT,
  merchant_logo_url TEXT,
  debtor_account TEXT,
  creditor_account TEXT,
  creditor_name TEXT,
  description TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  authorization_url TEXT,
  customer_email TEXT,
  customer_user_id UUID,
  metadata JSONB DEFAULT '{}',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only (edge function mediated)
ALTER TABLE public.pay_by_bank_intents ENABLE ROW LEVEL SECURITY;

-- Index for merchant lookups
CREATE INDEX idx_pay_by_bank_intents_merchant ON public.pay_by_bank_intents(merchant_id);
CREATE INDEX idx_pay_by_bank_intents_status ON public.pay_by_bank_intents(status);
CREATE INDEX idx_pay_by_bank_intents_consent ON public.pay_by_bank_intents(consent_id);

-- Auto-update updated_at
CREATE TRIGGER update_pay_by_bank_intents_updated_at
  BEFORE UPDATE ON public.pay_by_bank_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

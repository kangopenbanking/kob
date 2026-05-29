-- Phase 10.3 — Agent banking
-- Cites: BIS "Agent Banking" guidelines (2018), Mojaloop v1.1 PartyIdType=AGENT,
--        GSMA Agent Network Management Toolkit v2.

CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_code TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  legal_name TEXT,
  msisdn TEXT NOT NULL,
  email TEXT,
  user_id UUID,
  region TEXT,
  country_code TEXT NOT NULL DEFAULT 'CM' CHECK (country_code IN ('CM','GA','CG','TD','CF','GQ')),
  city TEXT,
  address TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','terminated')),
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','premium','master')),
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0100,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_agents_country ON public.agents(country_code);
CREATE INDEX idx_agents_geo ON public.agents(latitude, longitude);
CREATE INDEX idx_agents_user_id ON public.agents(user_id);

GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all agents"
  ON public.agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents view their own row"
  ON public.agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Active agents are discoverable by authenticated users"
  ON public.agents FOR SELECT TO authenticated
  USING (status = 'active');

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_floats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'XAF' CHECK (currency IN ('XAF','XOF','EUR','USD')),
  float_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  cash_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  low_threshold NUMERIC(18,2) NOT NULL DEFAULT 50000,
  last_topup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (agent_id, currency)
);

CREATE INDEX idx_agent_floats_agent_id ON public.agent_floats(agent_id);

GRANT SELECT ON public.agent_floats TO authenticated;
GRANT ALL ON public.agent_floats TO service_role;

ALTER TABLE public.agent_floats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all agent floats"
  ON public.agent_floats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents view their own float"
  ON public.agent_floats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_floats.agent_id AND a.user_id = auth.uid()));

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_cash_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  customer_msisdn TEXT,
  customer_user_id UUID,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('cash_in','cash_out','float_topup','float_withdraw','commission')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  commission_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','reversed')),
  idempotency_key UUID NOT NULL UNIQUE,
  reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_agent_cash_tx_agent_id ON public.agent_cash_transactions(agent_id);
CREATE INDEX idx_agent_cash_tx_customer ON public.agent_cash_transactions(customer_user_id);
CREATE INDEX idx_agent_cash_tx_created_at ON public.agent_cash_transactions(created_at DESC);
CREATE INDEX idx_agent_cash_tx_status ON public.agent_cash_transactions(status);

GRANT SELECT ON public.agent_cash_transactions TO authenticated;
GRANT ALL ON public.agent_cash_transactions TO service_role;

ALTER TABLE public.agent_cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all agent transactions"
  ON public.agent_cash_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents view their own transactions"
  ON public.agent_cash_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_cash_transactions.agent_id AND a.user_id = auth.uid()));

CREATE POLICY "Customers view their own agent transactions"
  ON public.agent_cash_transactions FOR SELECT TO authenticated
  USING (auth.uid() = customer_user_id);

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_kyc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('cni','passport','rccm','tax_id','address_proof','photo')),
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_kyc_agent_id ON public.agent_kyc_documents(agent_id);

GRANT SELECT, INSERT ON public.agent_kyc_documents TO authenticated;
GRANT ALL ON public.agent_kyc_documents TO service_role;

ALTER TABLE public.agent_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agent KYC docs"
  ON public.agent_kyc_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents view and upload their own KYC docs"
  ON public.agent_kyc_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_kyc_documents.agent_id AND a.user_id = auth.uid()));

CREATE POLICY "Agents insert their own KYC docs"
  ON public.agent_kyc_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_kyc_documents.agent_id AND a.user_id = auth.uid()));

-- ---------------------------------------------------------------------------

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_floats_updated_at
  BEFORE UPDATE ON public.agent_floats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
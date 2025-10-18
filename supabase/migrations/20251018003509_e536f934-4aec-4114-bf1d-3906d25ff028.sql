-- Phase 2: Consent & Access Control System
-- AISP and PISP consent management with fine-grained permissions

-- Consent status enum
CREATE TYPE consent_status AS ENUM (
  'AwaitingAuthorisation',
  'Authorised',
  'Rejected',
  'Revoked',
  'Expired',
  'Consumed'
);

-- Payment types enum
CREATE TYPE payment_type AS ENUM (
  'domestic',
  'international',
  'scheduled',
  'standing_order',
  'vrp'
);

-- 1. AISP Consents (Account Information Service Provider)
CREATE TABLE public.aisp_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.tpp_registrations(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Permissions (what the TPP can access)
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"]
  
  -- Account selection (which accounts to share)
  account_ids JSONB, -- Array of account IDs, null = all accounts
  
  -- Transaction date range (optional)
  transaction_from_date TIMESTAMP WITH TIME ZONE,
  transaction_to_date TIMESTAMP WITH TIME ZONE,
  
  -- Consent lifecycle
  status consent_status NOT NULL DEFAULT 'AwaitingAuthorisation',
  expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  authorization_url TEXT,
  authorization_code TEXT,
  authorized_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PISP Consents (Payment Initiation Service Provider)
CREATE TABLE public.pisp_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.tpp_registrations(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment details
  payment_type payment_type NOT NULL DEFAULT 'domestic',
  instructed_amount JSONB NOT NULL, -- { "amount": "100.00", "currency": "XAF" }
  
  -- Creditor (recipient) details
  creditor JSONB NOT NULL, -- { "name": "...", "account": { "scheme": "LOCAL_BANK", "value": "..." } }
  
  -- Debtor (payer) details (optional - user may select during authorization)
  debtor_account JSONB,
  
  -- Payment reference and description
  reference TEXT,
  remittance_information TEXT,
  
  -- Risk assessment
  risk JSONB, -- { "paymentContextCode": "...", "merchantCategoryCode": "..." }
  
  -- Consent lifecycle
  status consent_status NOT NULL DEFAULT 'AwaitingAuthorisation',
  
  -- Metadata
  authorization_url TEXT,
  authorization_code TEXT,
  authorized_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  
  -- Link to actual payment (after execution)
  payment_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Consent Events Log (audit trail)
CREATE TABLE public.consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id TEXT NOT NULL, -- References either aisp_consents or pisp_consents
  consent_type TEXT NOT NULL, -- 'aisp' or 'pisp'
  event_type TEXT NOT NULL, -- 'created', 'authorized', 'revoked', 'expired', 'accessed'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.aisp_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pisp_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aisp_consents
CREATE POLICY "Users can view own AISP consents"
  ON public.aisp_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AISP consents"
  ON public.aisp_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AISP consents"
  ON public.aisp_consents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all AISP consents"
  ON public.aisp_consents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all AISP consents"
  ON public.aisp_consents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pisp_consents
CREATE POLICY "Users can view own PISP consents"
  ON public.pisp_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own PISP consents"
  ON public.pisp_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PISP consents"
  ON public.pisp_consents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all PISP consents"
  ON public.pisp_consents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all PISP consents"
  ON public.pisp_consents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for consent_events (read-only for users)
CREATE POLICY "Users can view own consent events"
  ON public.consent_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consent events"
  ON public.consent_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_aisp_consents_user_id ON public.aisp_consents(user_id);
CREATE INDEX idx_aisp_consents_client_id ON public.aisp_consents(client_id);
CREATE INDEX idx_aisp_consents_consent_id ON public.aisp_consents(consent_id);
CREATE INDEX idx_aisp_consents_status ON public.aisp_consents(status);
CREATE INDEX idx_aisp_consents_expiration ON public.aisp_consents(expiration_date);

CREATE INDEX idx_pisp_consents_user_id ON public.pisp_consents(user_id);
CREATE INDEX idx_pisp_consents_client_id ON public.pisp_consents(client_id);
CREATE INDEX idx_pisp_consents_consent_id ON public.pisp_consents(consent_id);
CREATE INDEX idx_pisp_consents_status ON public.pisp_consents(status);
CREATE INDEX idx_pisp_consents_expires_at ON public.pisp_consents(expires_at);

CREATE INDEX idx_consent_events_consent_id ON public.consent_events(consent_id);
CREATE INDEX idx_consent_events_user_id ON public.consent_events(user_id);
CREATE INDEX idx_consent_events_created_at ON public.consent_events(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_aisp_consents_updated_at
  BEFORE UPDATE ON public.aisp_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pisp_consents_updated_at
  BEFORE UPDATE ON public.pisp_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if a consent is valid and not expired
CREATE OR REPLACE FUNCTION public.is_consent_valid(
  _consent_id TEXT,
  _consent_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status consent_status;
  v_expiration TIMESTAMP WITH TIME ZONE;
BEGIN
  IF _consent_type = 'aisp' THEN
    SELECT status, expiration_date INTO v_status, v_expiration
    FROM public.aisp_consents
    WHERE consent_id = _consent_id;
  ELSIF _consent_type = 'pisp' THEN
    SELECT status, expires_at INTO v_status, v_expiration
    FROM public.pisp_consents
    WHERE consent_id = _consent_id;
  ELSE
    RETURN FALSE;
  END IF;
  
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if authorized and not expired
  RETURN v_status = 'Authorised' AND v_expiration > NOW();
END;
$$;

-- Function to automatically expire old consents (cron job can call this)
CREATE OR REPLACE FUNCTION public.expire_old_consents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire AISP consents
  UPDATE public.aisp_consents
  SET status = 'Expired'
  WHERE status = 'Authorised'
    AND expiration_date < NOW();
  
  -- Expire PISP consents
  UPDATE public.pisp_consents
  SET status = 'Expired'
  WHERE status = 'Authorised'
    AND expires_at < NOW();
END;
$$;

-- Function to log consent events
CREATE OR REPLACE FUNCTION public.log_consent_event(
  _consent_id TEXT,
  _consent_type TEXT,
  _event_type TEXT,
  _user_id UUID DEFAULT NULL,
  _client_id TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.consent_events (
    consent_id,
    consent_type,
    event_type,
    user_id,
    client_id,
    metadata
  ) VALUES (
    _consent_id,
    _consent_type,
    _event_type,
    _user_id,
    _client_id,
    _metadata
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Update authorization_codes table to link to consent_id
ALTER TABLE public.authorization_codes
ADD COLUMN consent_type TEXT CHECK (consent_type IN ('aisp', 'pisp'));
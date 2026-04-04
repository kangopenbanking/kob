
-- banking_customers: Bank-managed customer profiles
CREATE TABLE public.banking_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  external_customer_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, external_customer_id)
);

ALTER TABLE public.banking_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution owners can manage their banking customers"
  ON public.banking_customers FOR ALL
  USING (public.is_institution_owner(auth.uid(), institution_id))
  WITH CHECK (public.is_institution_owner(auth.uid(), institution_id));

CREATE POLICY "Institution staff can view banking customers"
  ON public.banking_customers FOR SELECT
  USING (public.is_institution_staff_admin(auth.uid(), institution_id));

CREATE INDEX idx_banking_customers_institution ON public.banking_customers(institution_id);
CREATE INDEX idx_banking_customers_external ON public.banking_customers(institution_id, external_customer_id);

CREATE TRIGGER update_banking_customers_updated_at
  BEFORE UPDATE ON public.banking_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_business_kyc_updated_at();

-- banking_api_logs: API request/response audit trail
CREATE TABLE public.banking_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  response_body JSONB,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banking_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution owners can view their API logs"
  ON public.banking_api_logs FOR SELECT
  USING (public.is_institution_owner(auth.uid(), institution_id));

CREATE POLICY "Admins can view all API logs"
  ON public.banking_api_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_banking_api_logs_institution ON public.banking_api_logs(institution_id, created_at DESC);
CREATE INDEX idx_banking_api_logs_client ON public.banking_api_logs(client_id, created_at DESC);

-- widget_sessions: Ephemeral widget token sessions
CREATE TABLE public.widget_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  widget_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.widget_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies - service role only access for widget sessions

CREATE INDEX idx_widget_sessions_token ON public.widget_sessions(session_token);
CREATE INDEX idx_widget_sessions_expires ON public.widget_sessions(expires_at);

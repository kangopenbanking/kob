-- Phase 7: Developer Portal & Testing Tools Schema

-- Table for API test requests made by developers
CREATE TABLE IF NOT EXISTS public.api_test_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_headers JSONB,
  response_body JSONB,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for sandbox test data templates
CREATE TABLE IF NOT EXISTS public.sandbox_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'account', 'transaction', 'payment', etc.
  template_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for developer-generated sandbox data
CREATE TABLE IF NOT EXISTS public.sandbox_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'account', 'transaction', 'payment', etc.
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.api_test_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_test_requests
CREATE POLICY "Institutions can view own test requests"
  ON public.api_test_requests FOR SELECT
  USING (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Institutions can create own test requests"
  ON public.api_test_requests FOR INSERT
  WITH CHECK (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all test requests"
  ON public.api_test_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sandbox_templates
CREATE POLICY "Anyone can view active templates"
  ON public.sandbox_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON public.sandbox_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sandbox_data
CREATE POLICY "Users can view own sandbox data"
  ON public.sandbox_data FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own sandbox data"
  ON public.sandbox_data FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own sandbox data"
  ON public.sandbox_data FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all sandbox data"
  ON public.sandbox_data FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_api_test_requests_institution ON public.api_test_requests(institution_id);
CREATE INDEX idx_api_test_requests_created ON public.api_test_requests(created_at DESC);
CREATE INDEX idx_sandbox_data_user ON public.sandbox_data(user_id);
CREATE INDEX idx_sandbox_data_type ON public.sandbox_data(data_type);

-- Trigger for updated_at
CREATE TRIGGER update_sandbox_templates_updated_at
  BEFORE UPDATE ON public.sandbox_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
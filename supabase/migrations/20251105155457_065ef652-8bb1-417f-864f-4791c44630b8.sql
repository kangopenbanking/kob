-- Create enterprise_leads table for enhanced contact form
CREATE TABLE IF NOT EXISTS public.enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Contact Information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_size TEXT NOT NULL,
  phone TEXT,
  
  -- Lead Details
  inquiry_type TEXT NOT NULL,
  integration_timeline TEXT NOT NULL,
  transaction_volume TEXT NOT NULL,
  use_cases TEXT[] NOT NULL,
  current_systems TEXT,
  requirements TEXT NOT NULL,
  preferred_contact TEXT NOT NULL,
  budget_range TEXT,
  
  -- Lead Management
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  
  -- Metadata
  ip_address_hash TEXT,
  user_agent TEXT,
  source_page TEXT
);

-- Enable RLS
ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

-- Admins can view all leads
CREATE POLICY "Admins can view all enterprise leads"
  ON public.enterprise_leads
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update leads
CREATE POLICY "Admins can update enterprise leads"
  ON public.enterprise_leads
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can insert leads (for contact form submission)
CREATE POLICY "Anyone can submit enterprise leads"
  ON public.enterprise_leads
  FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_enterprise_leads_status ON public.enterprise_leads(status);
CREATE INDEX idx_enterprise_leads_priority ON public.enterprise_leads(priority);
CREATE INDEX idx_enterprise_leads_created_at ON public.enterprise_leads(created_at DESC);
CREATE INDEX idx_enterprise_leads_assigned_to ON public.enterprise_leads(assigned_to);

-- Trigger for updated_at
CREATE TRIGGER update_enterprise_leads_updated_at
  BEFORE UPDATE ON public.enterprise_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create API demo logs table for tracking usage
CREATE TABLE IF NOT EXISTS public.api_demo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  platform TEXT NOT NULL,
  ip_address_hash TEXT,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.api_demo_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view api demo logs"
  ON public.api_demo_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can insert logs (for tracking demo usage)
CREATE POLICY "Anyone can log api demo usage"
  ON public.api_demo_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for analytics
CREATE INDEX idx_api_demo_logs_created_at ON public.api_demo_logs(created_at DESC);
CREATE INDEX idx_api_demo_logs_platform ON public.api_demo_logs(platform);
CREATE INDEX idx_api_demo_logs_endpoint ON public.api_demo_logs(endpoint);
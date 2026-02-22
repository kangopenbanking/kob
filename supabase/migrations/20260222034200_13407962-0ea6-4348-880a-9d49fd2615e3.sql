
-- Table for credit API access requests from institutions
CREATE TABLE public.credit_api_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id),
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_api_access_requests ENABLE ROW LEVEL SECURITY;

-- Institutions can view their own requests
CREATE POLICY "Institutions can view own requests"
ON public.credit_api_access_requests FOR SELECT
USING (requested_by = auth.uid());

-- Institutions can insert their own requests
CREATE POLICY "Institutions can create requests"
ON public.credit_api_access_requests FOR INSERT
WITH CHECK (requested_by = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.credit_api_access_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update requests
CREATE POLICY "Admins can update requests"
ON public.credit_api_access_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_credit_api_access_requests_updated_at
BEFORE UPDATE ON public.credit_api_access_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

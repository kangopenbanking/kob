
CREATE TABLE IF NOT EXISTS public.nium_webhook_secret_reveals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revealed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('reveal','rotate')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nium_webhook_secret_reveals TO authenticated;
GRANT ALL ON public.nium_webhook_secret_reveals TO service_role;

ALTER TABLE public.nium_webhook_secret_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reveal log"
  ON public.nium_webhook_secret_reveals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

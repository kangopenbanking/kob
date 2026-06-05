CREATE TABLE IF NOT EXISTS public.nium_name_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_full_name text NOT NULL,
  requested_full_name text NOT NULL,
  reason text NOT NULL,
  document_type text NOT NULL,
  document_number text,
  document_front_url text NOT NULL,
  document_back_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  decision_note text,
  kyc_verification_id uuid REFERENCES public.kyc_verifications(id) ON DELETE SET NULL,
  affected_account_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nium_name_correction_user
  ON public.nium_name_correction_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_nium_name_correction_status
  ON public.nium_name_correction_requests(status);

-- Only one open request per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nium_name_correction_open
  ON public.nium_name_correction_requests(user_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT ON public.nium_name_correction_requests TO authenticated;
GRANT ALL ON public.nium_name_correction_requests TO service_role;

ALTER TABLE public.nium_name_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own name correction requests"
  ON public.nium_name_correction_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own name correction requests"
  ON public.nium_name_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update name correction requests"
  ON public.nium_name_correction_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_nium_name_correction_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nium_name_correction_set_updated_at
  ON public.nium_name_correction_requests;
CREATE TRIGGER nium_name_correction_set_updated_at
  BEFORE UPDATE ON public.nium_name_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_nium_name_correction_updated_at();

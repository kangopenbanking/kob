
CREATE TABLE IF NOT EXISTS public.card_issuance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  form_factor TEXT NOT NULL CHECK (form_factor IN ('virtual','digital','physical')),
  currency TEXT NOT NULL DEFAULT 'XAF',
  reason TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  fulfilled_card_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_issuance_requests_user_idx ON public.card_issuance_requests(user_id, status);
CREATE INDEX IF NOT EXISTS card_issuance_requests_status_idx ON public.card_issuance_requests(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.card_issuance_requests TO authenticated;
GRANT ALL ON public.card_issuance_requests TO service_role;

ALTER TABLE public.card_issuance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own card issuance requests"
  ON public.card_issuance_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create own card issuance requests"
  ON public.card_issuance_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users cancel own pending requests"
  ON public.card_issuance_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE POLICY "admins manage all card issuance requests"
  ON public.card_issuance_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER card_issuance_requests_updated_at
  BEFORE UPDATE ON public.card_issuance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

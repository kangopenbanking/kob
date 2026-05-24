CREATE TABLE IF NOT EXISTS public.balance_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'XAF',
  home_total numeric NOT NULL DEFAULT 0,
  transfer_total numeric NOT NULL DEFAULT 0,
  activity_derived numeric NOT NULL DEFAULT 0,
  delta_home_vs_transfer numeric NOT NULL DEFAULT 0,
  delta_home_vs_activity numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_reconciliation_events ENABLE ROW LEVEL SECURITY;

-- Default user_id from the authenticated session on insert so the client never
-- needs to send it and can never spoof another user's id.
CREATE OR REPLACE FUNCTION public.set_reconciliation_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reconciliation_user_id ON public.balance_reconciliation_events;
CREATE TRIGGER trg_set_reconciliation_user_id
  BEFORE INSERT ON public.balance_reconciliation_events
  FOR EACH ROW EXECUTE FUNCTION public.set_reconciliation_user_id();

-- Users insert their own drift events; admins read all; users read their own.
CREATE POLICY "users insert own reconciliation events"
  ON public.balance_reconciliation_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "users read own reconciliation events"
  ON public.balance_reconciliation_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_balance_recon_user_created
  ON public.balance_reconciliation_events (user_id, created_at DESC);
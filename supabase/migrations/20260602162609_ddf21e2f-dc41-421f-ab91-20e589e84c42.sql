-- Dedicated table for driver emergency SOS events. Replaces best-effort writes
-- into daily_needs_issue_reports so safety ops can page on real signals.
CREATE TABLE public.driver_sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID,
  user_id UUID NOT NULL,
  assignment_id UUID,
  order_id UUID,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','false_alarm')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_sos_events_status ON public.driver_sos_events(status, created_at DESC);
CREATE INDEX idx_driver_sos_events_user ON public.driver_sos_events(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.driver_sos_events TO authenticated;
GRANT ALL ON public.driver_sos_events TO service_role;

ALTER TABLE public.driver_sos_events ENABLE ROW LEVEL SECURITY;

-- Drivers can file their own SOS events and view their own history.
CREATE POLICY "Drivers insert own SOS"
  ON public.driver_sos_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Drivers view own SOS"
  ON public.driver_sos_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view + update all SOS events for the paging workflow.
CREATE POLICY "Admins view all SOS"
  ON public.driver_sos_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update SOS"
  ON public.driver_sos_events
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_driver_sos_events_updated
  BEFORE UPDATE ON public.driver_sos_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime so the admin paging dashboard reacts instantly to new SOS rows.
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_sos_events;
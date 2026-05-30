-- ============================================================
-- security_capture_events — append-only log of screenshot &
-- visibility events from Consumer + Banking PWAs / native shells.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_capture_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NULL,
  app_context  TEXT NOT NULL CHECK (app_context IN ('consumer', 'banking')),
  kind         TEXT NOT NULL,
  pathname     TEXT NOT NULL,
  trace_id     UUID NULL,
  user_agent   TEXT NULL,
  ip_hash      TEXT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sce_user_created
  ON public.security_capture_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sce_kind_created
  ON public.security_capture_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sce_app_created
  ON public.security_capture_events (app_context, created_at DESC);

GRANT SELECT, INSERT ON public.security_capture_events TO authenticated;
GRANT ALL ON public.security_capture_events TO service_role;

ALTER TABLE public.security_capture_events ENABLE ROW LEVEL SECURITY;

-- Users may insert events tagged with their own id (or with NULL when
-- the listener fires before auth resolution); they cannot insert events
-- attributed to a different user.
CREATE POLICY "Users insert own capture events"
  ON public.security_capture_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Users may read only their own events (so the consumer can render an
-- in-app security log if needed in the future).
CREATE POLICY "Users read own capture events"
  ON public.security_capture_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins may read every event.
CREATE POLICY "Admins read all capture events"
  ON public.security_capture_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

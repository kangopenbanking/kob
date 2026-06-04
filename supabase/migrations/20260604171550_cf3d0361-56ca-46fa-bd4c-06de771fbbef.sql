CREATE TABLE public.screenshot_guard_consents (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('enabled','disabled')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pathname TEXT,
  last_app_context TEXT CHECK (last_app_context IN ('consumer','banking')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.screenshot_guard_consents TO authenticated;
GRANT ALL ON public.screenshot_guard_consents TO service_role;

ALTER TABLE public.screenshot_guard_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guard consent"
  ON public.screenshot_guard_consents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all guard consents"
  ON public.screenshot_guard_consents
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_screenshot_guard_consents_updated_at
  BEFORE UPDATE ON public.screenshot_guard_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
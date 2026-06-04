-- ScreenshotGuard runtime settings (opacity per theme) + render audit log support
CREATE TABLE IF NOT EXISTS public.screenshot_guard_settings (
  id text PRIMARY KEY DEFAULT 'global',
  light_opacity numeric NOT NULL DEFAULT 0.05 CHECK (light_opacity >= 0 AND light_opacity <= 1),
  dark_opacity  numeric NOT NULL DEFAULT 0.03 CHECK (dark_opacity  >= 0 AND dark_opacity  <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT screenshot_guard_settings_singleton CHECK (id = 'global')
);

GRANT SELECT ON public.screenshot_guard_settings TO anon, authenticated;
GRANT ALL    ON public.screenshot_guard_settings TO service_role;

ALTER TABLE public.screenshot_guard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read screenshot guard settings"
  ON public.screenshot_guard_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage screenshot guard settings"
  ON public.screenshot_guard_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.screenshot_guard_settings (id, light_opacity, dark_opacity)
VALUES ('global', 0.05, 0.03)
ON CONFLICT (id) DO NOTHING;

-- Allow new event kinds for ScreenshotGuard render audit (no enum constraint exists, but document)
COMMENT ON COLUMN public.security_capture_events.kind IS
  'Capture-event kind. Includes key:*, contextmenu, copy, visibility:hidden, blur, native:*, and guard:render (emitted once per protected route mount).';

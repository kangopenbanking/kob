
CREATE TABLE IF NOT EXISTS public.otp_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('development','preview','production')),
  role_scope text NOT NULL DEFAULT 'all' CHECK (role_scope IN ('all','admin','user')),
  firebase_enabled boolean NOT NULL DEFAULT true,
  sms_fallback_enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, role_scope)
);

ALTER TABLE public.otp_provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_provider_settings_public_read" ON public.otp_provider_settings;
CREATE POLICY "otp_provider_settings_public_read"
  ON public.otp_provider_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "otp_provider_settings_admin_write" ON public.otp_provider_settings;
CREATE POLICY "otp_provider_settings_admin_write"
  ON public.otp_provider_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public._otp_provider_settings_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS otp_provider_settings_touch ON public.otp_provider_settings;
CREATE TRIGGER otp_provider_settings_touch
  BEFORE UPDATE ON public.otp_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public._otp_provider_settings_touch();

INSERT INTO public.otp_provider_settings (environment, role_scope, firebase_enabled, sms_fallback_enabled, notes)
VALUES
  ('development','all', true, true, 'Default dev settings'),
  ('preview','all', true, true, 'Default preview settings'),
  ('production','all', true, true, 'Default production settings')
ON CONFLICT (environment, role_scope) DO NOTHING;

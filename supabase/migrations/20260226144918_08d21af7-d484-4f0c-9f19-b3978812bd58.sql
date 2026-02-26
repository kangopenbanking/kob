
-- Auth page branding config table (admin-managed)
CREATE TABLE public.auth_page_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL DEFAULT '',
  config_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image_url', 'color'
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.auth_page_config ENABLE ROW LEVEL SECURITY;

-- Public read (auth page is public)
CREATE POLICY "Anyone can read auth page config"
  ON public.auth_page_config FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update auth page config"
  ON public.auth_page_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert auth page config"
  ON public.auth_page_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete auth page config"
  ON public.auth_page_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default config
INSERT INTO public.auth_page_config (config_key, config_value, config_type, description) VALUES
  ('hero_title', 'Welcome to KOB', 'text', 'Main title on the auth page right panel'),
  ('hero_subtitle', 'Secure Open Banking Platform', 'text', 'Subtitle on the auth page right panel'),
  ('hero_image_url', '', 'image_url', 'Hero background image URL for the auth page'),
  ('login_title', 'Welcome Back', 'text', 'Title shown on login form'),
  ('login_subtitle', 'Sign in to your account using your phone number', 'text', 'Subtitle shown on login form'),
  ('signup_title', 'Create Account', 'text', 'Title shown on signup form'),
  ('signup_subtitle', 'Sign up with phone only - add email later from Profile Settings', 'text', 'Subtitle shown on signup form'),
  ('logo_url', '/kob-logo.png', 'image_url', 'Logo shown on the auth form');

-- Storage bucket for auth page images
INSERT INTO storage.buckets (id, name, public) VALUES ('auth-branding', 'auth-branding', true);

-- Storage policies
CREATE POLICY "Anyone can view auth branding images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'auth-branding');

CREATE POLICY "Admins can upload auth branding images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'auth-branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update auth branding images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'auth-branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete auth branding images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'auth-branding' AND public.has_role(auth.uid(), 'admin'));

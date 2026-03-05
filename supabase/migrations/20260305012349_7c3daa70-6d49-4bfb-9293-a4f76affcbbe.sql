
-- Table to store admin-managed supported countries for consumer and banking apps
CREATE TABLE public.supported_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  country text NOT NULL,
  flag text NOT NULL,
  dial_code text NOT NULL,
  enabled_consumer_app boolean NOT NULL DEFAULT true,
  enabled_banking_app boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dial_code, country)
);

ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read supported countries"
  ON public.supported_countries FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage supported countries"
  ON public.supported_countries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.supported_countries (code, country, flag, dial_code, enabled_consumer_app, enabled_banking_app, sort_order) VALUES
  ('CM', 'Cameroon', '🇨🇲', '+237', true, true, 1),
  ('US', 'USA', '🇺🇸', '+1', true, true, 2),
  ('CA', 'Canada', '🇨🇦', '+1', true, true, 3),
  ('FR', 'France', '🇫🇷', '+33', true, true, 4),
  ('NG', 'Nigeria', '🇳🇬', '+234', true, true, 5),
  ('GB', 'UK', '🇬🇧', '+44', true, true, 6),
  ('DE', 'Germany', '🇩🇪', '+49', true, true, 7),
  ('CN', 'China', '🇨🇳', '+86', true, true, 8),
  ('IN', 'India', '🇮🇳', '+91', true, true, 9),
  ('TR', 'Turkey', '🇹🇷', '+90', true, true, 10),
  ('GH', 'Ghana', '🇬🇭', '+233', true, true, 11),
  ('RW', 'Rwanda', '🇷🇼', '+250', true, true, 12),
  ('ZA', 'South Africa', '🇿🇦', '+27', true, true, 13),
  ('ML', 'Mali', '🇲🇱', '+223', true, true, 14),
  ('BF', 'Burkina Faso', '🇧🇫', '+226', true, true, 15),
  ('KE', 'Kenya', '🇰🇪', '+254', true, true, 16),
  ('AE', 'UAE', '🇦🇪', '+971', true, true, 17);

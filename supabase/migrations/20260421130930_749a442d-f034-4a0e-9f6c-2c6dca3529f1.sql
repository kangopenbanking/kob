-- i18n missing-key telemetry
CREATE TABLE IF NOT EXISTS public.i18n_missing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  string_key text NOT NULL,
  language text NOT NULL,
  route text,
  component text,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  CONSTRAINT i18n_missing_keys_unique UNIQUE (string_key, language, route)
);

CREATE INDEX IF NOT EXISTS idx_i18n_missing_keys_unresolved
  ON public.i18n_missing_keys (last_seen_at DESC)
  WHERE resolved = false;

ALTER TABLE public.i18n_missing_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert missing key reports"
  ON public.i18n_missing_keys
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read missing key reports"
  ON public.i18n_missing_keys
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update missing key reports"
  ON public.i18n_missing_keys
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RPC for upsert-with-increment (avoids client-side race)
CREATE OR REPLACE FUNCTION public.report_missing_i18n_key(
  p_key text, p_language text, p_route text DEFAULT NULL, p_component text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.i18n_missing_keys (string_key, language, route, component)
  VALUES (p_key, p_language, COALESCE(p_route, ''), p_component)
  ON CONFLICT (string_key, language, route) DO UPDATE
    SET occurrence_count = i18n_missing_keys.occurrence_count + 1,
        last_seen_at = now(),
        component = COALESCE(EXCLUDED.component, i18n_missing_keys.component);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_missing_i18n_key(text, text, text, text) TO anon, authenticated;
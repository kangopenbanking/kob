
-- Translation strings table
CREATE TABLE public.translation_strings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  string_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  default_value TEXT NOT NULL,
  description TEXT,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Translated values per language
CREATE TABLE public.translation_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  string_id UUID REFERENCES public.translation_strings(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL,
  value TEXT NOT NULL,
  is_auto_translated BOOLEAN DEFAULT false,
  translated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  translated_by UUID,
  UNIQUE(string_id, language)
);

-- Enable RLS
ALTER TABLE public.translation_strings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_values ENABLE ROW LEVEL SECURITY;

-- Public read for all users (translations need to be accessible)
CREATE POLICY "Anyone can read translation strings" ON public.translation_strings FOR SELECT USING (true);
CREATE POLICY "Anyone can read translation values" ON public.translation_values FOR SELECT USING (true);

-- Admin-only write via has_role function
CREATE POLICY "Admins can manage translation strings" ON public.translation_strings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage translation values" ON public.translation_values FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_translation_string_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_translation_strings_updated_at
  BEFORE UPDATE ON public.translation_strings
  FOR EACH ROW EXECUTE FUNCTION public.update_translation_string_timestamp();

ALTER TABLE public.translation_strings REPLICA IDENTITY FULL;
ALTER TABLE public.translation_values REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='translation_strings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.translation_strings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='translation_values') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.translation_values;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_translation_values_language ON public.translation_values(language);
CREATE INDEX IF NOT EXISTS idx_translation_values_string_lang ON public.translation_values(string_id, language);
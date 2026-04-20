INSERT INTO public.translation_values (string_id, language, value, is_auto_translated, translated_at)
SELECT ts.id, 'en', ts.default_value, false, now()
FROM public.translation_strings ts
WHERE NOT EXISTS (
  SELECT 1 FROM public.translation_values tv
  WHERE tv.string_id = ts.id AND tv.language = 'en'
)
ON CONFLICT (string_id, language) DO NOTHING;
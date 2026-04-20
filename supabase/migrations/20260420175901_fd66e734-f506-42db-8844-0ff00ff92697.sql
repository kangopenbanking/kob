-- Strip remaining emoji glyphs across all manual sections + glossary
-- Standing Order: API contract NOT modified; content-only cleanup.
-- Targets: Misc Symbols & Pictographs, Emoticons, Transport, Supplemental Symbols,
--          Dingbats, Misc Symbols, Variation Selectors, ZWJ, Regional Indicators.
UPDATE public.product_manuals
SET
  section_title = regexp_replace(section_title,
    '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]',
    '', 'g'),
  content = regexp_replace(content,
    '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]',
    '', 'g'),
  updated_at = now()
WHERE is_active = true
  AND (section_title ~ '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]'
    OR content       ~ '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]');

UPDATE public.product_glossary
SET
  term = regexp_replace(term,
    '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]',
    '', 'g'),
  definition = regexp_replace(definition,
    '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]',
    '', 'g')
WHERE term ~ '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]'
   OR definition ~ '[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D]|[\U0001F000-\U0001FFFF]';

-- Tidy any leftover orphan "- " bullets and double spaces created by removals
UPDATE public.product_manuals
SET content = regexp_replace(regexp_replace(content, '[ \t]{2,}', ' ', 'g'), E'\\n{3,}', E'\\n\\n', 'g'),
    updated_at = now()
WHERE is_active = true
  AND (content ~ '  ' OR content ~ E'\\n\\n\\n');

CREATE OR REPLACE FUNCTION public.lookup_recipient(_query TEXT)
RETURNS TABLE(
  user_id UUID,
  kang_id TEXT,
  full_name TEXT,
  phone_masked TEXT,
  match_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := COALESCE(trim(_query), '');
  v_digits TEXT;
  v_kang TEXT;
BEGIN
  IF length(v_q) < 3 THEN
    RETURN;
  END IF;

  v_digits := regexp_replace(v_q, '\D', '', 'g');
  v_kang   := upper(v_q);

  IF v_kang LIKE 'KANG-%' THEN
    NULL;
  ELSIF v_kang LIKE 'KANG%' THEN
    v_kang := 'KANG-' || substr(v_kang, 5);
  ELSIF v_q ~ '^[0-9]{6,12}$' THEN
    -- Bare digits: try as KANG-<digits>
    v_kang := 'KANG-' || v_digits;
  ELSE
    v_kang := NULL;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.kang_id,
    COALESCE(p.full_name, '')::text AS full_name,
    CASE
      WHEN p.phone_number IS NOT NULL AND length(p.phone_number) >= 4
        THEN repeat('•', GREATEST(length(p.phone_number) - 4, 0)) || right(p.phone_number, 4)
      ELSE ''
    END AS phone_masked,
    CASE
      WHEN v_kang IS NOT NULL AND p.kang_id = v_kang THEN 'kang_id'
      WHEN length(v_digits) >= 6
           AND p.phone_number IS NOT NULL
           AND regexp_replace(p.phone_number, '\D', '', 'g') ILIKE '%' || v_digits || '%'
        THEN 'phone'
      ELSE 'name'
    END AS match_type
  FROM public.profiles p
  WHERE
    (p.account_status IS NULL OR p.account_status <> 'suspended')
  AND (
    (v_kang IS NOT NULL AND p.kang_id = v_kang)
    OR (length(v_digits) >= 6 AND p.phone_number IS NOT NULL
        AND regexp_replace(p.phone_number, '\D', '', 'g') ILIKE '%' || v_digits || '%')
    OR (p.full_name ILIKE '%' || v_q || '%')
  )
  ORDER BY
    CASE
      WHEN v_kang IS NOT NULL AND p.kang_id = v_kang THEN 0
      WHEN length(v_digits) >= 6
           AND p.phone_number IS NOT NULL
           AND regexp_replace(p.phone_number, '\D', '', 'g') ILIKE '%' || v_digits || '%' THEN 1
      ELSE 2
    END,
    p.full_name NULLS LAST
  LIMIT 25;
END;
$$;

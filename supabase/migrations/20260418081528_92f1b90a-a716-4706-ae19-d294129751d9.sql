CREATE OR REPLACE FUNCTION public.search_profiles_by_name(_query text, _limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, full_name text, phone_masked text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_q text;
  v_digits text;
BEGIN
  v_q := COALESCE(trim(_query), '');
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;
  v_digits := regexp_replace(v_q, '\D', '', 'g');

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(p.full_name, p.email, '')::text AS full_name,
    CASE
      WHEN p.phone_number IS NOT NULL AND length(p.phone_number) > 4
        THEN left(p.phone_number, length(p.phone_number) - 4) || '****'
      ELSE NULL
    END AS phone_masked
  FROM public.profiles p
  WHERE
    (p.full_name ILIKE '%' || v_q || '%')
    OR (p.email ILIKE '%' || v_q || '%')
    OR (length(v_digits) >= 3 AND p.phone_number IS NOT NULL
        AND regexp_replace(p.phone_number, '\D', '', 'g') ILIKE '%' || v_digits || '%')
  ORDER BY
    CASE
      WHEN p.full_name ILIKE v_q || '%' THEN 0
      WHEN p.full_name ILIKE '%' || v_q || '%' THEN 1
      WHEN length(v_digits) >= 3
           AND p.phone_number IS NOT NULL
           AND regexp_replace(p.phone_number, '\D', '', 'g') ILIKE '%' || v_digits || '%' THEN 2
      WHEN p.email ILIKE '%' || v_q || '%' THEN 3
      ELSE 4
    END,
    p.full_name NULLS LAST
  LIMIT GREATEST(LEAST(COALESCE(_limit, 20), 50), 1);
END;
$function$;
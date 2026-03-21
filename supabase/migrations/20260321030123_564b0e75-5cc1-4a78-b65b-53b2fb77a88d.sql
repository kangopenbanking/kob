
CREATE OR REPLACE FUNCTION public.search_profiles_by_name(_query text, _limit integer DEFAULT 6)
RETURNS TABLE(id uuid, full_name text, phone_masked text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name::text,
    CASE 
      WHEN p.phone_number IS NOT NULL AND length(p.phone_number) > 4 
      THEN left(p.phone_number, length(p.phone_number) - 4) || '****'
      ELSE NULL
    END AS phone_masked
  FROM public.profiles p
  WHERE p.full_name ILIKE '%' || _query || '%'
    AND p.full_name IS NOT NULL
  ORDER BY p.full_name
  LIMIT _limit;
END;
$$;

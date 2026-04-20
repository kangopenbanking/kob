-- =========================================================================
-- 1. Update KANG ID generator: KNG- -> KANG-
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_kang_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len INT := length(v_alphabet);
  v_code TEXT;
  v_attempts INT := 0;
  i INT;
BEGIN
  LOOP
    v_code := 'KANG-';
    FOR i IN 1..10 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_len)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE kang_id = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'Could not generate a unique KANG ID after 25 attempts';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- =========================================================================
-- 2. Wipe all existing KANG IDs and regenerate with KANG- prefix
--    so every account is consistent and persistent under the new scheme.
-- =========================================================================
UPDATE public.profiles SET kang_id = NULL;

DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    v_code := public.generate_kang_id();
    UPDATE public.profiles SET kang_id = v_code WHERE id = r.id;
  END LOOP;
END $$;

-- =========================================================================
-- 3. Replace all @temp.kob.cm placeholder emails with {kang_id}@kang.id
--    in both auth.users and public.profiles. Real emails are untouched.
-- =========================================================================
DO $$
DECLARE
  r RECORD;
  v_new_email TEXT;
BEGIN
  FOR r IN
    SELECT u.id, u.email, p.kang_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE (u.email LIKE '%@temp.kob.cm' OR u.email LIKE '%@kang.id')
      AND p.kang_id IS NOT NULL
  LOOP
    v_new_email := lower(r.kang_id) || '@kang.id';

    IF r.email = v_new_email THEN
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_new_email AND id <> r.id) THEN
      RAISE WARNING 'Skipping % -> % (collision)', r.id, v_new_email;
      CONTINUE;
    END IF;

    UPDATE auth.users
    SET email = v_new_email,
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = r.id;

    UPDATE public.profiles
    SET email = v_new_email
    WHERE id = r.id
      AND (email IS NULL OR email LIKE '%@temp.kob.cm' OR email LIKE '%@kang.id');
  END LOOP;
END $$;

-- =========================================================================
-- 4. Update lookup_recipient to recognise the new KANG- prefix
-- =========================================================================
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
    -- already canonical
    NULL;
  ELSIF v_kang LIKE 'KANG%' THEN
    v_kang := 'KANG-' || substr(v_kang, 5);
  ELSIF v_kang LIKE 'KNG-%' THEN
    -- legacy form, no longer valid; ignore
    v_kang := NULL;
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
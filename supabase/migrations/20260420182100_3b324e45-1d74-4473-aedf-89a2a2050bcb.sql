-- =========================================================================
-- KANG ID system
-- Format: KNG-XXXXXXXXXX  (10 chars, alphabet excludes 0, O, 1, I, L)
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kang_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_kang_id_key
  ON public.profiles (kang_id)
  WHERE kang_id IS NOT NULL;

-- Generator: KNG- + 10 chars from an unambiguous alphabet
CREATE OR REPLACE FUNCTION public.generate_kang_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0,O,1,I,L
  v_len INT := length(v_alphabet);
  v_code TEXT;
  v_attempts INT := 0;
  i INT;
BEGIN
  LOOP
    v_code := 'KNG-';
    FOR i IN 1..10 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_len)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE kang_id = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'Could not generate a unique KANG ID after % attempts', v_attempts;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Trigger: auto-assign KANG ID on insert when missing
CREATE OR REPLACE FUNCTION public.assign_kang_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kang_id IS NULL OR length(trim(NEW.kang_id)) = 0 THEN
    NEW.kang_id := public.generate_kang_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_kang_id ON public.profiles;
CREATE TRIGGER trg_assign_kang_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_kang_id();

-- =========================================================================
-- Backfill KANG IDs for every existing account that does not have one yet
-- =========================================================================
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE kang_id IS NULL LOOP
    v_code := public.generate_kang_id();
    UPDATE public.profiles SET kang_id = v_code WHERE id = r.id;
  END LOOP;
END $$;

-- =========================================================================
-- Re-backfill temp placeholder emails to {kang_id}@temp.kob.cm
-- (previous migration used {uuid}@temp.kob.cm; switch to KANG ID)
-- =========================================================================
DO $$
DECLARE
  r RECORD;
  v_kang TEXT;
  v_new_email TEXT;
BEGIN
  FOR r IN
    SELECT u.id, u.email, p.kang_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.email LIKE '%@temp.kob.cm'
      AND p.kang_id IS NOT NULL
  LOOP
    v_kang := r.kang_id;
    v_new_email := lower(v_kang) || '@temp.kob.cm';

    -- Skip if already canonical
    IF r.email = v_new_email THEN
      CONTINUE;
    END IF;

    -- Skip on collision (defensive)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_new_email AND id <> r.id) THEN
      CONTINUE;
    END IF;

    UPDATE auth.users
    SET email = v_new_email
    WHERE id = r.id;

    UPDATE public.profiles
    SET email = v_new_email
    WHERE id = r.id
      AND (email IS NULL OR email LIKE '%@temp.kob.cm');
  END LOOP;
END $$;

-- =========================================================================
-- Recipient lookup helper for send / transfer / split-bill flows
-- Returns minimal safe fields. Searches by KANG ID (exact, case-insensitive),
-- phone (digits substring), or full name (substring).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.lookup_recipient(_query TEXT, _limit INT DEFAULT 10)
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
  v_q TEXT;
  v_digits TEXT;
  v_kang TEXT;
BEGIN
  v_q := COALESCE(trim(_query), '');
  IF length(v_q) < 2 THEN RETURN; END IF;

  v_digits := regexp_replace(v_q, '\D', '', 'g');
  v_kang   := upper(v_q);
  IF v_kang NOT LIKE 'KNG-%' AND v_kang NOT LIKE 'KNG%' THEN
    v_kang := NULL;
  ELSIF v_kang LIKE 'KNG%' AND v_kang NOT LIKE 'KNG-%' THEN
    v_kang := 'KNG-' || substr(v_kang, 4);
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.kang_id,
    COALESCE(p.full_name, '')::text AS full_name,
    CASE
      WHEN p.phone_number IS NOT NULL AND length(p.phone_number) > 4
        THEN left(p.phone_number, length(p.phone_number) - 4) || '****'
      ELSE NULL
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
    p.account_status IS NULL OR p.account_status <> 'suspended'
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
      WHEN p.full_name ILIKE v_q || '%' THEN 2
      ELSE 3
    END,
    p.full_name NULLS LAST
  LIMIT GREATEST(LEAST(COALESCE(_limit, 10), 25), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_recipient(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_recipient(TEXT, INT) TO authenticated;
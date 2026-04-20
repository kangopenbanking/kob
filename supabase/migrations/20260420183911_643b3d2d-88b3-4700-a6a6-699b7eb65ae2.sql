
-- =========================================================================
-- 1. Update KANG ID generator: KANG- + 8 digits (numeric only)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_kang_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code  TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'KANG-';
    FOR i IN 1..8 LOOP
      v_code := v_code || floor(random() * 10)::int::text;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE kang_id = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- =========================================================================
-- 2. Regenerate ALL existing KANG IDs to new 8-digit format
-- =========================================================================
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_old_kang TEXT;
  v_new_email TEXT;
BEGIN
  FOR r IN SELECT id, kang_id FROM public.profiles LOOP
    v_old_kang := r.kang_id;
    v_code := public.generate_kang_id();
    UPDATE public.profiles SET kang_id = v_code WHERE id = r.id;
    
    -- Update auth email if it used the old kang id pattern
    v_new_email := lower(v_code) || '@kang.id';
    UPDATE auth.users 
    SET email = v_new_email 
    WHERE id = r.id 
      AND (email LIKE '%@kang.id' OR email LIKE '%@temp.kob.cm');
  END LOOP;
END;
$$;

-- Backfill: rewrite all temp emails to canonical {user_id}@temp.kob.cm format
-- Keeps auth.users.email and public.profiles.email in sync.

DO $$
DECLARE
  r RECORD;
  v_new_email TEXT;
BEGIN
  FOR r IN
    SELECT id, email
    FROM auth.users
    WHERE email LIKE '%@temp.kob.cm'
      AND email <> (id::text || '@temp.kob.cm')
  LOOP
    v_new_email := r.id::text || '@temp.kob.cm';

    -- Skip if a collision exists (shouldn't happen, but be safe)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_new_email AND id <> r.id) THEN
      CONTINUE;
    END IF;

    UPDATE auth.users
    SET email = v_new_email,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    WHERE id = r.id;

    UPDATE public.profiles
    SET email = v_new_email
    WHERE id = r.id
      AND (email IS NULL OR email LIKE '%@temp.kob.cm');
  END LOOP;
END $$;
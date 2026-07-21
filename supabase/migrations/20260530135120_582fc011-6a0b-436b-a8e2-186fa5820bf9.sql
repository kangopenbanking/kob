
-- Retention + cleanup for security_capture_events
-- Configurable retention via system_config key; daily pg_cron cleanup.

INSERT INTO public.system_config (key, value, category, description, is_sensitive)
VALUES (
  'security_capture_events_retention_days',
  to_jsonb(90),
  'security',
  'Number of days to retain rows in public.security_capture_events before automatic deletion. Common values: 30, 90, 180, 365.',
  false
)
ON CONFLICT (key) DO NOTHING;

-- Cleanup function: deletes rows older than the configured retention window.
CREATE OR REPLACE FUNCTION public.cleanup_security_capture_events()
RETURNS TABLE(deleted_count BIGINT, retention_days INT, cutoff TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days   INT;
  v_cutoff TIMESTAMPTZ;
  v_count  BIGINT;
BEGIN
  SELECT COALESCE((value)::text::int, 90)
    INTO v_days
    FROM public.system_config
   WHERE key = 'security_capture_events_retention_days';

  IF v_days IS NULL OR v_days < 1 THEN
    v_days := 90;
  END IF;

  v_cutoff := now() - make_interval(days => v_days);

  WITH del AS (
    DELETE FROM public.security_capture_events
     WHERE created_at < v_cutoff
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM del;

  RETURN QUERY SELECT v_count, v_days, v_cutoff;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_security_capture_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_capture_events() TO service_role;

-- Schedule daily cleanup via pg_cron (03:15 UTC). Safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron WITH SCHEMA extensions;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-capture-events-cleanup') THEN
    PERFORM cron.unschedule('security-capture-events-cleanup');
  END IF;
  PERFORM cron.schedule(
    'security-capture-events-cleanup',
    '15 3 * * *',
    $cron$ SELECT public.cleanup_security_capture_events(); $cron$
  );
END $$;

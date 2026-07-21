-- Enable pg_cron and pg_net extensions for scheduled edge function invocation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron WITH SCHEMA extensions;
  END IF;
END
$$;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
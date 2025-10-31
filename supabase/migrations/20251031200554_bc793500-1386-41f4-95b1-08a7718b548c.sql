
-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule certificate expiry monitoring to run daily at midnight UTC
SELECT cron.schedule(
  'certificate-expiry-monitor-daily',
  '0 0 * * *', -- Every day at midnight UTC
  $$
  SELECT
    net.http_post(
        url:='https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/certificate-expiry-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0d2J0emJlcWtxcmRteG15dnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTYyNTcsImV4cCI6MjA3NjI5MjI1N30.R5mQ1wvKURfQWIR6vZ_vzKScXz19NULbt6tvxOC3aP0"}'::jsonb,
        body:=concat('{"scheduled_run": true, "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

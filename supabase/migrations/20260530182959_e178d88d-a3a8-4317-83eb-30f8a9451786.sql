
ALTER TABLE public.push_test_log
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS actions_tested jsonb;

CREATE INDEX IF NOT EXISTS idx_push_test_log_template_id
  ON public.push_test_log(template_id, created_at DESC);

ALTER TABLE public.didit_webhook_events
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_duplicate_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_retry_queue
  ON public.didit_webhook_events (next_retry_at)
  WHERE processed = false AND retry_count < 7;

CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_unprocessed
  ON public.didit_webhook_events (received_at DESC)
  WHERE processed = false;